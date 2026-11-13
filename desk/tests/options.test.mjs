/* "Other ways": the options are choices written by a person, so the tests cannot prove them right.
   They can hold the page to its own rules: every figure comes from the data, "Used here" is really what the code does,
   and the two things the design forbids are never offered as a way to set a price. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TAGS, optionsFor } from "../src/options.js";

const DATA = JSON.parse(readFileSync(new URL("../data/data.json", import.meta.url), "utf8")), S = DATA.study, R = S.recheck;
const [oven, slurpee, ice] = DATA.runs;
const all = DATA.runs.flatMap(r => [0, 1, 2, 3, 4].map(i => [r, i, optionsFor(i, r, S, DATA.runs)]));
const pct = (a, b) => (a / b * 100).toFixed(1) + "%";
const named = (o, re) => o.items.find(it => re.test(it.name));

test("every step of every sample has its question, the choice made, and at least four ways", () => {
  assert.equal(all.length, 15);
  for (const [r, i, o] of all) {
    const at = `${r.wo} step ${i + 1}`;
    assert.match(o.ask, /\?/, at);
    assert.ok(o.choice.length > 40 && o.basis.length > 20, at);
    assert.ok(o.items.length >= 4 && o.items.length <= 7, `${at}: ${o.items.length} ways`);
    for (const it of o.items) {
      assert.ok(TAGS[it.tag], `${at}: unknown tag ${it.tag}`);
      for (const k of ["name", "gain", "cost"]) assert.ok(typeof it[k] === "string" && it[k].trim().length > 8, `${at}: ${it.name} has no ${k}`);
    }
    assert.equal(new Set(o.items.map(it => it.name)).size, o.items.length, at + ": two ways share a name");
  }
  assert.equal(optionsFor(5, oven, S, DATA.runs), null);
});

test("each step marks what this prototype really does, and lists it first", () => {
  for (const [r, i, o] of all) {
    const used = o.items.filter(it => it.tag === "used").length;
    assert.ok(used >= 1 && used <= 2, `${r.wo} step ${i + 1}`);
    assert.ok(o.items.slice(0, used).every(it => it.tag === "used"), `${r.wo} step ${i + 1}: "Used here" comes first`);
  }
});

test("the web and a guessing model are never a way to set a price or a scope", () => {
  for (const [r, , o] of all) for (const it of o.items) {
    if (/\bweb\b/i.test(it.name)) assert.equal(it.tag, "avoid", `${r.wo}: ${it.name}`);
    if (/estimate/i.test(it.name)) assert.equal(it.tag, "never", `${r.wo}: ${it.name}`);
  }
  const price = optionsFor(4, oven, S, DATA.runs);
  assert.match(named(price, /Search the web for the part/).cost, /Never as the price/);
  assert.equal(named(price, /AI estimate/).tag, "never");
  assert.equal(named(optionsFor(2, ice, S, DATA.runs), /open web/).tag, "avoid");
});

test("the figures in the search options are the ones the search test produces", () => {
  const o = optionsFor(2, oven, S, DATA.runs), { words, meaning, both } = R.methods;
  assert.deepEqual(o.measured.rows.map(row => [row.name, row.used, ...row.cells.flat()]), [
    ["Words and meaning together", true, pct(both.family, R.n), `${both.family} of ${R.n}`, pct(both.make, R.make_n), `${both.make} of ${R.make_n}`],
    ["Word search only", false, pct(words.family, R.n), `${words.family} of ${R.n}`, pct(words.make, R.make_n), `${words.make} of ${R.make_n}`],
    ["Meaning search only", false, pct(meaning.family, R.n), `${meaning.family} of ${R.n}`, pct(meaning.make, R.make_n), `${meaning.make} of ${R.make_n}`],
  ]);
  assert.deepEqual(o.measured.rows[0].cells, [["96.1%", "498 of 518"], ["72.0%", "85 of 118"]]);
  assert.match(o.choice, /only 3 quotes apart out of 518/);
  assert.match(named(o, /Words and meaning together/).cost, /84\.2% \(436 of 518\)/);
  assert.deepEqual(o.link, ["search", "Try the three searches yourself"]);
});

test("what the search options say in words is true of the figures", () => {
  const { words, meaning, both } = R.methods;
  assert.ok(both.family > words.family && both.family > meaning.family, "\"the most hits on the machine type\"");
  assert.ok(words.make > both.make && words.make > meaning.make, "\"the best of the three on makes\"");
  assert.ok(meaning.make < both.make && meaning.make < words.make, "\"the weakest of the three on makes\"");
  assert.ok((both.family - words.family) / R.n < 0.01, "\"nearly the same on the machine type\"");
  assert.ok(R.no_machine.family < both.family, "\"it drops\" without the machine name");
});

test("a make never quoted gets its own options, and only then", () => {
  assert.match(optionsFor(2, ice, S, DATA.runs).ask, /never quoted/);
  assert.match(named(optionsFor(2, ice, S, DATA.runs), /same machine type/).gain, /from the 5 ice machine quotes on file/);
  assert.equal(optionsFor(2, ice, S, DATA.runs).measured, undefined);
  for (const r of [oven, slurpee]) assert.match(optionsFor(2, r, S, DATA.runs).ask, /most like this job/);
});

test("figures quoted from the study are the study's own", () => {
  assert.match(named(optionsFor(4, oven, S, DATA.runs), /by hand/).cost, new RegExp(`^${S.mismatch} of the ${S.priced} priced quotes`));
  assert.match(named(optionsFor(3, oven, S, DATA.runs), /by hand/).cost, new RegExp(`Only ${Math.round(S.make_named / S.quotes * 100)}% of past quotes name the machine make \\(${S.make_named} of ${S.quotes}\\)`));
  assert.match(named(optionsFor(0, oven, S, DATA.runs), /No number/).cost, new RegExp(`\\(${slurpee.calls_checked} on the missing price sample\\)`));
});

test("a proposal is labelled as a proposal", () => {
  for (const [r, i, o] of all) {
    const proposes = o.items.some(it => it.tag === "next");
    assert.equal(/proposal for a pilot, not something agreed/.test(o.basis), proposes, `${r.wo} step ${i + 1}`);
    assert.equal(/measured on the past quotes/.test(o.basis), /\d+ of (the )?\d+/.test(JSON.stringify(o.items) + JSON.stringify(o.measured ?? "")), `${r.wo} step ${i + 1}: says "measured" only where a count is shown`);
  }
});

test("house rule for the words: no em dash", () => {
  assert.ok(!JSON.stringify(all.map(x => x[2])).includes(String.fromCharCode(0x2014)));
});
