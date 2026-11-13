import { useEffect, useMemo, useState } from "react";
import { X } from "../data.js";
import { money } from "../lib/pricing.js";
import { Chip, How, Label } from "./ui.jsx";

const EXAMPLES = ["slushie drink not frozen", "soda comes out flat", "espresso maker dripping water", "beer cave is warm", "oven making noise and burning food", "ice cream case frosting over"];
const MODES = [["both", "Both"], ["meaning", "Meaning only"], ["keyword", "Words only"]];

/* Top 5 for one query. Each result carries its two scores, so the bars can show why it ranked. */
function search(q, mode) {
  if (!q) return null;
  const kw = new Map(X.keyword(q, X.n).map(r => [r.d.wo, r.s]));
  const m = X.meaning(q, X.n), lo = m.hits[m.hits.length - 1].s, hi = m.hits[0].s;
  const sem = new Map(m.hits.map(h => [h.d.wo, (h.s - lo) / (hi - lo || 1)]));
  const hits = mode === "both" ? X.both(q).hits : mode === "meaning" ? m.hits.slice(0, 5) : X.keyword(q);
  return { added: m.added, hits: hits.map(h => ({ d: h.d, sem: Math.round((sem.get(h.d.wo) || 0) * 100), kw: Math.round((kw.get(h.d.wo) || 0) * 100) })) };
}

/* The same top 5, ranked by Postgres (pgvector cosine + full-text rank) through /api/search.
   The browser makes the query vector; the database compares it with every stored quote. */
const API_MODE = { both: "both", meaning: "meaning", keyword: "words" };
async function searchDb(q, mode) {
  const { vector, words, added } = X.query(q);
  const r = await fetch("/api/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vector, words, k: 5, mode: API_MODE[mode] }) });
  const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status);
  const pct = x => Math.round(Math.max(0, Math.min(1, x || 0)) * 100);
  return { added, sql: j.sql, by: "db", hits: j.hits.map(h => ({ d: { wo: h.wo, fam: h.fam, makes: h.makes, eq: h.eq, tr: h.tr, total: h.total }, sem: pct(h.semn ?? h.sem), kw: pct(h.kwn) })) };
}

const Meter = ({ label, value, words }) => (
  <span className={"meter" + (words ? " w" : "")}><i><b style={{ width: value + "%" }} /></i>{label} {value}%</span>
);

export default function SearchQuotes() {
  const [text, setText] = useState(EXAMPLES[0]);
  const [query, setQuery] = useState(EXAMPLES[0]);
  const [mode, setMode] = useState("both");
  const local = useMemo(() => search(query.trim(), mode), [query, mode]);
  const [db, setDb] = useState(null);
  useEffect(() => {
    let live = true; setDb(null);
    if (query.trim()) searchDb(query.trim(), mode).then(r => live && setDb(r)).catch(e => live && setDb({ by: "browser", err: e.message }));
    return () => { live = false; };
  }, [query, mode]);
  const res = db?.by === "db" ? db : local;
  const tryExample = e => { setText(e); setQuery(e); };

  return (
    <div className="searchgrid">
      <div className="pane">
        <Label>Step 3 of the bot, open for you to try</Label>
        <h2>Describe the job the way the tech or store would</h2>
        <form className="sform" onSubmit={e => { e.preventDefault(); setQuery(text); }}>
          <input type="search" autoComplete="off" aria-label="Describe the job" placeholder="e.g. slushie drink not frozen" value={text} onChange={e => setText(e.target.value)} />
          <button className="btn primary" type="submit">Search</button>
        </form>
        <div className="examples">{EXAMPLES.map(e => <button key={e} className="ex" type="button" onClick={() => tryExample(e)}>{e}</button>)}</div>
        <div className="modes" role="group" aria-label="Search method">
          {MODES.map(([m, label]) => <button key={m} type="button" className="mode" aria-pressed={mode === m} onClick={() => setMode(m)}>{label}</button>)}
        </div>
        <div className="note">{query.trim() && (db?.by === "db" ? <><Chip kind="ok">Ranked by Postgres</Chip> <span className="mono">{db.sql}</span></> : db ? <Chip kind="wait">Database not reachable, ranked in your browser</Chip> : "Asking the database...")}</div>
        <div className="note" aria-live="polite">{res?.added.length ? <>Also searched these 7-Eleven words: <b>{res.added.join(", ")}</b></> : null}</div>
        <ol className="results">
          {!res && <li className="empty">Describe a job in the box above, or pick one of the examples.</li>}
          {res && !res.hits.length && <li className="empty">No old quote shares these words. Try "Meaning only" or "Both".</li>}
          {res?.hits.map(({ d, sem, kw }, i) => (
            <li className="res" key={d.wo}>
              <span className="rk">{i + 1}</span>
              <span className="top"><span className="wonum">{d.wo}</span><Chip kind="fam">{d.fam}</Chip>{d.makes && <Chip kind="wait">{d.makes}</Chip>}</span>
              <span className="money">{d.total ? money(d.total) : ""}</span>
              <span className="tr">{d.eq}: {d.tr}</span>
              <span className="sc"><Meter label="meaning" value={sem} /><Meter label="words" value={kw} words /></span>
            </li>
          ))}
        </ol>
        {res?.hits.length > 0 && <How summary="What the percentages mean">The bars rank the results against each other. 100% means the closest of the {X.n} quotes, not a sure match.</How>}
      </div>
      <div className="pane">
        <Label>How meaning search works</Label>
        <h2>Similar meaning, not just the same words</h2>
        <ol className="howlist">
          <li>Every old quote is turned into a list of <b>{X.dim}</b> numbers that describe its meaning.</li>
          <li>Your words are turned into numbers the same way.</li>
          <li>The quotes whose numbers sit closest to yours come first.</li>
        </ol>
        <p className="note">Word search counts shared words. It is strong on makes and part names ("FBD", "magnetron"). Meaning search finds the same job told in different words. The bot uses both, plus a short list of 7-Eleven words ("slushie" means Slurpee).</p>
        <div className="minis">
          {[[X.n, "real quotes searched"], [X.dim, "numbers per quote"], [X.vocab.toLocaleString("en-US"), "words it knows"]].map(([v, t]) => (
            <div className="mini" key={t}><div className="v">{v}</div><div className="t">{t}</div></div>
          ))}
        </div>
        <p className="note">The quotes and their numbers are stored in a vector database (Postgres + pgvector on Neon). Your browser turns the words into numbers; the database finds the closest quotes. A stronger hosted model is an option for production, if a pilot shows it is needed. <a href="/lab">Open the Quote Lab</a> to add quotes, edit rates and see one stored record.</p>
      </div>
    </div>
  );
}
