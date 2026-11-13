import { useState } from "react";
import { PERIOD, R, S, num, pc, pct1, usd } from "../data.js";
import { caseSummary, emptyCase } from "../lib/caseModel.js";
import { Bar, Fold, Kpi, Label, Tag } from "./ui.jsx";

const wait = S.wait_hours_median, lossTotal = usd(Math.abs(S.loss_total));
const lossMonth = Math.abs(S.loss_total) / PERIOD.months;

/* key, label, tag, tag text, why, step, placeholder */
const INPUTS = [
  ["quotes", "7-Eleven quotes a month", "m", "Measured", `${S.priced} priced quotes in ${PERIOD.days} days.`, 1, ""],
  ["byHand", "Minutes to write one quote by hand", "u", "Not measured", "Nobody has timed this. Time ten quotes with two dispatchers.", 1, "minutes"],
  ["withBot", "Minutes to check and approve a draft", "e", "Assumption", "A placeholder until dispatchers try it.", 1, "minutes"],
  ["hourCost", "Cost of one dispatcher hour ($)", "u", "To enter", "Pay plus overheads. Ask Finance.", 1, "dollars"],
  ["caught", "Loss jobs the checks would catch (%)", "u", "To test", `${S.loss_jobs} jobs lost ${lossTotal} in the period. Unknown until the checks are run over them.`, 5, "percent"],
  ["build", "One-time cost to build ($)", "u", "To enter", "Build time plus the first data setup.", 100, "dollars"],
  ["run", "Cost to run per month ($)", "u", "To enter", "Claude API, hosting and upkeep.", 10, "dollars"],
];
const JUDGED = [
  [`Time in "waiting for quote"`, `${wait} h median. A quarter wait longer than ${S.wait_p75} h (${S.wait_n} work orders)`, "Set after the split is measured"],
  ["Repair quotes over the NTE", `${pc(S.over_nte, S.repair_quotes)}% (${S.over_nte} of ${S.repair_quotes})`, "Not a target. The bot flags it at once, so approval is asked sooner"],
  ["Quotes that do not add up", `${S.mismatch} of ${S.priced}`, "0, because code does the sums"],
  ["Jobs that paid the tech more than we billed", `${S.loss_jobs} of ${S.invoiced_with_cost} billed jobs with a cost, ${lossTotal}`, "Set after the checks are run over them"],
  ["Quotes that name the machine make", `${pc(S.make_named, S.quotes)}% (${S.make_named} of ${S.quotes})`, "To agree. The bot asks for the make"],
  ["Search finds the same machine type", `${pct1(R.methods.both.family, R.n)} in the top 5 (${R.n} quotes)`, "Stay at or above this"],
];

/* An empty box means "not known". A typed number is kept as the person typed it. */
const toNumber = (k, v) => {
  const n = v.trim() === "" ? null : Number(v);
  if (n == null || !isFinite(n) || n < 0) return null;
  return k === "caught" ? Math.min(100, n) : n;
};
const list = a => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
const hrs = x => num(x) + " h";

