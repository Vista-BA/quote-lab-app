import { DATA, S, SEM } from "../data.js";
import { evidenceFor } from "../lib/evidence.js";
import { money, moneyShort, rateCard } from "../lib/pricing.js";
import { callMatch, matchFacts, notSaid, phoneOnFile, scopeHasPrice, scopeSources, sums } from "../lib/steps.js";
import { TAGS, optionsFor } from "../options.js";
import { Chip, Label, Tag } from "./ui.jsx";

/* The five steps of the bot, and who does each one. */
export const STEPS = [["Find the call", "bot"], ["Read the call", "AI, words only"], ["Match old quotes", "bot"], ["Write the scope", "AI, words only"], ["Price it", "code, fixed rules"]];

/* Each step can be looked at in three ways. The result is what the dispatcher needs.
   The other two are for the question "how do you know?" and "could it be done another way?". */
const FACES = [["result", "Result"], ["how", "How it did it"], ["ways", "Other ways"]];

const RATES = rateCard(DATA.runs);
const list = a => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* One numbered line of a method: a short lead in bold, one or two sentences, and room for a small list under it. */
const M = ({ lead, children, more }) => <li><div><p><b>{lead}</b> {children}</p>{more}</div></li>;

/** Where one part price came from, in a few words (short) or in full (for the method and the internal notes). */
export function priceSource(m, full) {
  if (m.byHand) return "typed in by the dispatcher";
  if (m.missing) return full ? "no price yet" : "MISSING";
  if (m.basis === "supplier cost") return m.needsMarkup ? "tech said, supplier's price, markup not set" : `tech said ${money(m.cost)}, plus ${m.markup}% markup`;
  return full ? m.price_source : m.price_source.split(" (")[0];
}

/* ---------- Step 1 · Find the call ---------- */

const Find = {
  title: r => (r.paid ? "Assessment was paid, so the tech's phone is on the PPR line" : `Not paid, so the bot checked all ${r.calls_checked} dispatcher calls since "assessment ongoing"`),

  Result: ({ r }) => (
    <>
      <div className="counts">{Object.entries(r.call_types).map(([k, v]) => <Chip key={k} kind={k === "findings" ? "ok" : "wait"}>{v} {k}</Chip>)}</div>
      <Label>Picked: call at {r.call.time}{r.calls_checked > 1 ? " (matches the store and the machine)" : ""}</Label>
      {r.call.lines.map((l, i) => {
        const [w, ...t] = l.split(":");
        return <div key={i} className={"bubble" + (w === "Dispatcher" ? " d" : "")}><span className="who">{w}</span>{t.join(":")}</div>;
      })}
    </>
  ),

  How: ({ r }) => {
    const phone = phoneOnFile(r), named = callMatch(r), findings = r.call_types.findings ?? 0;
    const types = Object.entries(r.call_types).map(([k, v]) => `${v} ${k}`);
    return (
      <>
        <ol className="method">
          <M lead="Trigger.">The work order went to "waiting for quote". Nothing else starts the bot.</M>
          <M lead="Whose calls.">
            {r.paid
              ? `The assessment was paid, so the tech's phone number is on the PPR line${phone ? ` (${phone})` : ""}. The bot read ${r.calls_checked === 1 ? "the one call" : `the ${r.calls_checked} calls`} with that number.`
              : `The assessment was not paid, so no tech number is on the PPR line. The bot read all ${r.calls_checked} of the dispatcher's calls since "assessment ongoing".`}
          </M>
          <M lead="Sort.">
            {r.calls_checked === 1
              ? `One call, and it is a ${Object.keys(r.call_types)[0]} call: the tech reports what is wrong.`
              : `It gave each call a type: ${list(types)}. It is looking for a findings call, where the tech reports what is wrong.`}
          </M>
          <M lead="Pick.">
            {findings > 1 ? `Of the ${findings} findings calls, it kept` : "It kept"} the call at {r.call.time}.
            {named.store && named.machine.length > 0 ? ` That call names the store (${named.store}) and the machine ("${named.machine.join(" ")}").` : ""}
          </M>
        </ol>
        <p className="note">The calls are simulated{phone ? " and the phone number is invented" : ""}. This sample holds only the picked call, so the other calls are counted, not shown.</p>
      </>
    );
  },
};

