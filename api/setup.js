import { loadAll } from "../lib/load.js";
import { send } from "../lib/http.js";
// One-time (safe to repeat) database setup after deploy: /api/setup?key=<LAB_WRITE_KEY>
export default async function handler(req, res) {
  const key = new URL(req.url, "http://x").searchParams.get("key");
  if (!process.env.LAB_WRITE_KEY) return send(res, 403, { error: "Set LAB_WRITE_KEY in Vercel first, then redeploy." });
  if (key !== process.env.LAB_WRITE_KEY) return send(res, 401, { error: "wrong key" });
  try { send(res, 200, { ok: true, ...(await loadAll()) }); } catch (e) { send(res, 500, { error: String(e.message || e) }); }
}
