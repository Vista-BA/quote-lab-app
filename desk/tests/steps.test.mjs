/* "How it did it": what each step says about its own work has to be true of the sample, so it is worked out by code and checked here. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { priced } from "../src/lib/pricing.js";
import { callMatch, matchFacts, notSaid, phoneOnFile, scopeHasPrice, scopeSources, stepSummary, sums } from "../src/lib/steps.js";

const load = p => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const DATA = load("../data/data.json"), SEM = load("../data/search-index.json");
const [oven, slurpee, ice] = DATA.runs;
const cents = x => Math.round(x * 100);

test("step 1: the picked call names the store and the machine of its work order", () => {
  for (const r of DATA.runs) {
    const m = callMatch(r);
    assert.equal(m.store, String(r.store), r.wo);
    assert.ok(m.machine.length >= 2, `${r.wo}: ${m.machine}`);
  }
  assert.deepEqual(callMatch(oven).machine, ["TurboChef", "oven"]);      // as the tech said it, not as the work order spells it
  assert.deepEqual(callMatch(ice).machine, ["ice", "machine"]);
});

test("step 1: a call about another store or machine is not said to match", () => {
  const other = { ...oven, store: 99999, equipment: "Coffee Brewer" };
  assert.deepEqual(callMatch(other), { store: null, machine: [] });
});

test("step 1: a phone number is shown only when the sample holds one, and it is an invented 555 number", () => {
  assert.equal(phoneOnFile(oven), "+1 214 555 0141");
  assert.equal(phoneOnFile(slurpee), null);                               // not paid, so no tech number on the PPR line
  for (const r of DATA.runs.filter(x => x.paid)) assert.match(phoneOnFile(r), /^\+1 \d{3} 555 \d{4}$/);
});

test("step 2: what the tech did not say stays empty", () => {
  assert.deepEqual(notSaid(oven), ["a price for the magnetron", "a price for the high voltage capacitor"]);
  assert.deepEqual(notSaid(slurpee), ["a price for the expansion valve", "a price for the beater motor"]);
  assert.deepEqual(notSaid(ice), ["the exact model"]);                    // both prices were said on this call
  assert.ok(notSaid({ ...oven, findings: { ...oven.findings, labor_hours: null } }).includes("the repair hours"));
});

test("step 3: the counts come from the index, and agree with the sample", () => {
  for (const r of DATA.runs) {
    const mf = matchFacts(r, SEM.docs);
    assert.equal(mf.total, 532);
    assert.equal(mf.ofType, r.new_work.family_quotes, r.wo);
    assert.ok(mf.rows.every(x => x.found), r.wo);
    assert.ok(mf.allSameType, r.wo + ": every stored match is for the same machine type");
  }
  assert.deepEqual([matchFacts(oven, SEM.docs).ofMake, matchFacts(slurpee, SEM.docs).ofMake, matchFacts(ice, SEM.docs).ofMake], [21, 12, 0]);
});

test("step 3: a make counts as never quoted only when no past quote names it", () => {
  for (const r of DATA.runs) assert.equal(matchFacts(r, SEM.docs).ofMake === 0, r.new_work.is_new, r.wo);
  assert.ok(matchFacts(oven, SEM.docs).allSameMake && matchFacts(slurpee, SEM.docs).allSameMake);
  assert.equal(matchFacts(ice, SEM.docs).allSameMake, false);
});

test("step 4: every line of the scope gets exactly one source", () => {
  for (const r of DATA.runs) {
    const src = scopeSources(r, DATA.runs);
    assert.deepEqual(src.map(s => s.text), r.draft.steps);
    for (const s of src) assert.ok(["opening", "part", "rule", "closing"].includes(s.kind), s.text);
    assert.equal(src[0].kind, "opening");
    assert.deepEqual(src.slice(-3).map(s => s.kind), ["closing", "closing", "closing"]);
    assert.equal(src.filter(s => s.kind === "part").length, r.findings.parts.length * 2, r.wo + ": two lines for each part");
  }
  assert.deepEqual(scopeSources(oven, DATA.runs).map(s => s.kind[0]).join(""), "orppppccc");
  assert.deepEqual(scopeSources(slurpee, DATA.runs).filter(s => s.kind === "rule").map(s => s.text),
    ["Shut off the water and CO₂ supplies", "Perform leak test on all brazed connections", "Pull a deep vacuum and recharge the system"]);
});

test("step 4: a part line carries the tech's own sentence, and that sentence names the part", () => {
  for (const r of DATA.runs) for (const s of scopeSources(r, DATA.runs).filter(x => x.kind === "part")) {
    assert.ok(s.quote, `${r.wo}: ${s.text}`);
    assert.ok(s.quote.toLowerCase().includes(s.part), `${r.wo}: "${s.part}" is not in the quoted line`);
  }
});

test("step 4: a line is called a house closing line only when every sample has it", () => {
  const alone = scopeSources(oven, [oven]);                               // nothing to compare with, so nothing is called a house line by repetition
  assert.equal(alone.filter(s => s.kind === "closing").length, 0);
  const odd = { ...oven, draft: { ...oven.draft, steps: [...oven.draft.steps.slice(0, -1), "Polish the door"] } };
  assert.equal(scopeSources(odd, [odd, slurpee, ice]).at(-1).kind, "rule");
});

test("step 4: the words carry no price", () => {
  for (const r of DATA.runs) assert.equal(scopeHasPrice(r), false, r.wo);
  assert.equal(scopeHasPrice({ draft: { tr: "the fan failed", steps: ["Supply one new fan for $40"] } }), true);
  assert.equal(scopeHasPrice({ draft: { tr: "the fan costs 40 dollars", steps: [] } }), true);
});

test("step 5: every sum printed on the page can be redone with a calculator", () => {
  for (const r of DATA.runs) {
    const q = priced(r), s = sums(r, q);
    assert.equal(cents(s.incurred.lines) + cents(s.incurred.tax), cents(s.incurred.total), r.wo + " incurred");
    assert.equal(cents(s.incurred.lines), r.price.incurred.reduce((a, b) => a + cents(b.amount), 0));
    for (const l of s.labor) assert.equal(cents(l.hours * l.rate * l.factor), cents(l.amount), `${r.wo}: ${l.text}`);
    assert.equal(cents(s.incurred.total) + cents(s.add) + cents(s.addTax), cents(s.grand), r.wo + " grand total");
    assert.ok(s.adds);
  }
});

test("step 5: the sums follow the dispatcher's changes", () => {
  const s = sums(oven, priced(oven, 3.5));
  assert.deepEqual([s.labor[0].hours, s.labor[0].amount, s.grand], [3.5, 451.5, 1175.06]);
  const two = sums(slurpee, priced(slurpee, 2, { "Beater Motor": "180" }));
  assert.deepEqual(two.labor.map(l => [l.hours, l.rate, l.factor, l.amount]), [[2, 129, 1, 258], [2, 129, 1, 258]]);
  assert.ok(two.adds);
  const overtime = { ...oven, price: { ...oven.price, labor: [{ text: "2 hours labor Tech 1 OT", amount: 387 }] } };
  assert.deepEqual(sums(overtime, priced(overtime)).labor.map(l => [l.hours, l.factor, l.amount]), [[2, 1.5, 387]]);   // 2 h at $129 times 1.5
});

test("the step tiles say what each step produced", () => {
  const tiles = r => [0, 1, 2, 3, 4].map(i => stepSummary(i, r, priced(r)));
  assert.deepEqual(tiles(oven), ["Call at 10:40", "2 parts, 3 hours", "3 close quotes", "9 lines, no prices", "$1,105.24"]);
  assert.deepEqual(tiles(slurpee), ["Call at 15:05", "2 parts, 4 hours, 2 techs", "3 close quotes", "11 lines, no prices", "1 price missing"]);
  assert.deepEqual(tiles(ice), ["Call at 15:00", "2 parts, 2 hours", "New make, model asked", "10 lines, no prices", "$754.50"]);
  assert.equal(stepSummary(4, slurpee, priced(slurpee, undefined, { "Beater Motor": "180" })), "$2,409.88");   // the tile follows the typed price
  assert.equal(stepSummary(9, oven, priced(oven)), "");
});
