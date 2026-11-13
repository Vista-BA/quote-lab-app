/* The UI rules as checks: colours only from the token file, no text under 12px, focus rings kept,
   motion has a reduced-motion path, every button is a real button with a type, icons are hidden from screen readers. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const css = read("../src/styles/app.css"), tokens = read("../src/styles/tokens.css");
const jsx = ["../src/App.jsx", ...readdirSync(new URL("../src/components/", import.meta.url)).map(f => "../src/components/" + f)].map(f => [f, read(f)]);

test("colours live only in the token file", () => {
  assert.deepEqual(css.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g) ?? [], []);
  for (const [f, text] of jsx) assert.deepEqual(text.match(/#[0-9a-fA-F]{6}\b|rgba?\(/g) ?? [], [], f);
});

test("light and dark define the same tokens, and the two dark blocks match", () => {
  const blocks = tokens.split(/(?=@media|:root\[data-theme="dark"\])/);
  const names = b => [...b.matchAll(/(--[a-z-]+):/g)].map(m => m[1]).filter(n => !["--display", "--body", "--mono"].includes(n)).sort();
  assert.equal(blocks.length, 3);
  assert.deepEqual(names(blocks[1]), names(blocks[0]));
  const body = b => b.slice(b.indexOf("--bg"), b.lastIndexOf("color-scheme:dark")).replace(/\s+/g, " ");
  assert.equal(body(blocks[1]), body(blocks[2]));
});

test("every token used in the styles exists", () => {
  const defined = new Set([...tokens.matchAll(/(--[a-z-]+):/g)].map(m => m[1]));
  for (const [, name] of css.matchAll(/var\((--[a-z-]+)/g)) assert.ok(defined.has(name), name + " is not in tokens.css");
});

test("no text is smaller than 12px", () => {
  const sizes = [...css.matchAll(/font(?:-size)?:[^;}]*?(\d+(?:\.\d+)?)px/g)].map(m => Number(m[1]));
  assert.ok(sizes.length > 40);
  assert.ok(Math.min(...sizes) >= 12, "smallest is " + Math.min(...sizes));
});

test("focus rings are kept, and anything reset with all:unset gets one back", () => {
  assert.ok(!/outline:\s*(none|0)\b/.test(css));
  assert.match(css, /button:focus-visible,a:focus-visible\{outline:2px solid var\(--accent\)/);
  assert.match(css, /summary:focus-visible\{outline/);
});

test("motion has a reduced-motion path and never animates size", () => {
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\*\{transition:none!important;animation:none!important\}\}/);
  for (const [, body] of css.matchAll(/@keyframes [a-z-]+\{((?:[^{}]*\{[^{}]*\})*)\}/g)) assert.ok(!/width|height/.test(body));
  assert.ok(!/100vh/.test(css));
});

test("controls are real buttons with a type, and nothing else is clickable", () => {
  for (const [f, text] of jsx) {
    /* "=>" inside a handler is not the end of the tag */
    for (const tag of text.match(/<button\b(?:[^>]|=>)*>/g) ?? []) assert.match(tag, /type="(button|submit)"/, f + ": " + tag.slice(0, 80));
    assert.ok(!/<(div|span|li|p|article)\b[^>]*onClick/.test(text), f + " has a clickable non-button");
  }
});

test("icons are decoration: hidden from screen readers and always next to words", () => {
  for (const [f, text] of jsx) for (const tag of text.match(/<(Play|RotateCcw|SlidersHorizontal|X) [^>]*\/>/g) ?? []) assert.match(tag, /aria-hidden="true"/, f + ": " + tag);
});

test("every form field has a label", () => {
  for (const [f, text] of jsx) for (const tag of text.match(/<input\b(?:[^>]|=>)*>/g) ?? []) {
    const id = tag.match(/\bid=(\{[^}]*\}|"[^"]*")/)?.[1];                             // the id, written {"in-" + k} or "markup"
    assert.ok(/aria-label=/.test(tag) || (id && text.includes("htmlFor=" + id)), f + ": " + tag.slice(0, 80));
  }
});
