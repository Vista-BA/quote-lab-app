import { query, toVec } from "../lib/db.js";
import { send, body } from "../lib/http.js";
// Hybrid search inside Postgres: pgvector cosine similarity + full-text rank, blended with weight w.
// The page sends the query vector (made in the browser from the same word vectors) and the query words.
export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });
  try {
    const { vector, words = [], w = 0.6, k = 5, mode = "both" } = body(req);
    if (!Array.isArray(vector) || vector.length !== 128) return send(res, 400, { error: "vector must have 128 numbers" });
    const tq = [...new Set(words.map((x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, "")).filter((x) => x.length > 1))].slice(0, 40).join(" | ") || "zzzznomatch";
    const lim = Math.min(Math.max(+k || 5, 1), 50), wt = Math.min(Math.max(+w, 0), 1);
    if (mode === "meaning") {
      const rows = await query(`select id, 1 - (embedding <=> $1::vector) as sem from quotes order by embedding <=> $1::vector limit $2`, [toVec(vector), lim]);
      return send(res, 200, { mode, sql: "order by embedding <=> query (HNSW index)", hits: rows });
    }
    const rows = await query(`
      with q as (select $1::vector as v, to_tsquery('simple', $2) as tq),
      s as (select id, 1 - (embedding <=> q.v) as sem, ts_rank_cd(tsv, q.tq) as kw from quotes, q),
      n as (select id, sem, kw,
              (sem - min(sem) over ()) / nullif(max(sem) over () - min(sem) over (), 0) as semn,
              kw / nullif(max(kw) over (), 0) as kwn from s)
      select id, sem, kw, coalesce(semn, 0) as semn, coalesce(kwn, 0) as kwn,
             case when $3 = 'words' then coalesce(kwn, 0) else $4 * coalesce(semn, 0) + (1 - $4) * coalesce(kwn, 0) end as score
      from n where ($3 <> 'words' or kw > 0) order by score desc limit $5`, [toVec(vector), tq, mode, wt, lim]);
    send(res, 200, { mode, sql: mode === "words" ? "ts_rank_cd(tsv, query)" : `${wt} × cosine (pgvector) + ${(1 - wt).toFixed(2)} × ts_rank_cd (full text)`, hits: rows });
  } catch (e) { send(res, 500, { error: String(e.message || e) }); }
}
