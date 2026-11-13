import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evidenceFor } from "../src/lib/evidence.js";

const DATA = JSON.parse(readFileSync(new URL("../data/data.json", import.meta.url), "utf8"));
const [oven, slurpee, ice] = DATA.runs;
const lineOf = (run, fact) => evidenceFor(run).find(e => e.fact === fact).line;

test("every fact in the three samples is traced to a line of its call", () => {
  for (const r of DATA.runs) for (const e of evidenceFor(r)) {
    assert.notEqual(e.quote, null, `${r.wo}: "${e.fact}" has no line`);
    assert.equal(e.quote, r.call.lines[e.line].split(":").slice(1).join(":").trim());
  }
});

test("the line is the right one", () => {
  assert.equal(lineOf(oven, "Problem"), 0);                       // "I found the magnetron is bad ..."
  assert.equal(lineOf(oven, "Part needed: magnetron"), 2);        // "It needs a new magnetron ...", not the line that only names it
  assert.equal(lineOf(oven, "Repair hours"), 2);                  // "Repair is about 3 hours."
  assert.equal(lineOf(slurpee, "Techs"), 3);                      // "I'll need a second tech"
  assert.equal(lineOf(ice, "Price said for the float switch"), 2);
  assert.match(evidenceFor(ice).find(e => e.fact === "Price said for the inlet water valve").quote, /\$140 from the supplier/);
});

test("only the tech's own words are quoted as evidence", () => {
  for (const r of DATA.runs) for (const e of evidenceFor(r)) assert.equal(e.who, "Tech", `${r.wo}: ${e.fact}`);
});

test("a fact the call does not support comes back without a quote", () => {
  const made = { ...oven, findings: { ...oven.findings, labor_hours: 9, parts: [{ name: "compressor", qty: 1, price_said: null }] } };
  const ev = evidenceFor(made);
  assert.equal(ev.find(e => e.fact === "Repair hours").quote, null);
  assert.equal(ev.find(e => e.fact === "Part needed: compressor").quote, null);
});