export default function BusinessCase() {
  const start = emptyCase(Math.round(S.priced / PERIOD.months));
  const [raw, setRaw] = useState(() => Object.fromEntries(Object.entries(start).map(([k, v]) => [k, v == null ? "" : String(v)])));
  const st = Object.fromEntries(Object.keys(start).map(k => [k, toNumber(k, raw[k])]));
  const { lo, mid, hi, missing, ready, payback, verdict } = caseSummary(st, lossMonth);

  /* Time and money depend on the unmeasured minutes, so they are shown as a range. */
  const span = (k, f) => (mid[k] == null ? null : f(lo[k]) === f(hi[k]) ? f(mid[k]) : `${f(lo[k])} to ${f(hi[k])}`);
  const payText = !ready ? "needs the lines above"
    : payback.fast == null ? "does not pay back"
    : payback.slow == null ? `${num(payback.fast)} months, or never`
    : num(payback.fast) === num(payback.slow) ? `${num(payback.mid)} months`
    : `${num(payback.fast)} to ${num(payback.slow)} months`;
  const needMinutes = st.byHand == null ? "Needs the minutes per quote" : "Needs the inputs on the left";
  const rows = [
    ["Hours by hand", "quotes × minutes ÷ 60", span("hand", hrs) ?? "needs the minutes"],
    ["Hours with the bot", "quotes × check minutes ÷ 60", mid.bot == null ? "needs the check minutes" : hrs(mid.bot)],
    ["Hours freed", "by hand, minus with the bot", span("freed", hrs) ?? "needs the minutes"],
    ["Worth of that time", "hours freed × cost of an hour", span("timeValue", usd) ?? (mid.freed == null ? "needs the minutes" : "needs the hourly cost")],
    ["Losses avoided", `${usd(lossMonth)} lost a month × share caught`, usd(mid.loss)],
    ["Cost to run", "per month", st.run == null ? "to enter" : usd(st.run)],
    ["Net per month", "worth of time, plus losses avoided, minus cost to run", span("net", usd) ?? "needs the lines above"],
    ["Payback", "cost to build ÷ net per month", payText],
  ];
  const VERDICT = {
    unproven: ["info", "Unproven.", `The case still needs ${list(missing)}. These are the first things to collect.`],
    no: ["warn", "Does not pay on these inputs.", "The cost to run is higher than the time and losses saved. Check the inputs before deciding."],
    close: ["warn", "Too close to call.", "At the high end of the range it pays back. At the low end it never does. Time the minutes before deciding."],
    promising: ["info", "Promising on these inputs.", "It becomes proven when a pilot times the minutes per quote and the checks are run over the past loss jobs."],
  }[verdict];
  const barMax = Math.max(mid.hand || 0, mid.bot || 0) || 1;

  return (
    <>
      <div className="kpis">
        <Kpi v={st.quotes ?? "?"} unknown={st.quotes == null} t="7-Eleven quotes a month" why={st.quotes == null ? "Enter the quotes a month" : "Measured from ClickUp"} />
        <Kpi v={mid.hand == null ? "?" : hrs(mid.hand)} unknown={mid.hand == null} t="a month writing them by hand" why={mid.hand == null ? needMinutes : "Estimate until timed"} />
        <Kpi v={mid.freed == null ? "?" : hrs(mid.freed)} unknown={mid.freed == null} t="a month freed for dispatchers" why={mid.freed == null ? needMinutes : "Estimate until timed"} />
        <Kpi v={payback.mid == null ? "?" : num(payback.mid) + " mo"} unknown={payback.mid == null} t="to pay back the build"
          why={payback.mid != null ? "Estimate" : ready ? "Does not pay back on these inputs" : "Needs " + list(missing)} />
      </div>
      <div className="grid2">
        <div className="pane">
          <Label>Inputs</Label>
          <h2>Change a number and the case follows</h2>
          <div>
            {INPUTS.map(([k, label, tag, tagText, why, step, ph]) => (
              <div className="inp" key={k}>
                <label htmlFor={"in-" + k}>{label} <Tag kind={tag}>{tagText}</Tag></label>
                <input id={"in-" + k} type="number" inputMode="decimal" min="0" max={k === "caught" ? 100 : undefined} step={step} placeholder={ph}
                  value={raw[k]} onChange={e => setRaw(r => ({ ...r, [k]: e.target.value }))} />
                <span className="why">{why}</span>
              </div>
            ))}
          </div>
          <p className="note"><Tag kind="m">Measured</Tag> from the ClickUp pull in this file. <Tag kind="e">Assumption</Tag> a placeholder to test. <Tag kind="u">Not known yet</Tag> to measure, test or ask for.</p>
        </div>
        <div className="pane">
          <Label>Result per month</Label>
          <h2>Time first, money when the costs are in</h2>
          {mid.hand == null
            ? <p className="empty">Enter the minutes to write one quote by hand, and the two bars appear here.</p>
            : <>
                <Bar wide neutral label="By hand" value={mid.hand} max={barMax} num={hrs(mid.hand)} />
                {mid.bot != null && <Bar wide label="With the bot" value={mid.bot} max={barMax} num={hrs(mid.bot)} />}
              </>}
          <div className="casemath">
            {rows.map(([a, src, v]) => <div className="mathrow" key={a}><span>{a} <span className="src">{src}</span></span><span>{v}</span></div>)}
          </div>
          <div aria-live="polite"><div className={"callout " + VERDICT[0]}><b>{VERDICT[1]}</b> {VERDICT[2]}</div></div>
          <p className="note"><b>Not counted:</b> quotes reaching 7-Eleven sooner, fewer NTE surprises, and depending less on one person for half the account. They are real, and nothing in the data prices them yet.</p>
        </div>
      </div>
      <div className="pane gap">
        <Label>The open question</Label>
        <h2>How much of the {wait} hours can a bot remove?</h2>
        <p className="lead">The {wait} hours are not all writing time. A work order can also wait for a part price, for a detail from the tech, or for the dispatcher to reach it. The bot removes the writing. It cannot make a supplier answer faster. Nobody has measured the split yet.</p>
        <Label>Three moments to record in a pilot</Label>
        <ol className="moments">
          <li>The call with the tech ends.</li>
          <li>The draft is ready.</li>
          <li>The dispatcher approves it.</li>
        </ol>
        <div className="callout info"><b>The pilot passes</b> if the agreed target is met and dispatchers keep using it. <b>It stops</b> if drafts need rewriting more often than not, or a wrong price reaches a client.</div>
        <p className="note"><b>A test that needs no pilot:</b> run the checks over the {S.loss_jobs} past jobs that paid the tech more than we billed, and count how many they would have caught.</p>
      </div>
      <Fold title="What it is judged on: the numbers today and the targets to agree">
        <div className="scroll">
          <table>
            <thead><tr><th>Measure</th><th>Today</th><th>Target</th></tr></thead>
            <tbody>{JUDGED.map(r => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </Fold>
      <footer>Quotes a month = {S.priced} priced quotes ÷ {PERIOD.months.toFixed(1)} months ({S.from} to {S.to}). Hours = quotes × minutes ÷ 60. Losses a month = {lossTotal} ÷ {PERIOD.months.toFixed(1)} months. Payback = cost to build ÷ net per month. Time and money are shown as a range of plus or minus 25% around the minutes entered, because that number is not measured yet.</footer>
    </>
  );
}