/* ---------- Step 2 · Read the call ---------- */

/* Facts that rest on the same line of the call are shown together, in the order the lines were spoken. */
function byLine(evidence) {
  const groups = new Map();
  for (const e of evidence) {
    const g = groups.get(e.line) ?? { line: e.line, who: e.who, quote: e.quote, facts: [] };
    g.facts.push(e.fact + (e.value ? `: ${e.value}` : ""));
    groups.set(e.line, g);
  }
  return [...groups.values()].sort((a, b) => (a.line ?? 99) - (b.line ?? 99));
}

const Read = {
  title: () => "What the tech said, as quote facts",

  Result: ({ r }) => {
    const f = r.findings;
    return (
      <dl className="facts">
        <dt>Problem</dt><dd>{f.problem}</dd>
        <dt>Parts</dt><dd>{f.parts.map(p => p.name + (p.price_said ? ` (${money(p.price_said)} said)` : "")).join(", ") || "none named"}</dd>
        <dt>Repair hours</dt><dd>{f.labor_hours ?? "not said"}</dd>
        <dt>Techs</dt><dd>{f.techs}</dd>
        <dt>After hours</dt><dd>{f.overtime ? "yes, 1.5×" : "no"}</dd>
        <dt>Make</dt><dd>{r.makes.join(", ") || "not said"}</dd>
        {f.model && <><dt>Model</dt><dd>{f.model}</dd></>}
      </dl>
    );
  },

  How: ({ r }) => {
    const gaps = notSaid(r);
    return (
      <ol className="method">
        <M lead="One form for every call.">Problem, parts, repair hours, techs, after hours, make{r.findings.model ? ", model" : ""}. Always the same boxes, so code can use the answers.</M>
        {/* Every fact points back at the words it came from. Each line of the call is quoted once, under the facts it supports. */}
        <M lead="Only the tech's words count." more={
          <ul className="said">
            {byLine(evidenceFor(r)).map(g => (
              <li key={g.line ?? "none"}>
                <b>{g.facts.join(" · ")}</b>
                <span>{g.quote ? `${g.who}: "${g.quote}"` : "Not said on the call."}</span>
              </li>
            ))}
          </ul>}>
          Each answer points at the line it came from:
        </M>
        <M lead="A gap stays a gap.">
          {gaps.length ? `Not said on this call: ${list(gaps)}. The bot leaves ${gaps.length > 1 ? "these" : "this"} empty and does not guess.` : "Everything the form asks for was said on this call."}
        </M>
        <M lead="Who does the reading.">In this offline file, fixed rules stand in for the AI. The matching of each answer to its line is done by code, live, as you look at it.</M>
      </ol>
    );
  },
};

/* ---------- Step 3 · Match old quotes ---------- */

/* A make never quoted before: start from the same machine type, ask the tech for the model,
   and use only the manufacturer's manual as a reference. Old quotes and the web never set a price. */
function NewMachine({ r }) {
  return (
    <div className="callout warn">
      <b>Never quoted a {r.makes[0]} before.</b> The bot texts the tech (simulated):
      <ol className="ask">{r.ask_tech.map(a => <li key={a}>{a}</li>)}</ol>
      Until the model is known, it reads only the manufacturer's own manuals:
      <ul className="ask">{r.web.sources.map(s => <li key={s.url}><a href={s.url} target="_blank" rel="noopener">{s.title}</a></li>)}</ul>
    </div>
  );
}

