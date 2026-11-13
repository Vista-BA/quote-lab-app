import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import makeSearch from "../src/lib/search.js";
import { searchCheck, sharedWording } from "../src/lib/searchCheck.js";

const load = p => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const SEM = load("../data/search-index.json"), DATA = load("../data/data.json"), R = DATA.study.recheck;
const X = makeSearch(SEM);

test("the index holds the real quotes", () => {
  assert.equal(X.n, 532);
  assert.equal(X.dim, 128);
  assert.equal(new Set(SEM.docs.map(d => d.wo)).size, 532);
});

test("a store's words find the right machine", () => {
  assert.equal(X.both("slushie drink not frozen").hits[0].d.fam, "Slurpee / frozen beverage");
  assert.equal(X.both("beer cave is warm").hits[0].d.fam, "Walk-in / vault");
  assert.deepEqual(X.meaning("slushie drink not frozen").added, ["slurpee", "beverage"]);   // from the 7-Eleven word list
});

test("word search returns nothing for words no quote has", () => {
  assert.deepEqual(X.keyword("zzzz qqqq"), []);
});

test("every old quote the demo matches is in the index", () => {
  const ids = new Set(SEM.docs.map(d => d.wo));
  for (const r of DATA.runs) for (const m of r.matches) assert.ok(ids.has(m.wo), `${r.wo} -> ${m.wo}`);
});

/* The percentages shown on the page. If the search code or the data changes, these fail until the stored counts are updated. */
test("search test, machine name plus the tech's words", t => {
  const c = searchCheck(X, SEM.docs);
  t.diagnostic(`same machine type ${c.family}/${c.n} = ${(c.family / c.n * 100).toFixed(1)}%, same make ${c.make}/${c.makeN} = ${(c.make / c.makeN * 100).toFixed(1)}%`);
  assert.deepEqual(c, { n: R.n, family: R.methods.both.family, make: R.methods.both.make, makeN: R.make_n });
});

test("search test, the three search methods side by side", t => {
  for (const method of ["words", "meaning", "both"]) {
    const c = searchCheck(X, SEM.docs, { method });
    t.diagnostic(`${method}: same machine type ${c.family}/${c.n} = ${(c.family / c.n * 100).toFixed(1)}%, same make ${c.make}/${c.makeN} = ${(c.make / c.makeN * 100).toFixed(1)}%`);
    assert.deepEqual([c.family, c.make], [R.methods[method].family, R.methods[method].make], method);
  }
  /* what the page says about them: close on the machine type, word search ahead on makes */
  const { words, meaning, both } = R.methods;
  assert.ok(both.family >= words.family && words.family >= meaning.family);
  assert.ok(words.make > both.make && both.make > meaning.make);
});

test("search test, the tech's words alone", t => {
  const c = searchCheck(X, SEM.docs, { withMachine: false });
  t.diagnostic(`same machine type ${c.family}/${c.n} = ${(c.family / c.n * 100).toFixed(1)}%`);
  assert.deepEqual([c.family, c.make], [R.no_machine.family, R.no_machine.make]);
});

test("search test, with copies of the same wording hidden too", t => {
  const c = searchCheck(X, SEM.docs, { hideCopies: true });
  t.diagnostic(`same machine type ${c.family}/${c.n} = ${(c.family / c.n * 100).toFixed(1)}%, same make ${(c.make / c.makeN * 100).toFixed(1)}%`);
  assert.deepEqual([c.family, c.make], [R.copies_hidden.family, R.copies_hidden.make]);
  assert.equal(sharedWording(SEM.docs), R.shared_wording);
});
