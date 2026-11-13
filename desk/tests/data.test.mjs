import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const DATA = JSON.parse(read("../data/data.json")), S = DATA.study;
const sum = rows => rows.reduce((a, r) => a + r[1], 0);

test("the study counts agree with each other", () => {
  assert.equal(sum(S.assignees) + S.assignee_other, S.wos);      // every work order has one row in "who quotes"
  assert.equal(sum(S.families), S.quotes);                       // every quote has one machine type
  assert.ok(S.priced <= S.quotes && S.quotes <= S.wos);
  assert.ok(S.over_nte <= S.repair_quotes && S.repair_quotes <= S.priced);
  assert.ok(S.mismatch <= S.priced && S.loss_jobs <= S.invoiced_with_cost);
  assert.ok(S.wait_hours_median <= S.wait_p75);
});

test("no dispatcher is named", () => {
  for (const [name] of S.assignees) assert.match(name, /^Dispatcher [A-H]$/);
});

test("the demo calls use invented work order ids and 555 phone numbers", () => {
  for (const r of DATA.runs) assert.match(r.wo, /^Demo-\d+$/);
  assert.ok(!/\+1\d{3}(?!555)\d{7}/.test(JSON.stringify(DATA.runs)), "phone numbers use the 555 exchange");
});

test("the new machine sample asks before it assumes", () => {
  const r = DATA.runs.find(x => x.new_work.is_new);
  assert.equal(r.ask_tech.length, 3);
  assert.match(r.ask_tech[0], /data plate/);
  assert.ok(r.findings.model);
  for (const s of r.web.sources) assert.equal(new URL(s.url).hostname, "secure.hoshizakiamerica.com");   // the maker's own site
  assert.ok(r.price.materials.every(m => m.price_source === "tech said"));                                // no price from the web
});

test("house rule for the words on the page: no em dashes", () => {
  /* every file under src/, whatever folder it is in, plus the README and the sample data */
  const under = dir => readdirSync(new URL(dir, import.meta.url), { withFileTypes: true }).flatMap(e => (e.isDirectory() ? under(dir + e.name + "/") : [dir + e.name]));
  const files = ["../README.md", "../data/data.json", ...under("../src/")];
  assert.ok(files.length > 15, "found " + files.length + " files");
  for (const f of files) assert.ok(!read(f).includes(String.fromCharCode(0x2014)), f + " has an em dash");
});
