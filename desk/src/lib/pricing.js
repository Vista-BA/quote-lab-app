/* Pricing and review. Code does every sum, in whole cents, so a total can never be off by a rounding error.
   Nothing in this file comes from a model. */
const toCents = x => Math.round(Number(x) * 100);
const dollars = c => c / 100;
const list = a => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);

export const money = x => "$" + Number(x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const moneyShort = x => money(x).replace(".00", "");

/** Labor lines at the hours the dispatcher set (h), or as drafted when h is undefined. */
export function laborLines(run, h) {
  return run.price.labor.map(l => {
    const m = l.text.match(/^([\d.]+) hours? labor (Tech \d)( OT)?/);
    const base = Number(m[1]), hh = h ?? base;
    const cents = Math.round(toCents(l.amount) / base * hh);   // the stored line gives the hourly rate, overtime included
    return { text: `${hh} ${hh === 1 ? "hour" : "hours"} labor ${m[2]}${m[3] || ""}`, amount: dollars(cents) };
  });
}

/** A part price typed by a person. Empty, zero, negative or not a number all mean "still missing". */
export function enteredPrice(v) {
  const n = Number(v);
  return v != null && String(v).trim() !== "" && isFinite(n) && n > 0 ? dollars(toCents(n)) : null;
}

/** A markup typed by a person, in percent. Empty means "not decided yet". Zero is a decision. */
export function enteredMarkup(v) {
  const n = Number(v);
  return v != null && String(v).trim() !== "" && isFinite(n) && n >= 0 && n <= 500 ? n : null;
}

/** The additional work, its tax and the grand total for one sample run.
    Two things only a person can settle, and the quote stays locked until they do:
    - a part with no price at all (`missing`), typed in through `entered` (part name -> price);
    - a part priced at what the supplier charges (`needsMarkup`), until `markup` (a percentage) is set. */
export function priced(run, h, entered = {}, markup = null) {
  const p = run.price, labor = laborLines(run, h), pct = enteredMarkup(markup);
  const materials = p.materials.map(m => {
    if (m.basis === "supplier cost") {
      const cost = toCents(m.amount);
      return { ...m, cost: m.amount, amount: dollars(pct == null ? cost : Math.round(cost * (100 + pct) / 100)), needsMarkup: pct == null, markup: pct };
    }
    if (m.amount) return m;
    const typed = enteredPrice(entered[m.text]);
    return { ...m, amount: typed ?? 0, missing: typed == null, byHand: typed != null };
  });
  const add = [...labor, ...materials, ...p.fees].reduce((a, b) => a + toCents(b.amount), 0);
  const addTax = Math.round(add * Math.round(p.tax_pct * 1000) / 100000);
  const grand = toCents(p.total_incurred) + add + addTax, nte = toCents(run.nte);
  return {
    labor, materials, add: dollars(add), addTax: dollars(addTax), grand: dollars(grand),
    over: grand > nte, gap: dollars(Math.abs(nte - grand)),
    missing: materials.filter(m => m.missing).map(m => m.text),
    needsMarkup: materials.filter(m => m.needsMarkup).map(m => m.text),
    costParts: materials.filter(m => m.basis === "supplier cost").map(m => m.text),
  };
}

export const baseHours = run => Number(run.price.labor[0].text.split(" ")[0]);

const sentenceCase = s => s.charAt(0) + s.slice(1).toLowerCase();

/** What stands between the draft and the client, in three lists. Nothing the bot noted is dropped.
    fix: code can see it is unsettled (no price, no markup). Approve stays locked until it is settled.
    check: only a person can judge it (a price from another machine, a make never quoted). Approve stays locked until a person ticks it.
    assumed: what the bot decided that the call did not say. Shown, not blocking.
    Going over the NTE is not in these lists: the NTE meter shows it, with the live total. */
export function review(run, q) {
  const fix = [], check = [], assumed = [];
  for (const f of run.flags) {
    const [key, ...rest] = f.split(":"), text = rest.join(":").trim().replace("->", "→");
    if (key.startsWith("OVER")) continue;
    if (key === "PRICE NEEDED") { if (q.missing.includes(text)) fix.push({ key: "Price needed", text: `${text} has no price. The bot does not guess one.` }); }
    else if (key === "Check") assumed.push(text);
    else if (/^(PRICE CHECK|NEW WORK|MODEL NEEDED)$/.test(key)) check.push({ id: f, key: sentenceCase(key), text });
    else assumed.push(`${key}: ${text}`);
  }
  if (q.needsMarkup.length) {
    fix.push({ key: "Supplier cost", text: `${list(q.needsMarkup)} ${q.needsMarkup.length > 1 ? "are" : "is"} priced at what the supplier charges, not at a client price. Set the markup.` });
  }
  return { fix, check, assumed };
}

/** The "to check" notes a person has not ticked yet. `ticked` maps a note's id to true. */
export const unticked = (rv, ticked = {}) => rv.check.filter(c => !ticked[c.id]);

/** What Approve is still waiting for, in words. Empty when the quote can go. */
export function waitingFor(q, rv, ticked = {}) {
  const open = rv ? unticked(rv, ticked).length : 0;
  return [
    ...q.missing.map(p => `${p} has a price`),
    ...(q.needsMarkup.length ? ["the markup is set"] : []),
    ...(open ? [open === 1 ? "the last check is ticked" : `${open} checks are ticked`] : []),
  ];
}

/** What the dispatcher did after the bot's draft.
    "change": the bot's draft was corrected. In a pilot, this count is the measure of how good the drafts are.
    "fill": a gap the bot itself flagged was filled in.
    "check": a note only a person can judge was looked at and ticked. */
export function changes(run, { hours, entered = {}, markup, ticked = {} } = {}) {
  const out = [], base = baseHours(run), pct = enteredMarkup(markup);
  if (hours != null && hours !== base) out.push({ kind: "change", text: `Hours per tech changed from ${base} to ${hours}` });
  for (const m of run.price.materials) {
    const typed = m.amount ? null : enteredPrice(entered[m.text]);
    if (typed != null) out.push({ kind: "fill", text: `${m.text} price typed in: ${money(typed)}` });
  }
  if (pct != null && run.price.materials.some(m => m.basis === "supplier cost")) out.push({ kind: "fill", text: `Markup on the supplier's prices set to ${pct}%` });
  for (const f of run.flags) if (ticked[f]) out.push({ kind: "check", text: `Checked by the dispatcher: ${sentenceCase(f.split(":")[0])}` });
  return out;
}

/** The rates the samples were priced with, read from the samples themselves. */
export function rateCard(runs) {
  const fees = new Map(), tax = new Map();
  for (const r of runs) {
    r.price.fees.forEach(f => fees.set(f.text, f.amount));
    tax.set(r.city.slice(-2), r.price.tax_pct);
  }
  const trip = runs[0].price.incurred.find(i => i.text === "Trip");
  return { trip: trip ? trip.amount : null, labor: runs[0].price.rate, overtime: 1.5, fees: [...fees], tax: [...tax] };
}
