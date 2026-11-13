import { query, toVec } from "../lib/db.js";
import { send, body, canWrite, clean } from "../lib/http.js";
// POST: add a quote (with its vector) to the index. DELETE ?id=: remove an added quote (old ClickUp quotes are protected).
export default async function handler(req, res) {
  if (!canWrite(req)) return send(res, 401, { error: "write key needed" });
  try {
    if (req.method === "POST") {
      const r = body(req);
      if (!Array.isArray(r.vector) || r.vector.length !== 128 || !r.eq || !r.tr) return send(res, 400, { error: "eq, tr and a 128-number vector are required" });
      const id = "add-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const parts = (r.parts || []).slice(0, 10).map((p) => [clean(p[0], 80), +p[1] || 0]);
      await query(`insert into quotes (id, wo, fam, makes, eq, tr, total, parts, body, source, embedding) values ($1,'Added',$2,$3,$4,$5,$6,$7,$8,'added',$9::vector)`,
        [id, clean(r.fam, 60), clean(r.makes, 40), clean(r.eq, 70), clean(r.tr, 300), r.total || null, JSON.stringify(parts), clean(r.text, 2000), toVec(r.vector)]);
      return send(res, 200, { id });
    }
    if (req.method === "DELETE") {
      const id = new URL(req.url, "http://x").searchParams.get("id");
      await query(`delete from quotes where id = $1 and source = 'added'`, [id]);
      return send(res, 200, { ok: true });
    }
    send(res, 405, { error: "POST or DELETE" });
  } catch (e) { send(res, 500, { error: String(e.message || e) }); }
}
