// Builds public/index.html from src/template.html (the Quote Lab page) + data/page_data.json (word vectors, rules, samples).
// The quotes themselves are NOT baked in: the page loads them from Postgres through /api/index.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const root = new URL("..", import.meta.url);
let html = readFileSync(new URL("src/template.html", root), "utf8");
const data = readFileSync(new URL("data/page_data.json", root), "utf8");
const rep = (a, b) => { const n = html.split(a).length - 1; if (n !== 1) throw new Error(`expected 1 match, got ${n}: ${a.slice(0, 70)}`); html = html.replace(a, () => b); };

// 1. Boot: fetch health + quotes from the API, then run the page.
rep("const LAB = __LAB__;", `const API_KEY_STORE = "qlab.writekey";
const writeHeaders = () => { let k = ""; try { k = localStorage.getItem(API_KEY_STORE) || ""; } catch (e) {} return {"content-type": "application/json", ...(k ? {"x-lab-key": k} : {})}; };
async function api(path, opts = {}) { const r = await fetch(path, opts); const j = await r.json().catch(() => ({}));
  if (r.status === 401) { const k = prompt("This server needs the write key to save. Enter it (ask Hector):"); if (k) { try { localStorage.setItem(API_KEY_STORE, k); } catch (e) {} return api(path, {...opts, headers: writeHeaders()}); } }
  if (!r.ok) throw Object.assign(new Error(j.error || r.status), {code: j.error || String(r.status)}); return j; }
(async () => {
const HEALTH = await api("/api/health").catch(e => ({ok: false, error: e.message}));
const LAB = ${data};
LAB.docs = HEALTH.ok ? (await api("/api/index")).rows : [];
if (!HEALTH.ok) document.body.insertAdjacentHTML("afterbegin", \`<div style="padding:12px;background:#fde8e8;color:#7a1010;font:14px system-ui">The database is not reachable (\${String(HEALTH.error || "no answer").replace(/[<>&]/g, "")}). Check DATABASE_URL and run <code>npm run load</code>.</div>\`);`);
html = html.replace(/<\/script>(?![\s\S]*<\/script>)/, "})();\n</script>");

// 2. Use the vectors stored in Postgres (not re-embedded), and keep added quotes marked as added.
rep(`const d = {...q, src: "ClickUp", from: "database"`, `const d = {...q, src: q.source === "added" ? "added" : "ClickUp", from: "database"`);
rep("let MAP = buildMap();", "if (LAB.docs.length) V.load(LAB.docs);\nlet MAP = buildMap();");

// 3. Capabilities -> this server's API.
rep(`(async () => {
  if (!window.claude?.use) { setAI(); setDB(); return; }
  claude.use("sample").then(s => { CAP.sample = s; setAI(); });
  claude.use("user").then(async u => { CAP.user = u; try { CAP.me = u ? await u.id() : null; } catch (e) {} });
  claude.use("db").then(d => { CAP.db = d; setDB(); });
})();
setTimeout(() => { setAI(); setDB(); }, 11000);`, `CAP.sample = HEALTH.ai ? {json: (prompt) => api("/api/ai", {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({prompt})})} : null;
CAP.db = HEALTH.ok ? {collection: (name) => ({
  add: (rec) => name === "drafts" ? api("/api/drafts", {method: "POST", headers: writeHeaders(), body: JSON.stringify(rec)}).then(j => { DRAFTS.unshift({id: j.id, ...rec}); dbState = "on"; renderSaved(); return j; })
    : api("/api/quotes", {method: "POST", headers: writeHeaders(), body: JSON.stringify({...rec, text: V.toks([rec.eq, rec.fam, rec.makes, rec.tr, (rec.parts || []).map(p => p[0]).join(" ")].join(" ")).join(" "),
        vector: Array.from(V.embed(V.toks([rec.eq, rec.fam, rec.makes, rec.tr, (rec.parts || []).map(p => p[0]).join(" ")].join(" "))))})}).then(j => { addToIndex({...rec, id: j.id}); QUOTES.unshift({...rec, id: j.id}); renderSaved(); return j; }),
  doc: (id) => ({delete: () => api("/api/quotes?id=" + encodeURIComponent(id), {method: "DELETE", headers: writeHeaders()})})})} : null;
CAP.user = {canEdit: () => true};
setTimeout(() => { setAI(); setDB(); }, 0);`);
rep("uses your own Claude usage)", "runs on this server's Anthropic API key)");
rep("Claude is not available in this view, so the rules version reads the call and writes the scope. <span class='note'>Open the page on claude.ai to use Claude.</span>",
    "Claude is off on this server, so the rules version reads the call and writes the scope. <span class='note'>Set ANTHROPIC_API_KEY in Vercel to turn it on.</span>");

// 4. Saved + index state come from Postgres.
rep(`  CAP.db.collection("index").get().then(s => {`, `  clearTimeout(t); IDX = {state: "db", rows: V.docs.filter(d => d.src === "ClickUp").length};
  V.docs.forEach(d => { if (d.src === "added") LIB.set(d.id, d); });
  QUOTES = LAB.docs.filter(d => d.source === "added").map(d => ({...d}));
  const pull = () => api("/api/drafts").then(j => { dbState = "on"; DRAFTS = j.rows; renderSaved(); }).catch(() => { dbState = "error"; renderSaved(); });
  pull(); setInterval(pull, 20000); legend(); renderDB();
  if (false) CAP.db.collection("index").get().then(s => {`);
