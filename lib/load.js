// Creates the tables/indexes and upserts the quotes in batches of 50 (fast over Neon's HTTP driver).
import { readFileSync } from "node:fs";
import { query, toVec } from "./db.js";
export async function loadAll() {
  const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  for (const stmt of schema.split(";").map((s) => s.trim()).filter(Boolean)) await query(stmt);
  const rows = JSON.parse(readFileSync(new URL("../data/quotes.json", import.meta.url), "utf8"));
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50), params = [], vals = [];
    chunk.forEach((r, j) => {
      const b = j * 16;
      vals.push(`(${Array.from({ length: 15 }, (_, k) => `$${b + k + 1}`).join(",")},$${b + 16}::vector,'clickup')`);
      params.push(r.id, r.wo, r.fam, r.makes, r.eq, r.tr, r.total, r.nte, r.trade, r.state, r.tax, JSON.stringify(r.steps || []),
        JSON.stringify(r.parts || []), JSON.stringify(r.labor || []), r.text, toVec(r.vector));
    });
    await query(`insert into quotes (id, wo, fam, makes, eq, tr, total, nte, trade, state, tax, steps, parts, labor, body, embedding, source)
      values ${vals.join(",")}
      on conflict (id) do update set wo=excluded.wo, fam=excluded.fam, makes=excluded.makes, eq=excluded.eq, tr=excluded.tr, total=excluded.total,
        nte=excluded.nte, trade=excluded.trade, state=excluded.state, tax=excluded.tax, steps=excluded.steps, parts=excluded.parts,
        labor=excluded.labor, body=excluded.body, embedding=excluded.embedding`, params);
  }
  const [c] = await query("select count(*)::int as n from quotes");
  return { upserted: rows.length, rows: c.n };
}
