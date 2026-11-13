# 7-Eleven Quote Lab — on a real vector database

One page at `/`, seven tabs: **Try a call**, **Vector search** (ranked by Postgres), **Rates and rules**, **Saved**, **Vector DB**, and two tabs taken from Quote Desk v4:

- **What the data says:** the ClickUp study (589 work orders, $1.03M quoted, NTE overruns, loss jobs, who quotes, the search test), each number with how it was counted.
- **Business case:** type the inputs (minutes per quote, hour cost, build and run cost) and the hours freed, money and payback follow. Unknowns stay "?".

Source of the two tabs: `src/business.js`. Their figures come from `desk/data/data.json` (`study`) and the sums from `desk/src/lib/caseModel.js`, both covered by `desk/tests/`. The rest of `desk/` (the full Quote Desk v4 React app) is kept in the repo but not served.

**Status: prototype.** Same Quote Lab page, but the quotes and their vectors live in **Postgres + pgvector** (Neon), and Postgres does the ranking. Not connected to Yoda, ClickUp or Quo.

## What runs where

| Part | Where | What it does |
|---|---|---|
| `quotes` table | Neon Postgres | 532 real 7-Eleven quotes (ClickUp, pulled 2026-11-12, phones/emails removed). `embedding vector(128)` + HNSW index (cosine). `tsv` full-text column + GIN index. |
| `drafts` table | Neon Postgres | Approved drafts (jsonb). |
| `/api/search` | Vercel function | Hybrid ranking **in SQL**: `0.6 × cosine (pgvector <=>) + 0.4 × ts_rank_cd`, each scaled 0–1. Modes: both, meaning, words. |
| `/api/index` | Vercel function | All rows + vectors, for the map and the drafting steps. |
| `/api/quotes` | Vercel function | Add a quote (POST) / remove an added one (DELETE). ClickUp rows cannot be deleted. |
| `/api/drafts` | Vercel function | Save / list approved drafts. |
| `/api/ai` | Vercel function | Optional Claude call (words only). Off without `ANTHROPIC_API_KEY`. |
| `public/index.html` | Vercel static | The page. Turns the query into a 128-number vector in the browser (same word vectors), sends it to `/api/search`. |

Prices are always computed by code in the page, never by AI.

## Deploy (no terminal needed, about 10 minutes)

1. **GitHub:** create a new **private** repo (e.g. `quote-lab`). On the empty repo page click *uploading an existing file*, drag in everything inside this folder (not `node_modules`), commit.
2. **Vercel:** Add New → Project → import that repo → Deploy. (The first deploy shows a DB error page; that is expected.)
3. **Database:** in the Vercel project → **Storage** → Create Database → **Neon** (free plan) → connect it to this project. Vercel adds `DATABASE_URL` for you.
4. **Settings → Environment Variables:** add `LAB_WRITE_KEY` = any password you choose. Optional: `ANTHROPIC_API_KEY` for the Claude option.
5. **Deployments → ⋯ → Redeploy** (env vars only apply to new deploys).
6. **Load the data once:** open `https://<your-app>.vercel.app/api/setup?key=<your LAB_WRITE_KEY>`. You should see `{"ok":true,"upserted":532,"rows":532}`.
7. Open `https://<your-app>.vercel.app`. The search tab should say **ranked by Postgres**.
8. **Settings → Deployment Protection → Vercel Authentication: on.** These are real company quotes.

Terminal alternative for step 6: `npm install` then `DATABASE_URL="<neon string>" npm run load`.

## Local

```bash
npm install
DATABASE_URL="pglite:./.pgdata" npm run load    # into a local PGlite (Postgres + pgvector in WASM)
npm run dev     # http://localhost:3000
npm test        # 74 Quote Desk tests (incl. the business case sums) + 9 API checks on a throwaway database
```
Set `DATABASE_URL` to a Neon string to run the same commands against Neon.

## Checks run (Nov 13, PGlite + pgvector 0.8.0)

- `npm test`: 9/9 pass; `/api/setup` loads 532 rows (load, self-match = cosine 1.0, bad input rejected, add, phone scrub, ClickUp rows protected, delete, drafts).
- Browser test (Playwright): search shows "ranked by Postgres", add-quote then search finds it first, Try a call drafts and prices, Approve saves to `drafts`, Vector DB tab reads health from the DB.
- **Not tested:** Neon itself (same SQL, different driver), Vercel deploy, the Claude path (no API key here).

## Limits

- Word vectors are a small offline model (128-d). A hosted embedding model would be better for production; it would change the column size and need re-loading.
- Rates, fees and tax come from past quotes, not an official source.
- `data/quotes.json` holds real company quotes: **keep the repo private.**
