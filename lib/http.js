export const send = (res, code, obj) => { res.statusCode = code; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(obj)); };
export const body = (req) => (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {});
// Optional shared key for writes: set LAB_WRITE_KEY in Vercel and give the key to the people who may save.
export const canWrite = (req) => !process.env.LAB_WRITE_KEY || req.headers["x-lab-key"] === process.env.LAB_WRITE_KEY;
export const clean = (s, n = 400) => String(s ?? "").replace(/\(?\b\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}\b/g, "[phone]").replace(/\S+@\S+/g, "[email]").slice(0, n);
