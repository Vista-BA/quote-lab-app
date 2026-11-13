// Builds public/index.html from src/template.html (the Quote Lab page) + data/page_data.json (word vectors, rules, samples),
// plus the "What the data says" and "Business case" tabs from src/business.js.
// The quotes themselves are NOT baked in: the page loads them from Postgres through /api/index.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const root = new URL("..", import.meta.url);
let html = readFileSync(new URL("src/template.html", root), "utf8");
const data = readFileSync(new URL("data/page_data.json", root), "utf8");
const rep = (a, b) => { const n = html.split(a).length - 1; if (n !== 1) throw new Error(`expected 1 match, got ${n}: ${a.slice(0, 70)}`); html = html.replace(a, () => b); };

// 1. Boot: fetch health + quotes from the API, then run the page.
rep("const LAB = __LAB__;", `const API_KEY_STORE = "qlab.writekey";
const writeHeaders = () => { let k = ""; try { k = localStorage.getItem(API_KEY_STORE) || ""; } catch (e) {} return {"content-type": "application/json", ...(k ? {"x-lab-key": k} : {})}; };
async function api(path, opts = {}) { const r = await fetch(path, opts); const j = await r.json().catch(() => ({}));
  if (r.status === 401) { const k = prompt("This server needs the write key to save. Enter it (ask Hector):"); if (k) { try { localStorage.setItem(API_KEY_STORE, k); } catch (e) {} return api(path, {...opts, headers: writeHeaders()}); } }
  if (!r.ok) throw Object.assign(new Error(j.error || r.status), {code: j.error || String(r.status)}); return j; }
(async () => {
const HEALTH = await api("/api/health").catch(e => ({ok: false, error: e.message}));
const LAB = ${data};
LAB.docs = HEALTH.ok ? (await api("/api/index")).rows : [];
if (!HEALTH.ok) document.body.insertAdjacentHTML("afterbegin", \`<div style="padding:12px;background:#fde8e8;color:#7a1010;font:14px system-ui">The database is not reachable (\${String(HEALTH.error || "no answer").replace(/[<>&]/g, "")}). Check DATABASE_URL and run <code>npm run load</code>.</div>\`);`);
html = html.replace(/<\/script>(?![\s\S]*<\/script>)/, "})();\n</script>");

// 2. Use the vectors stored in Postgres (not re-embedded), and keep added quotes marked as added.
rep(`const d = {...q, src: "ClickUp", from: "database"`, `const d = {...q, src: q.source === "added" ? "added" : "ClickUp", from: "database"`);
rep("let MAP = buildMap();", "if (LAB.docs.length) V.load(LAB.docs);\nlet MAP = buildMap();");

// 3. Capabilities -> this server's API.
rep(`(async () => {
  if (!window.claude?.use) { setAI(); setDB(); return; }
  claude.use("sample").then(s => { CAP.sample = s; setAI(); });
  claude.use("user").then(async u => { CAP.user = u; try { CAP.me = u ? await u.id() : null; } catch (e) {} });
  claude.use("db").then(d => { CAP.db = d; setDB(); });
})();
setTimeout(() => { setAI(); setDB(); }, 11000);`, `CAP.sample = HEALTH.ai ? {json: (prompt) => api("/api/ai", {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({prompt})})} : null;
CAP.db = HEALTH.ok ? {collection: (name) => ({
  add: (rec) => name === "drafts" ? api("/api/drafts", {method: "POST", headers: writeHeaders(), body: JSON.stringify(rec)}).then(j => { DRAFTS.unshift({id: j.id, ...rec}); dbState = "on"; renderSaved(); return j; })
    : api("/api/quotes", {method: "POST", headers: writeHeaders(), body: JSON.stringify({...rec, text: V.toks([rec.eq, rec.fam, rec.makes, rec.tr, (rec.parts || []).map(p => p[0]).join(" ")].join(" ")).join(" "),
        vector: Array.from(V.embed(V.toks([rec.eq, rec.fam, rec.makes, rec.tr, (rec.parts || []).map(p => p[0]).join(" ")].join(" "))))})}).then(j => { addToIndex({...rec, id: j.id}); QUOTES.unshift({...rec, id: j.id}); renderSaved(); return j; }),
  doc: (id) => ({delete: () => api("/api/quotes?id=" + encodeURIComponent(id), {method: "DELETE", headers: writeHeaders()})})})} : null;
CAP.user = {canEdit: () => true};
setTimeout(() => { setAI(); setDB(); }, 0);`);
rep("uses your own Claude usage)", "runs on this server's Anthropic API key)");
rep("Claude is not available in this view, so the rules version reads the call and writes the scope. <span class='note'>Open the page on claude.ai to use Claude.</span>",
    "Claude is off on this server, so the rules version reads the call and writes the scope. <span class='note'>Set ANTHROPIC_API_KEY in Vercel to turn it on.</span>");