rep(`  CAP.db.collection("drafts").orderBy("at", "desc").limit(60).onSnapshot(`, `  if (false) CAP.db.collection("drafts").orderBy("at", "desc").limit(60).onSnapshot(`);
rep(`  CAP.db.collection("library").orderBy("at", "desc").limit(300).onSnapshot(`, `  if (false) CAP.db.collection("library").orderBy("at", "desc").limit(300).onSnapshot(`);
rep("try { await CAP.db.collection(\"library\").doc(b.dataset.del).delete(); location.reload(); }", "try { await CAP.db.collection(\"library\").doc(b.dataset.del).delete(); location.reload(); }");
rep("shared with everyone who opens this page.`", "stored in Postgres and shared with everyone who opens this page.`");

// 5. Search runs in Postgres (pgvector + full text). The browser version stays as the fallback.
rep("function doSearch() {", `async function pgSearch(q, {mode = "both", w = 0.6, k = 5, gloss = true} = {}) {
  const local = V.search(q, {mode, w, k, gloss});
  try {
    const words = [...V.toks(q), ...local.added];
    const j = await api("/api/search", {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({vector: Array.from(local.qv), words, w, k, mode})});
    const pos = new Map(V.docs.map((d, i) => [d.id, i]));
    const hits = j.hits.filter(h => pos.has(h.id)).map(h => { const i = pos.get(h.id); return {d: V.docs[i], i, sem: h.sem, semN: h.semn ?? h.sem, kw: h.kwn ?? 0, s: h.score ?? h.sem}; });
    return {...local, hits, by: "pg", sql: j.sql};
  } catch (e) { return {...local, by: "browser", err: e.message}; }
}
let searchSeq = 0;
async function doSearch() {`);
rep(`  last = V.search(q, {mode, w: W, k: 5, gloss: $("#gl").checked});`, `  const seq = ++searchSeq; const res = await pgSearch(q, {mode, w: W, k: 5, gloss: $("#gl").checked}); if (seq !== searchSeq) return; last = res;`);
rep(`$("#added").innerHTML = (last.added.length`, `$("#added").innerHTML = (last.by === "pg" ? \`<span class="chip ok">ranked by Postgres</span> <span class="mono note">\${esc(last.sql)}</span><br>\` : \`<span class="chip warn">ranked in the browser (\${esc(last.err || "")})</span><br>\`) + (last.added.length`);
rep(`const res = V.search(q, {mode: "both", k: 5}); ST.hits = res.hits;`, `const res = await pgSearch(q, {mode: "both", k: 5}); ST.hits = res.hits; ST.by = res.by;`);

// 6. Vector DB tab describes Postgres.
rep(`The quote vectors live in this page's shared database`, `The quote vectors live in Postgres (pgvector)`);
rep(`  $("#dbnote").textContent = st === "db" ?`, `  if (st === "db") { $("#dbnote").textContent = \`\${HEALTH.quotes} rows in the table "quotes" on \${HEALTH.db}, pgvector \${HEALTH.pgvector}. Each row has a vector(128) column with an HNSW index (cosine) and a full-text column with a GIN index. Search and Try a call send the query vector to /api/search, and Postgres ranks the rows.\`;
    $("#dbkv").innerHTML = [["Database", HEALTH.db], ["Table", "quotes"], ["Rows", HEALTH.quotes], ["From ClickUp", V.docs.filter(d => d.src === "ClickUp").length], ["Added by people", LIB.size],
      ["Vector column", "embedding vector(128)"], ["Vector index", "HNSW, vector_cosine_ops"], ["Word index", "tsvector (simple) + GIN"], ["Ranking", "0.6 × cosine + 0.4 × ts_rank_cd, each scaled 0-1"],
      ["Model", "WordLlama l2_supercat, 128-d"], ["Query vectors", \`made in your browser from \${V.vocab.toLocaleString()} word vectors\`], ["Claude", HEALTH.ai ? HEALTH.model : "off (no API key)"]].map(([k, v]) => \`<span class="note">\${esc(k)}</span><span>\${esc(v)}</span>\`).join("");
    const sel = $("#vpick"), keep = sel.value; sel.innerHTML = V.docs.slice(0, 600).map((d, i) => \`<option value="\${i}">\${esc((d.wo || "Added") + " · " + d.eq)}</option>\`).join(""); if (keep) sel.value = keep; else { const j = V.docs.findIndex(d => d.wo === "WO-47084"); if (j >= 0) sel.value = j; }
    showVec(); return; }
  $("#dbnote").textContent = st === "db" ?`);
rep("Meaning search: a small free word-vector model, ${V.dim} numbers per quote, ${V.vocab.toLocaleString()} words, running in your browser.",
    "Vectors: a small free word-vector model, ${V.dim} numbers per quote, stored and ranked in Postgres + pgvector.");
rep("<title>7-Eleven Quote Lab</title>", `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>7-Eleven Quote Lab</title>`);
html += "\n</body></html>\n";
mkdirSync(new URL("public", root), { recursive: true });
writeFileSync(new URL("public/index.html", root), html);
console.log("public/index.html", (html.length / 1024).toFixed(0), "KB");