const Match = {
  title: r => (r.new_work.is_new ? "New make: it starts from the same machine type and asks for the model" : `Closest past 7-Eleven quotes (${r.family})`),

  Result: ({ r }) => {
    const isNew = r.new_work.is_new;
    return (
      <>
        {isNew && <Label>Closest quotes for the same machine type</Label>}
        {r.matches.map(m => (
          <div className="match" key={m.wo}>
            <span className="pct">{Math.round(m.score * 100)}%</span>
            <span><span className="wonum">{m.wo}</span><br />{m.tr}…</span>
            <span className="money">{m.total ? money(m.total) : ""}</span>
          </div>
        ))}
        <p className="note">{isNew ? "" : "These steer the wording and the hours. "}The percentage is how close the old quote is to this call, not the chance that it is right.</p>
        {isNew && <NewMachine r={r} />}
      </>
    );
  },

  How: ({ r, go }) => {
    const mf = matchFacts(r, SEM.docs), isNew = r.new_work.is_new, n = r.matches.length;
    return (
      <>
        <ol className="method">
          <M lead="What it searched with.">The machine on the work order, "{r.equipment}", and what the tech reported.</M>
          <M lead="Where it looked.">
            {mf.total} real 7-Eleven quotes. {mf.ofType} are for this machine type ({r.family}).
            {mf.make ? (mf.ofMake ? ` ${mf.ofMake} name ${mf.make}.` : ` None names ${mf.make}.`) : ""}
          </M>
          <M lead="How it ranked them.">Two searches together. Word search counts shared words, which is strong on makes and part names. Meaning search finds the same job told in other words.</M>
          <M lead="What it kept.">
            The {n} closest. {mf.allSameType ? `All ${n} are for the same machine type` : "Not all of them are for the same machine type"}
            {mf.allSameMake ? ` and name ${mf.make}` : ""}. Code checked that against the quotes in this file.
          </M>
          {isNew && (
            <M lead="What it did about the gap." more={<p className="q">What the lookup found: {r.web.text}</p>}>
              No past quote names a {mf.make}. So it flagged the job as new work, asked the tech for the model, and read only the maker's own manuals.
            </M>
          )}
          <M lead="What the percentage means.">How close the old quote is to this call. It ranks the old quotes against each other. It is not the chance that the quote is right.</M>
        </ol>
        <p className="note">
          The {n} matches and their scores were saved with the sample. <button className="linkbtn inline" type="button" onClick={() => go("search")}>Search old quotes</button> runs
          the search live in this file, where the ranking can differ.
        </p>
      </>
    );
  },
};

/* ---------- Step 4 · Write the scope ---------- */

const KIND = { opening: "House line", part: "Part from the call", rule: "Bot's rule", closing: "House line" };

const Scope = {
  title: () => "House-style wording, no prices",

  Result: ({ r }) => (
    <>
      <p className="note">Built from the call plus the matched quotes. {r.draft.steps.length} "Required is to" lines.{r.new_work.is_new ? " On a make never quoted, the tech confirms the steps before this goes out." : ""}</p>
      <div className="ticket small">
        <p>Tech Reported that {r.draft.tr}</p>
        <div className="sec">Required is to:</div>
        <ul>{r.draft.steps.map(s => <li key={s}>{s}</li>)}</ul>
      </div>
    </>
  ),

  How: ({ r }) => {
    const src = scopeSources(r, DATA.runs), rules = src.filter(s => s.kind === "rule").length;
    const quotes = [...new Set(src.filter(s => s.kind === "part" && s.quote).map(s => s.quote))];
    return (
      <>
        <ol className="method">
          <M lead="Opening line.">House wording, with the machine from the work order.</M>
          <M lead="Two lines for each part the tech named." more={quotes.map(q => <p className="q" key={q}>Tech: "{q}"</p>)}>
            Remove the failed part, then supply and install the new one. On this call: {list(r.findings.parts.map(p => p.name))}.
          </M>
          {rules > 0 && (
            <M lead="Steps for this machine and repair.">
              {plural(rules, "line")} added by the bot's rules. {r.new_work.is_new
                ? `On a make never quoted ${rules === 1 ? "this is the least certain line" : "these are the least certain lines"}, so the tech confirms ${rules === 1 ? "it" : "them"}.`
                : `The sample does not record which old quote ${rules === 1 ? "it" : "each one"} came from.`}
            </M>
          )}
          <M lead="Closing lines.">The same on every draft.</M>
          <M lead="No prices in the words.">
            {scopeHasPrice(r) ? "A dollar amount was found in the words. Check them." : `Code checked the reported sentence and all ${src.length} lines: no dollar amount.`}
          </M>
          <M lead="Who does the writing.">In this offline file, a fixed pattern stands in for the AI.</M>
        </ol>
        <Label>Every line and where it comes from</Label>
        <ul className="srcs">
          {src.map(s => <li key={s.text}><span>{s.text}</span><span className={"k " + s.kind}>{KIND[s.kind]}</span></li>)}
        </ul>
      </>
    );
  },
};

