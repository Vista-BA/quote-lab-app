import { DATA, SCENARIOS } from "../data.js";
import { baseHours, changes, money, moneyShort, priced, review, waitingFor } from "../lib/pricing.js";
import { phoneOnFile, stepSummary } from "../lib/steps.js";
import StepDetail, { STEPS, priceSource } from "./StepDetail.jsx";
import { Chip, How, Label, Tag } from "./ui.jsx";

const list = a => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);

/* The left pane (the five steps, each with its result, its method and the other ways to do it) lives in StepDetail.jsx.
   This file holds the work order card, the step tiles and the draft on the right. */

/* ---------- the draft (right pane) ---------- */

/* Total against the NTE, in words first. The bar only repeats what the words say. */
function NteMeter({ q, nte }) {
  const top = Math.max(q.grand, nte);
  return (
    <div className="nte">
      <div className="nte-top">
        <Tag kind={q.over ? "u" : "m"}>{q.over ? "Over the NTE" : "Within the NTE"}</Tag>
        <span className="nte-n">{money(q.grand)} of {money(nte)}</span>
      </div>
      <div className="nte-track" aria-hidden="true">
        <span className={"nte-fill" + (q.over ? " over" : "")} style={{ width: q.grand / top * 100 + "%" }} />
        {q.over && <span className="nte-mark" style={{ left: nte / top * 100 + "%" }} />}
      </div>
      <p className="note">{q.over ? `${money(q.gap)} over, so it goes to 7-Eleven for approval.` : `${money(q.gap)} of headroom.`}</p>
    </div>
  );
}

/* What a person has to settle before the quote can go.
   "To fix": code can see it is unsettled, and the box below it settles it.
   "To check": only a person can judge it, so a person ticks it. Approve stays locked until both lists are done. */
function Review({ rv, ticked, onTick, approved }) {
  const n = rv.fix.length + rv.check.length, open = rv.fix.length + rv.check.filter(c => !ticked[c.id]).length;
  const heading = approved ? `Checked before it went out (${n})` : n === 0 ? "Before it goes out (0)" : open ? `Before it goes out (${open} left)` : "Before it goes out: all done";
  return (
    <div className="review">
      <Label>{heading}</Label>
      {n === 0
        ? <p className="note">Nothing to fix or check.</p>
        : <div className="flags">
            {rv.fix.map(i => (
              <div key={i.key + i.text} className="flag bad"><span><Tag kind="u">To fix</Tag> <b>{i.key}.</b> {i.text}</span></div>
            ))}
            {rv.check.map(i => (
              <div key={i.id} className={"flag" + (ticked[i.id] ? " done" : "")}>
                <span><Tag kind={ticked[i.id] ? "m" : "e"}>{ticked[i.id] ? "Checked" : "To check"}</Tag> <b>{i.key}.</b> {i.text}</span>
                <label className="ack"><input type="checkbox" aria-label={`I checked this: ${i.key}`} checked={!!ticked[i.id]} disabled={approved} onChange={e => onTick(i.id, e.target.checked)} />I checked this</label>
              </div>
            ))}
          </div>}
    </div>
  );
}

const Line = ({ a, b, cls = "" }) => (
  <div className={("li " + cls).trim()}><span>{a}</span><span className="d" /><span className={"v" + (b === null ? " missing" : "")}>{b === null ? "price needed" : money(b)}</span></div>
);

function Ticket({ r, q, approved }) {
  const p = r.price;
  return (
    <div className="ticket rise">
      <div className="head"><span>Client quote · v{approved ? 2 : 1}</span><span>{r.wo}</span></div>
      <p>Tech Reported that {r.draft.tr}</p>
      <details className="how scope">
        <summary>Required is to: {r.draft.steps.length} steps</summary>
        <ul>{r.draft.steps.map(s => <li key={s}>{s}</li>)}</ul>
      </details>
      <div className="sec">Incurred:</div>
      {p.incurred.map(i => <Line key={i.text} a={i.text} b={i.amount} />)}
      <Line a={`Tax ${p.tax_pct}%`} b={p.incurred_tax} />
      <Line a="Total Incurred" b={p.total_incurred} cls="total" />
      <div className="sec">Additional Repair:</div>
      {q.labor.map(i => <Line key={i.text} a={i.text} b={i.amount} />)}
      {q.materials.map(i => <Line key={i.text} a={i.text} b={i.missing ? null : i.amount} />)}
      {p.fees.map(i => <Line key={i.text} a={i.text} b={i.amount} />)}
      <Line a="Total Additional" b={q.add} cls="total" />
      <Line a={`Tax ${p.tax_pct}%`} b={q.addTax} />
      <Line a="Grand Total" b={q.grand} cls="grand" />
    </div>
  );
}

