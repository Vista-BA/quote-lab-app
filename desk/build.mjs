/* Builds one offline HTML file: fonts, styles, data and the React app all inside it.
   The page makes no network request at all, so it looks the same in a meeting room with no internet.
   Usage: npm run build  ->  dist/7eleven_quote_desk_v4.html */
import { build, transform } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const at = p => fileURLToPath(new URL(p, import.meta.url));
const read = p => readFile(at(p), "utf8");
/* Text placed inside a <script> tag must not contain "<script", "</script" or "<!--".
   The "<" is written as its unicode escape, which JavaScript reads as the same character. */
const inScript = s => s.replace(/<(?=\/?script|!--)/gi, "\\u003C");

const app = await build({
  entryPoints: [at("src/main.jsx")], bundle: true, minify: true, format: "iife", target: "es2020",
  jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, legalComments: "eof", write: false,
});
/* The three typefaces named in tokens.css, Latin letters only, placed in the page as data. */
const FONTS = [["Archivo", "archivo", [500, 700, 800]], ["IBM Plex Sans", "ibm-plex-sans", [400, 500, 600]], ["IBM Plex Mono", "ibm-plex-mono", [400, 500, 600]]];
const fonts = await Promise.all(FONTS.flatMap(([family, pkg, weights]) => weights.map(async weight => {
  const file = await readFile(at(`../node_modules/@fontsource/${pkg}/files/${pkg}-latin-${weight}-normal.woff2`));
  return `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${file.toString("base64")}) format("woff2")}`;
})));

const css = await transform((await read("src/styles/tokens.css")) + "\n" + (await read("src/styles/app.css")), { loader: "css", minify: true });
const index = JSON.stringify(JSON.parse(await read("data/search-index.json")));
const data = JSON.stringify(JSON.parse(await read("data/data.json")));

/* A function as the replacement, so "$" in the data or the code is never read as a pattern. */
const html = (await read("src/index.html"))
  .replace("/*__CSS__*/", () => fonts.join("") + css.code.trim())
  .replace("/*__DATA__*/", () => inScript(`window.QD_SEM=${index};window.QD_DATA=${data};`))
  .replace("/*__APP__*/", () => inScript(app.outputFiles[0].text.trim()));

await mkdir(at("../public"), { recursive: true });
await writeFile(at("../public/index.html"), html);
const kb = n => Math.round(n / 1024).toLocaleString("en-US") + " KB";
console.log(`public/index.html (Quote Desk)  ${kb(html.length)}  (app ${kb(app.outputFiles[0].text.length)}, fonts ${kb(fonts.join("").length)}, styles ${kb(css.code.length)}, data ${kb(index.length + data.length)})`);
