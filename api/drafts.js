import { query } from "../lib/db.js";
import { send, body, canWrite } from "../lib/http.js";
export default async function handler(req, res) {
  try {
    if (req.method === "GET") return send(res, 200, { rows: (await query(`select id::text, created_at, data from drafts order by created_at desc limit 60`)).map((r) => ({ id: r.id, ...r.data })) });
    if (req.method === "POST") {
      if (!canWrite(req)) return send(res, 401, { error: "write key needed" });
      const d = body(req); const [r] = await query(`insert into drafts (data) values ($1::jsonb) returning id::text`, [JSON.stringify(d).slice(0, 60000)]);
      return send(res, 200, { id: r.id });
    }
    send(res, 405, { error: "GET or POST" });
  } catch (e) { send(res, 500, { error: String(e.message || e) }); }
}