/* What stays with us. None of this is on the client quote above. */
function InternalNotes({ r, q }) {
  return (
    <How summary="Internal notes, never sent to 7-Eleven">
      <dl className="facts">
        <dt>NTE</dt><dd>{money(r.nte)}</dd>
        <dt>Make</dt><dd>{r.makes.join(", ") || "not said"}</dd>
        {r.findings.model && <><dt>Model</dt><dd>{r.findings.model}</dd></>}
        <dt>Call used</dt><dd>{r.call.time}, {phoneOnFile(r) ? r.how.replace(/\+1\d{10}/, phoneOnFile(r)) : r.how}</dd>
        <dt>Old quotes used</dt><dd>{r.matches.map(m => m.wo).join(", ")}</dd>
        <dt>Price sources</dt><dd><ul className="plain">{q.materials.map(m => <li key={m.text}>{m.text}: {priceSource(m, true)}</li>)}</ul></dd>
      </dl>
    </How>
  );
}

function History({ r, did, approved }) {
  const n = did.filter(c => c.kind === "change").length;
  return (
    <How summary={`History: ${n} change${n === 1 ? "" : "s"} to the bot's draft`}>
      {/* The page does not record the order of the dispatcher's steps, so it does not number them. */}
      <p className="hist"><b>Version 1.</b> Drafted by the bot from the {r.call.time} call, using {r.matches.length} old quotes.</p>
      {did.length > 0 && <><p className="hist">Since then, by the dispatcher:</p><ul className="plain">{did.map(c => <li key={c.text}>{c.text}.</li>)}</ul></>}
      {approved && <p className="hist"><b>Version 2.</b> Approved by the dispatcher.</p>}
      <p className="note">A change is a correction of what the bot wrote. Filling a gap it flagged, or ticking a check, is not. In a pilot the changes per draft are counted: fewer means better drafts.</p>
    </How>
  );
}

