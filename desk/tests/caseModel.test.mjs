import test from "node:test";
import assert from "node:assert/strict";
import { calcCase, caseSummary, emptyCase } from "../src/lib/caseModel.js";

/* Same loss figure the page uses: $7,098 over 156 days. */
const lossMonth = 7098 / (156 / 30.44);
const one = x => Math.round(x * 10) / 10;
const filled = { quotes: 100, byHand: 20, withBot: 5, hourCost: 30, caught: 25, build: 6000, run: 150 };

test("an empty case invents nothing", () => {
  const s = caseSummary(emptyCase(100), lossMonth);
  assert.equal(s.verdict, "unproven");
  assert.deepEqual(s.missing, ["the minutes per quote", "the cost of a dispatcher hour", "the cost to build", "the cost to run"]);
  assert.equal(s.mid.hand, null);
  assert.equal(s.mid.net, null);
  assert.equal(s.payback.mid, null);
  assert.equal(one(s.mid.bot), 8.3);            // 100 quotes x 5 minutes is known
});

test("worked example: hours, money and payback", () => {
  const m = calcCase(filled, lossMonth);
  assert.equal(one(m.hand), 33.3);              // 100 x 20 / 60
  assert.equal(one(m.bot), 8.3);                // 100 x 5 / 60
  assert.equal(m.freed, 25);
  assert.equal(m.timeValue, 750);               // 25 h x $30
  assert.equal(Math.round(m.loss), 346);        // 25% of $1,385 a month
  assert.equal(Math.round(m.net), 946);         // 750 + 346 - 150
  const s = caseSummary(filled, lossMonth);
  assert.equal(s.verdict, "promising");
  assert.deepEqual([one(s.payback.fast), one(s.payback.mid), one(s.payback.slow)], [5, 6.3, 8.6]);
});

test("the range is plus or minus 25% on the minutes by hand only", () => {
  const s = caseSummary(filled, lossMonth);
  assert.equal(s.lo.hand, 25);
  assert.equal(one(s.hi.hand), 41.7);
  assert.equal(s.lo.bot, s.hi.bot);
});

test("a running cost above the benefit never pays back", () => {
  const s = caseSummary({ ...filled, run: 5000 }, lossMonth);
  assert.equal(s.verdict, "no");
  assert.equal(s.payback.fast, null);
});

test("pays at the high end only: too close to call", () => {
  const s = caseSummary({ ...filled, run: 900 }, lossMonth);
  assert.equal(s.verdict, "close");
  assert.equal(s.payback.slow, null);
  assert.ok(s.payback.fast > 0);
});

test("the bot cannot free negative hours", () => {
  assert.equal(calcCase({ ...filled, byHand: 3 }, lossMonth).freed, 0);
});

test("clearing a measured input is reported as missing", () => {
  assert.deepEqual(caseSummary({ ...filled, quotes: null }, lossMonth).missing, ["the quotes a month"]);
});
