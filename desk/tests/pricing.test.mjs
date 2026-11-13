import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { baseHours, changes, enteredMarkup, enteredPrice, laborLines, money, priced, rateCard, review, unticked, waitingFor } from "../src/lib/pricing.js";

const DATA = JSON.parse(readFileSync(new URL("../data/data.json", import.meta.url), "utf8"));
const [oven, slurpee, ice] = DATA.runs;
const cents = x => Math.round(x * 100) / 100;

test("code pricing reproduces the stored total of every sample quote", () => {
  for (const r of DATA.runs) {
    const q = priced(r);
    assert.equal(q.add, r.price.additional_subtotal, r.wo + " additional subtotal");
    assert.equal(q.addTax, r.price.additional_tax, r.wo + " additional tax");
    assert.equal(q.grand, r.price.grand_total, r.wo + " grand total");
    assert.equal(q.over, r.price.over_nte, r.wo + " over NTE");
  }
  assert.deepEqual(DATA.runs.map(r => priced(r).grand), [1105.24, 2211.43, 754.5]);
});

test("the incurred lines add up to the stored incurred total", () => {
  for (const r of DATA.runs) {
    const lines = r.price.incurred.reduce((a, b) => a + b.amount, 0);
    assert.equal(cents(lines * r.price.tax_pct / 100), r.price.incurred_tax, r.wo + " incurred tax");
    assert.equal(cents(lines + r.price.incurred_tax), r.price.total_incurred, r.wo + " total incurred");
  }
});

test("sums are done in whole cents", () => {
  const run = { nte: 1, price: { tax_pct: 0, total_incurred: 0, fees: [], labor: [{ text: "1 hour labor Tech 1", amount: 0.1 }], materials: [{ text: "A", amount: 0.2, price_source: "x" }] } };
  assert.equal(priced(run).grand, 0.3);                   // 0.1 + 0.2 is 0.30000000000000004 in plain floating point
});

test("changing the hours changes labor, tax and total, and nothing else", () => {
  const q = priced(oven, 3.5);
  assert.equal(q.labor[0].amount, 451.5);                 // 3.5 h at $129
  assert.equal(q.add, 817.01);                            // 451.50 + 223.45 + 142.06
  assert.equal(q.addTax, 67.4);                           // 8.25% of 817.01
  assert.equal(q.grand, 1175.06);                         // 290.65 incurred + 817.01 + 67.40
  assert.equal(baseHours(oven), 3);
});

test("the NTE: over or within, and by how much", () => {
  assert.deepEqual([priced(oven).over, priced(oven).gap], [true, 105.24]);       // $1,105.24 against $1,000
  assert.deepEqual([priced(oven, 2).over, priced(oven, 2).gap], [false, 34.4]);  // $965.60 leaves $34.40
  assert.deepEqual([priced(ice).over, priced(ice).gap], [false, 245.5]);
});

test("two techs: one hours figure applies to both", () => {
  assert.deepEqual(priced(slurpee, 3).labor.map(l => l.amount), [387, 387]);
  assert.deepEqual(laborLines(slurpee, 1).map(l => l.text), ["1 hour labor Tech 1", "1 hour labor Tech 2"]);
});

test("a part with no price is never guessed: it stays at zero and blocks approval", () => {
  const q = priced(slurpee), rv = review(slurpee, q);
  assert.deepEqual(q.missing, ["Beater Motor"]);
  assert.deepEqual(rv.fix.map(i => i.key), ["Price needed"]);
  assert.equal(waitingFor(q, rv)[0], "Beater Motor has a price");
});

test("a missing price is typed in by a person, and code redoes the totals", () => {
  const q = priced(slurpee, undefined, { "Beater Motor": "180" });
  assert.deepEqual(q.missing, []);
  assert.equal(q.add, 1981.83);                           // 1,801.83 + 180.00
  assert.equal(q.addTax, 203.14);                         // 10.25% of 1,981.83
  assert.equal(q.grand, 2409.88);                         // 224.91 incurred + 1,981.83 + 203.14
  assert.ok(q.materials.find(m => m.text === "Beater Motor").byHand);
  assert.deepEqual(review(slurpee, q).fix, []);
});

test("only a real price counts as entered", () => {
  for (const v of ["", " ", "0", "-5", "abc", null, undefined]) assert.equal(enteredPrice(v), null, JSON.stringify(v));
  assert.equal(enteredPrice("180.5"), 180.5);
  assert.deepEqual(priced(slurpee, undefined, { "Beater Motor": "0" }).missing, ["Beater Motor"]);
});

test("a typed price never replaces a price the bot already has", () => {
  assert.equal(priced(oven, undefined, { Magnetron: "1" }).grand, 1105.24);
});

test("a supplier's price is a cost, not a client price: a person sets the markup", () => {
  const q = priced(ice);
  assert.deepEqual(q.costParts, ["Float Switch", "Inlet Water Valve"]);
  assert.deepEqual(q.needsMarkup, ["Float Switch", "Inlet Water Valve"]);
  assert.equal(q.grand, 754.5);                           // shown at cost until the markup is set
  assert.deepEqual(review(ice, q).fix.map(i => i.key), ["Supplier cost"]);
  assert.equal(waitingFor(q, review(ice, q))[0], "the markup is set");
});

