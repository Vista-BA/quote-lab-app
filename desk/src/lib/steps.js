/* What each of the five steps can say about its own work on one sample.
   Everything here is worked out by code from the sample itself, so the "How it did it" view cannot drift from the data.
   Where the sample does not hold an answer (for example which old quote a scope line came from), these functions say so
   and the page prints that, instead of a guess. */
import { evidenceFor } from "./evidence.js";
import { money } from "./pricing.js";

const low = s => String(s).toLowerCase();
const cents = x => Math.round(Number(x) * 100);
const makesOf = d => (d && d.makes ? d.makes.split(/,\s*/) : []);
const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;

/** Step 1. The tech's phone number kept with the sample, written the way a person reads it. Null when there is none. */
export function phoneOnFile(run) {
  const m = String(run.how).match(/\+1(\d{3})(\d{3})(\d{4})/);
  return m ? `+1 ${m[1]} ${m[2]} ${m[3]}` : null;
}

/** Step 1. Does the picked call name this store and this machine? Returns the words as they were said on the call. */
export function callMatch(run) {
  const text = run.call.lines.join(" ");
  const said = w => text.match(new RegExp(`\\b${w}\\b`, "i"))?.[0] ?? null;
  const machine = [...new Set(low(run.equipment).match(/[a-z]+/g) ?? [])].map(said).filter(Boolean);
  return { store: said(String(run.store)), machine };
}

/** Step 2. What the form has a box for and the tech did not say. These boxes stay empty: the bot does not fill them in. */
export function notSaid(run) {
  const f = run.findings, out = [];
  for (const p of f.parts) if (!p.price_said) out.push(`a price for the ${p.name}`);
  if (f.labor_hours == null) out.push("the repair hours");
  if (f.model) out.push("the exact model");
  return out;
}

/** Step 3. What code can check about the stored matches: how many quotes there are to search,
    how many share the machine type and the make, and whether each match shares them too. */
export function matchFacts(run, docs) {
  const make = run.makes[0] ?? null, byWo = new Map(docs.map(d => [d.wo, d]));
  const rows = run.matches.map(m => {
    const d = byWo.get(m.wo);
    return { wo: m.wo, found: !!d, sameType: !!d && d.fam === run.family, sameMake: !!make && makesOf(d).includes(make), makes: makesOf(d) };
  });
  return {
    total: docs.length, make, rows,
    ofType: docs.filter(d => d.fam === run.family).length,
    ofMake: make ? docs.filter(d => makesOf(d).includes(make)).length : 0,
    allSameType: rows.every(x => x.sameType),
    allSameMake: rows.length > 0 && rows.every(x => x.sameMake),
  };
}

/** Step 4. Where each line of the scope comes from, as far as code can tell. One kind per line:
    "part"    names a part the tech asked for (with the tech's own sentence),
    "opening" the house opening line with the machine from the work order,
    "closing" a line that is the same on every sample draft,
    "rule"    added by the bot's rules. The sample stores no source for these, and the page says so. */
export function scopeSources(run, runs) {
  const onEvery = s => runs.length > 1 && runs.every(x => x.draft.steps.includes(s));
  const said = new Map(evidenceFor(run).filter(e => e.fact.startsWith("Part needed: ")).map(e => [e.fact.slice("Part needed: ".length), e.quote]));
  return run.draft.steps.map((text, i) => {
    const part = run.findings.parts.find(p => low(text).includes(low(p.name)));
    if (part) return { text, kind: "part", part: part.name, quote: said.get(part.name) ?? null };
    if (i === 0 && text.startsWith("Full inspection of the ")) return { text, kind: "opening" };
    if (onEvery(text)) return { text, kind: "closing" };
    return { text, kind: "rule" };
  });
}

/** Step 4. True if a dollar amount has slipped into the words of the quote. The words must never carry a price. */
export const scopeHasPrice = run => [run.draft.tr, ...run.draft.steps].some(s => /\$|\bdollars?\b/i.test(s));

/** Step 5. The sums in the order code does them, as figures a person can check with a calculator.
    `q` is the priced quote from pricing.js, so the hours, typed prices and markup set by the dispatcher are included. */
export function sums(run, q) {
  const p = run.price;
  const hoursOf = text => Number(text.split(" ")[0]), factorOf = text => (/ OT$/.test(text) ? 1.5 : 1);
  const incurredLines = p.incurred.reduce((a, b) => a + cents(b.amount), 0);
  return {
    incurred: { items: p.incurred, lines: incurredLines / 100, tax: p.incurred_tax, total: p.total_incurred },
    labor: q.labor.map(l => ({ ...l, hours: hoursOf(l.text), rate: p.rate, factor: factorOf(l.text) })),
    add: q.add, addTax: q.addTax, grand: q.grand,
    /* the three parts of the grand total, so the page can print the addition */
    adds: cents(p.total_incurred) + cents(q.add) + cents(q.addTax) === cents(q.grand),
  };
}

/** One short line for the tile of a finished step: what that step produced. */
export function stepSummary(i, run, q) {
  const f = run.findings;
  switch (i) {
    case 0: return `Call at ${run.call.time}`;
    case 1: return [plural(f.parts.length, "part"), f.labor_hours == null ? "hours not said" : plural(f.labor_hours, "hour"), ...(f.techs > 1 ? [plural(f.techs, "tech")] : [])].join(", ");
    case 2: return run.new_work.is_new ? "New make, model asked" : plural(run.matches.length, "close quote");
    case 3: return `${plural(run.draft.steps.length, "line")}, ${scopeHasPrice(run) ? "check the words" : "no prices"}`;
    case 4: return q.missing.length ? `${plural(q.missing.length, "price")} missing` : money(q.grand);
    default: return "";
  }
}