/* ---------- Step 5 · Price it ---------- */

const Price = {
  title: () => "7-Eleven rates, applied by code",

  Result: ({ r, q }) => {
    const p = r.price;
    return (
      <>
        <div className="mathrow"><span>Trip fee</span><span>{money(RATES.trip)}</span></div>
        {q.labor.map(l => <div className="mathrow" key={l.text}><span>{l.text} <span className="src">at {moneyShort(p.rate)}/h{/OT/.test(l.text) ? " × 1.5" : ""}</span></span><span>{money(l.amount)}</span></div>)}
        {q.materials.map(m => <div className="mathrow" key={m.text}><span>{m.text} <span className="src">{priceSource(m)}</span></span><span>{m.missing ? "needed" : money(m.amount)}</span></div>)}
        {p.fees.map(m => <div className="mathrow" key={m.text}><span>{m.text} <span className="src">7-Eleven fee list</span></span><span>{money(m.amount)}</span></div>)}
        <div className="mathrow"><span>Tax <span className="src">{p.tax_pct}% (usual {r.city.slice(-2)} rate)</span></span><span>{money(p.incurred_tax + q.addTax)}</span></div>
        <p className="note">Every line names its source: the rate card, a past quote, the tech's own words, or a person. Nothing is estimated, and the totals always add up.</p>
      </>
    );
  },

  How: ({ r, q }) => {
    const p = r.price, s = sums(r, q), state = r.city.slice(-2);
    /* a price the bot took from past quotes (not typed in, not missing, not the tech's own figure) */
    const fromQuotes = q.materials.some(m => !m.byHand && !m.missing && m.basis !== "supplier cost" && /^past quotes/.test(m.price_source));
    /* one sum per labor line. When every tech has the same hours, the sum is written once. */
    const labor = [...new Set(s.labor.map(l => `${plural(l.hours, "hour")} × ${moneyShort(l.rate)}${l.factor > 1 ? ` × ${l.factor}` : ""} = ${money(l.amount)}`))];
    return (
      <>
        <ol className="method">
          <M lead="Work already done.">
            {s.incurred.items.map(i => `${i.text} ${money(i.amount)}`).join(" + ")} = {money(s.incurred.lines)}. Tax {p.tax_pct}% is {money(s.incurred.tax)}. Incurred total {money(s.incurred.total)}.
          </M>
          <M lead="Labor.">
            {labor.join(", ")}{labor.length === 1 && s.labor.length > 1 ? `, for each of the ${s.labor.length} techs` : ""}.
          </M>
          <M lead="Parts." more={
            <>
              <ul className="plain">
                {q.materials.map(m => <li key={m.text}>{m.text}: {m.missing ? "no price. The bot does not guess one." : `${money(m.amount)}. ${cap(priceSource(m, true))}.`}</li>)}
              </ul>
              {fromQuotes && <p className="q">For a price from past quotes, the sample shows one matching line as an example. It does not record which old quote the figure came from, or how one is picked when several carry the part.</p>}
            </>}>
            One source for each price:
          </M>
          {p.fees.length > 0 && <M lead="Fees.">{list(p.fees.map(f => `${f.text} ${money(f.amount)}`))}, from the 7-Eleven fee list.</M>}
          <M lead="Tax.">{p.tax_pct}% of {money(s.add)} is {money(s.addTax)}. The usual {state} rate, to confirm by the store's ZIP.</M>
          <M lead="Total against the NTE.">
            {money(s.incurred.total)} + {money(s.add)} + {money(s.addTax)} = {money(s.grand)}. The NTE is {money(r.nte)}, so the quote is {money(q.gap)} {q.over ? "over" : "under"}.
            {q.missing.length > 0 ? ` ${list(q.missing)} ${q.missing.length > 1 ? "have" : "has"} no price yet, so this total is not final.` : ""}
          </M>
        </ol>
        <Label>Rate card used</Label>
        <dl className="facts small">
          <dt>Trip</dt><dd>{money(RATES.trip)}</dd>
          <dt>Labor</dt><dd>{money(RATES.labor)} an hour</dd>
          <dt>After hours</dt><dd>× {RATES.overtime}</dd>
          <dt>Fees</dt><dd>{RATES.fees.map(([t, a]) => `${t} ${money(a)}`).join(", ")}</dd>
          <dt>Tax</dt><dd>{RATES.tax.map(([st, pct]) => `${st} ${pct}%`).join(", ")}. The usual state rate, to confirm by ZIP.</dd>
          <dt>Parts markup</dt><dd>Not in this prototype. A person sets it.</dd>
        </dl>
        <p className="note">Code does every sum in whole cents, so a total cannot be off by rounding. These are the rates the three samples were priced with. A live system reads them from the contract.</p>
      </>
    );
  },
};

