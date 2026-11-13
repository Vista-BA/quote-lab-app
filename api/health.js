import { query } from "../lib/db.js";
import { send } from "../lib/http.js";
export default async function handler(req, res) {
  try {
    const [r] = await query("select count(*)::int as quotes, (select extversion from pg_extension where extname = 'vector') as pgvector from quotes");
    send(res, 200, { ok: true, db: process.env.DATABASE_URL?.startsWith("pglite:") ? "PGlite (local)" : "Neon Postgres", ...r,
      ai: !!process.env.ANTHROPIC_API_KEY, model: process.env.QUOTE_MODEL || "claude-haiku-4-5", writeKey: !!process.env.LAB_WRITE_KEY });
  } catch (e) { send(res, 500, { ok: false, error: String(e.message || e) }); }
}
