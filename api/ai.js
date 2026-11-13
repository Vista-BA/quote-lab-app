import { send, body } from "../lib/http.js";
// Reads the call / writes the scope with Claude. Off unless ANTHROPIC_API_KEY is set in Vercel. Never used for prices.
export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });
  if (!process.env.ANTHROPIC_API_KEY) return send(res, 503, { error: "ai_off" });
  try {
    const { prompt } = body(req);
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.QUOTE_MODEL || "claude-haiku-4-5", max_tokens: 2000, messages: [{ role: "user", content: String(prompt).slice(0, 30000) }] }) });
    const j = await r.json(); if (!r.ok) return send(res, 502, { error: j?.error?.message || "upstream" });
    const text = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const m = text.match(/\{[\s\S]*\}/); if (!m) return send(res, 502, { error: "invalid_json" });
    send(res, 200, JSON.parse(m[0]));
  } catch (e) { send(res, 500, { error: String(e.message || e) }); }
}
