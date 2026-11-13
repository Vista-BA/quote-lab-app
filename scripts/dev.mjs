// Local server: serves public/ and the /api handlers, like Vercel does. Uses PGlite (Postgres + pgvector in WASM) unless DATABASE_URL is set.
import http from "node:http";
import { readFile } from "node:fs/promises";
process.env.DATABASE_URL ||= "pglite:./.pgdata";
const port = +process.env.PORT || 3000;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json" };
http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/api/")) {
    const name = url.pathname.slice(5).replace(/[^a-z]/g, "");
    let raw = ""; for await (const c of req) raw += c; req.body = raw ? JSON.parse(raw) : {};
    try { const mod = await import(`../api/${name}.js`); return mod.default(req, res); } catch (e) { res.statusCode = 404; return res.end(String(e.message)); }
  }
  const file = url.pathname === "/" ? "/index.html" : url.pathname;
  try { const b = await readFile(new URL("../public" + file.replace(/\.\./g, ""), import.meta.url)); res.setHeader("content-type", types[file.slice(file.lastIndexOf("."))] || "application/octet-stream"); res.end(b); }
  catch { res.statusCode = 404; res.end("not found"); }
}).listen(port, () => console.log(`Quote Lab on http://localhost:${port} (db: ${process.env.DATABASE_URL.split(":")[0]})`));