/* ---------- the other ways one step could be done ---------- */

/* The dot beside each word: green = what this prototype does, accent = proposed, amber = not advised, red = never. The word carries the meaning. */
const DOT = { used: "m", next: "a", option: "", today: "", avoid: "e", never: "u" };

function Ways({ o, go }) {
  return (
    <>
      {/* The answer first: the question this step has to settle, then the choice made here and why. The other ways follow. */}
      <p className="waysq">{o.ask}</p>
      <div className="callout info choice"><b>The choice made here.</b> {o.choice}</div>
      {o.measured && (
        <div className="scroll measured">
          <table>
            <caption>{o.measured.caption}</caption>
            <thead><tr>{o.measured.head.map((h, i) => <th key={h} className={i ? "n" : undefined}>{h}</th>)}</tr></thead>
            <tbody>
              {o.measured.rows.map(row => (
                <tr key={row.name} className={row.used ? "best" : undefined}>
                  <td>{row.name}{row.used ? " (used here)" : ""}</td>
                  {row.cells.map(([big, small]) => <td key={small} className="n">{big}<span className="src">{small}</span></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ul className="ways">
        {o.items.map(it => (
          <li key={it.name} className={"way" + (it.tag === "used" ? " used" : "")}>
            <div className="way-top"><b>{it.name}</b><Tag kind={DOT[it.tag]}>{TAGS[it.tag]}</Tag></div>
            <dl><dt>What you get</dt><dd>{it.gain}</dd><dt>What it costs</dt><dd>{it.cost}</dd></dl>
          </li>
        ))}
      </ul>
      {o.link && <p className="note"><button className="linkbtn inline" type="button" onClick={() => go(o.link[0])}>{o.link[1]}</button> on the Search old quotes tab.</p>}
      <p className="note">{o.basis}</p>
    </>
  );
}

/* ---------- one step, with its three views ---------- */

const VIEWS = [Find, Read, Match, Scope, Price];

/** The left pane of the live demo for step `i`. `face` is which of the three views is open, `moved` is true once
    the viewer has switched view on this step (only then does the content rise in, so a new step does not animate twice). */
export default function StepDetail({ i, r, q, face, moved, setFace, go }) {
  const step = VIEWS[i], ways = optionsFor(i, r, S, DATA.runs);
  const Body = face === "how" ? step.How : step.Result;
  return (
    <>
      <Label>Step {i + 1} · {STEPS[i][0]}</Label>
      <h2>{step.title(r)}</h2>
      <div className="modes faces" role="group" aria-label="What to show for this step">
        {FACES.map(([id, label]) => (
          <button key={id} type="button" className="mode" aria-pressed={face === id} onClick={() => setFace(id)}>{label}{id === "ways" ? ` (${ways.items.length})` : ""}</button>
        ))}
      </div>
      <div className={moved ? "rise" : undefined} key={face}>
        {face === "ways" ? <Ways o={ways} go={go} /> : <Body r={r} q={q} go={go} />}
      </div>
    </>
  );
}