export default function LiveDemo({ demo, setDemo, run, go }) {
  const { cur, done, shown, hours, approved, prices, markups, checks, face: opened } = demo;
  const r = DATA.runs[cur], typed = prices[r.wo] ?? {}, markup = markups[r.wo] ?? "", ticked = checks[r.wo] ?? {};
  const q = priced(r, hours[r.wo], typed, markup), rv = review(r, q), isApproved = !!approved[r.wo];
  const idle = done < 0, ready = done >= 5, running = !idle && !ready;
  const view = Math.min(shown, ready ? 4 : Math.max(done, 0));
  const locked = !ready || isApproved;                     /* nothing to change while the draft is building or once it is approved */
  const waits = waitingFor(q, rv, ticked), canApprove = !locked && waits.length === 0;   /* a quote with a gap or an unread note cannot go out */
  const unpriced = r.price.materials.filter(m => !m.amount);
  const did = changes(r, { hours: hours[r.wo], entered: typed, markup, ticked });

  const adj = delta => {
    if (locked) return;
    const base = hours[r.wo] ?? baseHours(r);
    setDemo(d => ({ ...d, hours: { ...d.hours, [r.wo]: Math.max(0.5, base + delta) } }));
  };
  const setPrice = (part, value) => setDemo(d => ({ ...d, prices: { ...d.prices, [r.wo]: { ...d.prices[r.wo], [part]: value } } }));
  const setMarkup = value => setDemo(d => ({ ...d, markups: { ...d.markups, [r.wo]: value } }));
  const setTick = (id, on) => setDemo(d => ({ ...d, checks: { ...d.checks, [r.wo]: { ...d.checks[r.wo], [id]: on } } }));
  const approve = () => { if (canApprove) setDemo(d => ({ ...d, approved: { ...d.approved, [r.wo]: true } })); };

  /* Each step opens on its result: picking a step, or the bot moving on to the next one, clears the view.
     The key is a second guard, so a view can never show on a step it was not opened on. */
  const faceKey = r.wo + ":" + view, face = opened?.key === faceKey ? opened.name : "result";
  const setFace = name => setDemo(d => ({ ...d, face: { key: faceKey, name } }));
  const status = isApproved ? ["ok", "quote approved"] : idle ? ["open", "assessment ongoing"] : ["wait", "waiting for quote"];
  const draftLabel = isApproved ? "Approved · version 2" : ready ? "Draft in Yoda · waiting for the dispatcher" : running ? "Draft · building" : "Draft";

  return (
    <>
      <div className="main">
        <div className="trigger">
          <div className="t">
            <Label>Work order · {SCENARIOS[cur] ?? r.wo}</Label>
            <strong>{r.wo} · {r.equipment} · {r.city}</strong>
            <span className="note">Store reported: {r.description.toLowerCase()}. NTE {moneyShort(r.nte)}. Assessment {r.paid ? "paid" : "not paid"}.</span>
            <span className="chips"><Chip kind={status[0]}>{status[1]}</Chip>{r.new_work.is_new && <Chip kind="new">never quoted this make</Chip>}</span>
          </div>
          {/* One main button per state: start the bot first, approve once the draft is there. */}
          {idle
            ? <button className="btn primary" type="button" id="run" onClick={run}>Set to waiting for quote</button>
            : <button className="btn" type="button" id="run" disabled={running} onClick={run}>{running ? "Drafting…" : "Run again"}</button>}
        </div>

        <div className="steps" role="tablist" aria-label="Bot steps">
          {STEPS.map(([s, who], i) => (
            <button key={s} type="button" role="tab" className={"step " + (i < done ? "done" : i === done ? "active" : "pending")} aria-selected={!idle && i === shown} disabled={i > done}
              onClick={() => { if (i <= done) setDemo(d => ({ ...d, shown: i, face: null })); }}>
              <span className="n">{i + 1}/5</span><span className="s">{s}</span><span className="who">{who}</span>
              {i < done && <span className="got">{stepSummary(i, r, q)}</span>}
            </button>
          ))}
        </div>

        <div className="work">
          <div className="pane" aria-live="polite">
            {/* the key restarts the small "rise" motion each time another step is shown */}
            <div className="rise" key={idle ? "waiting" : r.wo + view}>
              {idle
                ? <><Label>Waiting</Label><h2>Nothing happens until the status changes</h2><p className="note">The dispatcher does what they do today. The bot starts the moment the WO is set to waiting for quote.</p></>
                : <StepDetail i={view} r={r} q={q} face={face} moved={opened?.key === faceKey} setFace={setFace} go={go} />}
            </div>
          </div>

          <div className="pane">
            <Label>{draftLabel}</Label>
            <h2>{r.wo} · {r.equipment}</h2>
            {idle && <p className="empty">No draft yet. It appears here once the work order is set to waiting for quote.</p>}
            {running && <div className="ticket rise"><div className="head"><span>Draft</span><span>building…</span></div><p className="note">The draft appears here when step 5 finishes.</p></div>}
            {ready && (
              <>
                <NteMeter q={q} nte={r.nte} />
                <Review rv={rv} ticked={ticked} onTick={setTick} approved={isApproved} />
                {unpriced.map((m, i) => (
                  <div className="inp need" key={m.text}>
                    <label htmlFor={"price-" + i}>{m.text} price ($) {q.missing.includes(m.text) && <Tag kind="u">To fix</Tag>}</label>
                    <input id={"price-" + i} type="number" inputMode="decimal" min="0" step="0.01" placeholder="dollars" disabled={isApproved}
                      value={typed[m.text] ?? ""} onChange={e => setPrice(m.text, e.target.value)} />
                    <span className="why">The bot does not guess a price. Enter the supplier's price and code redoes the totals.</span>
                  </div>
                ))}
                {q.costParts.length > 0 && (
                  <div className="inp need">
                    <label htmlFor="markup">Markup on the supplier's prices (%) {q.needsMarkup.length > 0 && <Tag kind="u">To fix</Tag>}</label>
                    <input id="markup" type="number" inputMode="decimal" min="0" max="500" step="1" placeholder="percent" disabled={isApproved}
                      value={markup} onChange={e => setMarkup(e.target.value)} />
                    <span className="why">The tech gave the supplier's price for the {list(q.costParts).toLowerCase()}. The markup is not in this prototype's rate card, so a person sets it. Type 0 for none.</span>
                  </div>
                )}
                <div className="actions">
                  <span className="note">Hours per tech</span>
                  <span className="hours">
                    <button type="button" aria-label="Fewer hours" disabled={locked} onClick={() => adj(-0.5)}>−</button>
                    <span>{(hours[r.wo] ?? baseHours(r)) + " h"}</span>
                    <button type="button" aria-label="More hours" disabled={locked} onClick={() => adj(0.5)}>+</button>
                  </span>
                  <button className="btn primary" type="button" id="approve" disabled={!canApprove} aria-describedby={waits.length ? "approve-hint" : undefined} onClick={approve}>Approve</button>
                </div>
                {!isApproved && waits.length > 0 && <p className="note" id="approve-hint">Approve unlocks when {list(waits)}.</p>}
                {isApproved && (
                  <>
                    <div className="toast rise"><b>Approved as version 2.</b> Saved to the Client Quote field with its PDF{q.over ? ", and sent to 7-Eleven for NTE approval" : ""}. Version 1 stays in the log.</div>
                    <p className="note next">Next: <button className="linkbtn inline" type="button" onClick={() => go("case")}>see what it is worth</button>, or open Demo controls for another case.</p>
                  </>
                )}
                <Label className="sect">What 7-Eleven receives</Label>
                <Ticket r={r} q={q} approved={isApproved} />
                <div className="more">
                  {rv.assumed.length > 0 && <How summary={`What the bot assumed (${rv.assumed.length})`}><ul>{rv.assumed.map(a => <li key={a}>{a}</li>)}</ul></How>}
                  <InternalNotes r={r} q={q} />
                  <History r={r} did={did} approved={isApproved} />
                </div>
              </>
            )}
            <div className="rule">Code sets every price. AI only writes the words. Nothing goes out until the dispatcher approves.</div>
          </div>
        </div>
      </div>
      <footer>Demo calls are simulated (invented stores, phones and techs). The old quotes it matches are real 7-Eleven quotes from ClickUp. Running offline: the "AI" steps use rules today; the Claude API plugs into the same spots.</footer>
    </>
  );
}
