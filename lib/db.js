// One query() for the whole app.
// DATABASE_URL = postgres://... (Neon)  -> Neon serverless driver (production, Vercel)
// DATABASE_URL = pglite:./.pgdata       -> PGlite, Postgres + pgvector in-process (local dev and tests)
let impl;
export async function query(text, params = []) {
  if (!impl) impl = await connect();
  return impl(text, params);
}
async function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (url.startsWith("pglite:")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { vector } = await import("@electric-sql/pglite/vector");
    const db = globalThis.__pglite || (globalThis.__pglite = new PGlite(url.slice(7) || undefined, { extensions: { vector } }));
    await db.exec("create extension if not exists vector");
    return async (t, p) => (await db.query(t, p)).rows;
  }
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(url);
  return (t, p) => sql(t, p);
}
export const toVec = (a) => "[" + a.map((x) => Number(x).toFixed(5)).join(",") + "]";
export const fromVec = (v) => (Array.isArray(v) ? v : JSON.parse(v));
