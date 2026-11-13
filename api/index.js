import { query, fromVec } from "../lib/db.js";
import { send } from "../lib/http.js";
// Every quote with its vector: the page draws the map and runs the drafting steps on these rows.
export default async function handler(req, res) {
  try {
    const rows = await query(`select id, wo, fam, makes, eq, tr, total::float as total, nte::float as nte, trade, state, tax::float as tax,
      steps, parts, labor, body as text, source, embedding::text as v from quotes order by source, id`);
    send(res, 200, { rows: rows.map(({ v, ...r }) => ({ ...r, vector: fromVec(v) })) });
  } catch (e) { send(res, 500, { error: String(e.message || e) }); }
}