test("with a markup of 30%, code reprices the supplier's parts and the totals", () => {
  const q = priced(ice, undefined, {}, "30");
  assert.deepEqual(q.materials.map(m => m.amount), [123.5, 182]);   // $95.00 and $140.00 plus 30%
  assert.equal(q.add, 563.5);                             // 258.00 labor + 123.50 + 182.00
  assert.equal(q.addTax, 46.49);                          // 8.25% of 563.50
  assert.equal(q.grand, 830.82);                          // 220.83 incurred + 563.50 + 46.49
  assert.deepEqual(q.needsMarkup, []);
  assert.deepEqual(review(ice, q).fix, []);
});

test("a markup of zero is a decision, an empty box is not", () => {
  assert.equal(enteredMarkup("0"), 0);
  for (const v of ["", " ", "-1", "abc", "501", null, undefined]) assert.equal(enteredMarkup(v), null, JSON.stringify(v));
  assert.deepEqual(priced(ice, undefined, {}, "0").needsMarkup, []);
  assert.equal(priced(ice, undefined, {}, "0").grand, 754.5);
  assert.deepEqual(priced(oven, undefined, {}, "30").grand, 1105.24);   // no supplier-cost parts, so nothing moves
});

test("review: every stored note reaches the dispatcher in one of three lists", () => {
  for (const r of DATA.runs) {
    const rv = review(r, priced(r));
    const stored = r.flags.filter(f => !f.startsWith("OVER")).length;        // the NTE meter carries that one
    const generated = rv.fix.filter(i => i.key === "Supplier cost").length;  // added by code, not stored
    assert.equal(rv.fix.length + rv.check.length + rv.assumed.length - generated, stored, r.wo);
  }
  assert.deepEqual(review(oven, priced(oven)), { fix: [], check: [], assumed: ["Tax 8.25% is the usual TX rate: confirm the store ZIP rate"] });
  assert.deepEqual(review(slurpee, priced(slurpee)).check.map(i => i.key), ["Price check"]);
  const rv = review(ice, priced(ice));
  assert.deepEqual(rv.check.map(i => i.key), ["New work", "Model needed"]);
  assert.ok(rv.assumed.includes("Assessment time not said: incurred uses 1 hour"));
});

test("a note only a person can judge has to be ticked before Approve unlocks", () => {
  // the standard job has no such note, so the happy path needs no tick
  assert.deepEqual(waitingFor(priced(oven), review(oven, priced(oven))), []);

  // missing price: typing the price is not enough, the borrowed price still has to be looked at
  const q = priced(slurpee, undefined, { "Beater Motor": "180" }), rv = review(slurpee, q);
  assert.deepEqual(waitingFor(q, rv), ["the last check is ticked"]);
  assert.deepEqual(waitingFor(q, rv, { [rv.check[0].id]: true }), []);

  // new machine: the markup and both notes
  const q5 = priced(ice, undefined, {}, "30"), rv5 = review(ice, q5), [a, b] = rv5.check;
  assert.deepEqual(waitingFor(priced(ice), review(ice, priced(ice))), ["the markup is set", "2 checks are ticked"]);
  assert.deepEqual(waitingFor(q5, rv5), ["2 checks are ticked"]);
  assert.deepEqual(waitingFor(q5, rv5, { [a.id]: true }), ["the last check is ticked"]);
  assert.deepEqual(unticked(rv5, { [a.id]: true }).map(c => c.key), ["Model needed"]);
  assert.deepEqual(waitingFor(q5, rv5, { [a.id]: true, [b.id]: true }), []);
  assert.deepEqual(waitingFor(q5, rv5, { [a.id]: true, [b.id]: false }), ["the last check is ticked"]);   // unticking locks it again
});

test("every check has its own id, so one tick cannot settle another", () => {
  for (const r of DATA.runs) { const ids = review(r, priced(r)).check.map(c => c.id); assert.equal(new Set(ids).size, ids.length, r.wo); }
});

test("history: a correction is a change, filling a flagged gap is not", () => {
  assert.deepEqual(changes(oven, {}), []);
  assert.deepEqual(changes(oven, { hours: 3 }), []);                                    // set back to the bot's figure
  assert.deepEqual(changes(oven, { hours: 3.5 }), [{ kind: "change", text: "Hours per tech changed from 3 to 3.5" }]);
  assert.deepEqual(changes(slurpee, { entered: { "Beater Motor": "180" } }), [{ kind: "fill", text: "Beater Motor price typed in: $180.00" }]);
  assert.deepEqual(changes(ice, { markup: "30" }), [{ kind: "fill", text: "Markup on the supplier's prices set to 30%" }]);
  assert.deepEqual(changes(oven, { markup: "30" }), []);                                // no supplier-cost parts on this job
  const rv = review(ice, priced(ice));
  assert.deepEqual(changes(ice, { ticked: { [rv.check[0].id]: true, [rv.check[1].id]: false } }), [{ kind: "check", text: "Checked by the dispatcher: New work" }]);
});

test("the rate card is read from the samples, not typed twice", () => {
  const rc = rateCard(DATA.runs);
  assert.deepEqual([rc.trip, rc.labor, rc.overtime], [75, 129, 1.5]);
  assert.deepEqual(rc.fees, [["Leak test fee", 50], ["Recovery tank fee", 50], ["Vacuum fee", 50]]);
  assert.deepEqual(rc.tax, [["TX", 8.25], ["IL", 10.25]]);
});

test("money is written with two decimals and thousands separators", () => {
  assert.equal(money(1105.24), "$1,105.24");
  assert.equal(money(75), "$75.00");
});
