import { useCallback, useEffect, useRef, useState } from "react";
import { DATA } from "./data.js";
import Overview from "./components/Overview.jsx";
import LiveDemo from "./components/LiveDemo.jsx";
import SearchQuotes from "./components/SearchQuotes.jsx";
import Numbers from "./components/Numbers.jsx";
import BusinessCase from "./components/BusinessCase.jsx";
import DemoControls from "./components/DemoControls.jsx";

const TABS = [["overview", "Overview"], ["demo", "Live demo"], ["search", "Search old quotes"], ["data", "What the data says"], ["case", "Business case"]];
const fromHash = () => { const h = location.hash.slice(1); return TABS.some(t => t[0] === h) ? h : "overview"; };

/* The demo starts with nothing drafted. done: -1 = the status has not changed yet, 0 to 4 = that step is running, 5 = the draft is ready.
   face: which view of a step the viewer opened (its method, or the other ways to do it). Null means every step shows its result. */
const FRESH = { cur: 0, done: -1, shown: 0, face: null, hours: {}, approved: {}, prices: {}, markups: {}, checks: {} };

/* Drop everything the dispatcher did on one work order, so a new run starts it from scratch. */
const forget = (d, wo) => {
  const next = { ...d };
  for (const k of ["hours", "approved", "prices", "markups", "checks"]) { next[k] = { ...d[k] }; delete next[k][wo]; }
  return next;
};

/* Every screen stays mounted, so what you typed or ran is still there when you come back to a tab. */
const Panel = ({ id, tab, children }) => (
  <section id={"view-" + id} role="tabpanel" aria-labelledby={"tab-" + id} hidden={tab !== id}>{children}</section>
);

export default function App() {
  const [tab, setTabState] = useState(fromHash);
  /* One state object for the demo: which work order, how far the bot got, which step is open,
     and what the dispatcher did (hours, typed prices, markup, ticked checks, approval), each kept per work order. */
  const [demo, setDemo] = useState(FRESH);
  const [caseKey, setCaseKey] = useState(0);
  const timer = useRef(null);

  const setTab = useCallback(id => {
    setTabState(id);
    try { history.replaceState(null, "", "#" + id); } catch (e) { /* file previews may refuse this */ }
    window.scrollTo(0, 0);
  }, []);

  /* The status changes and the bot's five steps run, one every 0.9 s (at once when the viewer asked for reduced motion). */
  const run = useCallback(i => {
    clearInterval(timer.current);
    setDemo(d => { const cur = i ?? d.cur; return { ...forget(d, DATA.runs[cur].wo), cur, done: 0, shown: 0, face: null }; });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    /* each tick finishes one step and shows the next one, on its result (a view opened on the step before does not carry over) */
    timer.current = setInterval(() => setDemo(d => {
      if (d.done >= 5) return d;
      const shown = Math.min(d.done + 1, 4);
      return { ...d, done: d.done + 1, shown, face: shown === d.shown ? d.face : null };
    }), reduce ? 10 : 900);
  }, []);
  useEffect(() => { if (demo.done >= 5) clearInterval(timer.current); }, [demo.done]);
  useEffect(() => () => clearInterval(timer.current), []);

  /* Overview button: go to the live demo and start the standard job. */
  const watch = () => { setTab("demo"); run(0); };
  /* Demo controls: open a scenario and wait, so the presenter presses the one button on purpose. */
  const load = i => { clearInterval(timer.current); setDemo(d => ({ ...forget(d, DATA.runs[i].wo), cur: i, done: -1, shown: 0, face: null })); setTab("demo"); };
  const reset = () => { clearInterval(timer.current); setDemo(FRESH); setCaseKey(k => k + 1); setTab("overview"); };

  const onTabKey = e => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = TABS.findIndex(t => t[0] === tab), n = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length][0];
    setTab(n); document.getElementById("tab-" + n)?.focus(); e.preventDefault();
  };

  return (
    <div className="wrap">
      <header>
        <div className="brand"><h1>7-Eleven Quote Desk</h1><span className="sub">Prototype · how the quote bot works, on real ClickUp data</span></div>
        <div className="tabs" role="tablist" onKeyDown={onTabKey}>
          {TABS.map(([id, label]) => (
            <button key={id} type="button" className="tab" role="tab" id={"tab-" + id} aria-controls={"view-" + id} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
      </header>
      <Panel id="overview" tab={tab}><Overview onWatch={watch} go={setTab} /></Panel>
      <Panel id="demo" tab={tab}><LiveDemo demo={demo} setDemo={setDemo} run={() => run()} go={setTab} /></Panel>
      <Panel id="search" tab={tab}><SearchQuotes /></Panel>
      <Panel id="data" tab={tab}><Numbers /></Panel>
      <Panel id="case" tab={tab}><BusinessCase key={caseKey} /></Panel>
      <DemoControls current={demo.cur} onScenario={load} onReset={reset} />
    </div>
  );
}