// 4. Saved + index state come from Postgres.
rep(`  CAP.db.collection("index").get().then(s => {`, `  clearTimeout(t); IDX = {state: "db", rows: V.docs.filter(d => d.src === "ClickUp").length};
  V.docs.forEach(d => { if (d.src === "added") LIB.set(d.id, d); });
  QUOTES = LAB.docs.filter(d => d.source === "added").map(d => ({...d}));
  const pull = () => api("/api/drafts").then(j => { dbState = "on"; DRAFTS = j.rows; renderSaved(); }).catch(() => { dbState = "error"; renderSaved(); });
  pull(); setInterval(pull, 20000); legend(); renderDB();
  if (false) CAP.db.collection("index").get().then(s => {`);
rep(`  CAP.db.collection("drafts").orderBy("at", "desc").limit(60).onSnapshot(`, `  if (false) CAP.db.collection("drafts").orderBy("at", "desc").limit(60).onSnapshot(`);
rep(`  CAP.db.collection("library").orderBy("at", "desc").limit(300).onSnapshot(`, `  if (false) CAP.db.collection("library").orderBy("at", "desc").limit(300).onSnapshot(`);
rep("try { await CAP.db.collection(\"library\").doc(b.dataset.del).delete(); location.reload(); }", "try { await CAP.db.collection(\"library\").doc(b.dataset.del).delete(); location.reload(); }");
rep("shared with everyone who opens this page.`", "stored in Postgres and shared with everyone who opens this page.`");

// 5. Search runs in Postgres (pgvector + full text). The browser version stays as the fallback.
rep("function doSearch() {", `async function pgSearch(q, {mode = "both", w = 0.6, k = 5, gloss = true} = {}) {
  const local = V.search(q, {mode, w, k, gloss});
  try {
    const words = [...V.toks(q), ...local.added];
    const j = await api("/api/search", {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({vector: Array.from(local.qv), words, w, k, mode})});
    const pos = new Map(V.docs.map((d, i) => [d.id, i]));
    const hits = j.hits.filter(h => pos.has(h.id)).map(h => { const i = pos.get(h.id); return {d: V.docs[i], i, sem: h.sem, semN: h.semn ?? h.sem, kw: h.kwn ?? 0, s: h.score ?? h.sem}; });
    return {...local, hits, by: "pg", sql: j.sql};
  } catch (e) { return {...local, by: "browser", err: e.message}; }
}
let searchSeq = 0;
async function doSearch() {`);
rep(`  last = V.search(q, {mode, w: W, k: 5, gloss: $("#gl").checked});`, `  const seq = ++searchSeq; const res = await pgSearch(q, {mode, w: W, k: 5, gloss: $("#gl").checked}); if (seq !== searchSeq) return; last = res;`);
rep(`$("#added").innerHTML = (last.added.length`, `$("#added").innerHTML = (last.by === "pg" ? \`<span class="chip ok">ranked by Postgres</span> <span class="mono note">\${esc(last.sql)}</span><br>\` : \`<span class="chip warn">ranked in the browser (\${esc(last.err || "")})</span><br>\`) + (last.added.length`);
rep(`const res = V.search(q, {mode: "both", k: 5}); ST.hits = res.hits;`, `const res = await pgSearch(q, {mode: "both", k: 5}); ST.hits = res.hits; ST.by = res.by;`);

// 6. Vector DB tab describes Postgres.
rep(`The quote vectors live in this page's shared database`, `The quote vectors live in Postgres (pgvector)`);
rep(`  $("#dbnote").textContent = st === "db" ?`, `  if (st === "db") { $("#dbnote").textContent = \`\${HEALTH.quotes} rows in the table "quotes" on \${HEALTH.db}, pgvector \${HEALTH.pgvector}. Each row has a vector(128) column with an HNSW index (cosine) and a full-text column with a GIN index. Search and Try a call send the query vector to /api/search, and Postgres ranks the rows.\`;
    $("#dbkv").innerHTML = [["Database", HEALTH.db], ["Table", "quotes"], ["Rows", HEALTH.quotes], ["From ClickUp", V.docs.filter(d => d.src === "ClickUp").length], ["Added by people", LIB.size],
      ["Vector column", "embedding vector(128)"], ["Vector index", "HNSW, vector_cosine_ops"], ["Word index", "tsvector (simple) + GIN"], ["Ranking", "0.6 × cosine + 0.4 × ts_rank_cd, each scaled 0-1"],
      ["Model", "WordLlama l2_supercat, 128-d"], ["Query vectors", \`made in your browser from \${V.vocab.toLocaleString()} word vectors\`], ["Claude", HEALTH.ai ? HEALTH.model : "off (no API key)"]].map(([k, v]) => \`<span class="note">\${esc(k)}</span><span>\${esc(v)}</span>\`).join("");
    const sel = $("#vpick"), keep = sel.value; sel.innerHTML = V.docs.slice(0, 600).map((d, i) => \`<option value="\${i}">\${esc((d.wo || "Added") + " · " + d.eq)}</option>\`).join(""); if (keep) sel.value = keep; else { const j = V.docs.findIndex(d => d.wo === "WO-47084"); if (j >= 0) sel.value = j; }
    showVec(); return; }
  $("#dbnote").textContent = st === "db" ?`);
rep("Meaning search: a small free word-vector model, ${V.dim} numbers per quote, ${V.vocab.toLocaleString()} words, running in your browser.",
    "Vectors: a small free word-vector model, ${V.dim} numbers per quote, stored and ranked in Postgres + pgvector.");
rep("<title>7-Eleven Quote Lab</title>", `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>7-Eleven Quote Lab</title>`);
// 7. Two tabs from Quote Desk v4: "What the data says" and "Business case" (src/business.js).
//    The study counts come from desk/data/data.json; the case sums reuse desk/src/lib/caseModel.js (tested by desk/tests).
const study = JSON.parse(readFileSync(new URL("desk/data/data.json", root), "utf8")).study;
const caseModel = readFileSync(new URL("desk/src/lib/caseModel.js", root), "utf8").replace(/^export /gm, "");
const business = readFileSync(new URL("src/business.js", root), "utf8");
rep(`<button class="tab" role="tab" id="tab-db" aria-selected="false">Vector DB</button>`, `<button class="tab" role="tab" id="tab-db" aria-selected="false">Vector DB</button>
      <button class="tab" role="tab" id="tab-data" aria-selected="false">What the data says</button>
      <button class="tab" role="tab" id="tab-case" aria-selected="false">Business case</button>`);
rep(`  <footer id="foot"></footer>`, `  <section id="view-data" hidden></section>
  <section id="view-case" hidden></section>

  <footer id="foot"></footer>`);
rep("</style>", `/* data + business case (from Quote Desk v4) */
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:14px}
.kpi{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:4px}
.kpi .v{font:800 26px/1.1 var(--display);color:var(--accent)} .kpi .v.unknown{color:var(--mute)}
.kpi .t{font-size:13.5px}
details.fold{margin-bottom:10px;padding:0}
details.fold>summary{cursor:pointer;padding:13px 16px;display:flex;flex-direction:column;gap:2px;font-weight:600}
details.fold>summary::marker{color:var(--mute)}
.fbody{padding:0 16px 16px;display:flex;flex-direction:column;gap:8px;font-size:14px}
.fbody ul,.fbody ol{margin:0;padding-left:18px}
.bbar{display:grid;grid-template-columns:minmax(120px,220px) minmax(0,1fr) 70px;gap:10px;align-items:center;font-size:13.5px;padding:3px 0}
.bbar .track{height:10px;background:var(--soft);border-radius:5px;overflow:hidden}
.bbar .track b{display:block;height:100%;background:var(--accent)}
.bbar .money{text-align:right}
.issue{display:grid;grid-template-columns:80px minmax(0,1fr);gap:12px;align-items:baseline;padding:8px 0;border-top:1px solid var(--line)}
.issue:first-child{border-top:0}
.issue .big{font:800 22px var(--display);color:var(--amber)}
.scroll{overflow-x:auto}
table.dt{width:100%;border-collapse:collapse;font-size:13.5px}
table.dt th{text-align:left;font:600 12px var(--body);color:var(--mute);border-bottom:1px solid var(--line);padding:6px 8px}
table.dt td{border-bottom:1px solid var(--line);padding:7px 8px;vertical-align:top}
table.dt tr.best td{background:var(--accent-soft);font-weight:600}
.callout{background:var(--accent-soft);border-radius:8px;padding:9px 12px;font-size:13.5px;margin-top:8px}
.callout.warn{background:var(--amber-soft)}
.casemath{display:flex;flex-direction:column;margin-top:10px}
.mathrow{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid var(--line);font-size:13.5px}
.mathrow:first-child{border-top:0}
#view-case .field input{max-width:220px}
#view-case ol{margin:6px 0 10px;padding-left:20px}
@media (max-width:900px){#view-case>.grid2{grid-template-columns:1fr}}
@media (max-width:640px){.bbar{grid-template-columns:110px minmax(0,1fr) 56px}}
</style>`);
rep("/* ============================ tabs + boot ============================ */", `/* ============================ data + business case ============================ */
const STUDY = ${JSON.stringify(study)};
${caseModel}
${business}
/* ============================ tabs + boot ============================ */`);
rep(`const VIEWS = ["try", "search", "rules", "saved", "db"];`, `const VIEWS = ["try", "search", "rules", "saved", "db", "data", "case"];`);
html += "\n</body></html>\n";
mkdirSync(new URL("public", root), { recursive: true });
writeFileSync(new URL("public/index.html", root), html);
console.log("public/index.html (Quote Lab)", (html.length / 1024).toFixed(0), "KB");
