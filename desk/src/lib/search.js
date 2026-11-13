/* Copied unchanged from the first prototype. */
/* In-browser quote search. Meaning = IDF-weighted average of word vectors (cosine). Words = BM25. */
export default function makeSearch(S) {
  const dim = S.dim, words = S.words.split(" "), idx = new Map(words.map((w, i) => [w, i]));
  const bin = atob(S.vec), Q = new Int8Array(bin.length); for (let i = 0; i < bin.length; i++) Q[i] = (bin.charCodeAt(i) << 24) >> 24;
  const sb = atob(S.scale), sbuf = new Uint8Array(sb.length); for (let i = 0; i < sb.length; i++) sbuf[i] = sb.charCodeAt(i);
  const scale = new Float32Array(sbuf.buffer), stop = new Set(S.stop);
  const toks = s => (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter(t => !stop.has(t) && t.length > 1);
  const docs = S.docs.map(d => ({...d, t: d.text.split(" ")})), N = docs.length;
  const df = new Map(); docs.forEach(d => new Set(d.t).forEach(t => df.set(t, (df.get(t) || 0) + 1)));
  const idf = t => Math.log((N + 1) / ((df.get(t) || 0) + 1)) + 1;
  function embed(ts) {
    const v = new Float32Array(dim);
    for (const t of ts) { const i = idx.get(t); if (i === undefined) continue; const w = idf(t) * scale[i];
      for (let k = 0; k < dim; k++) v[k] += Q[i * dim + k] * w; }
    let n = 0; for (let k = 0; k < dim; k++) n += v[k] * v[k]; n = Math.sqrt(n) || 1;
    for (let k = 0; k < dim; k++) v[k] /= n; return v;
  }
  docs.forEach(d => d.v = embed(d.t));
  const avgLen = docs.reduce((a, d) => a + d.t.length, 0) / N;
  function expand(q) {
    const base = toks(q), added = [];
    base.forEach(t => { if (S.glossary[t]) added.push(...S.glossary[t].split(" ")); });
    if (/beer cave/i.test(q)) added.push("vault", "walk");
    return {base, added: [...new Set(added)].filter(t => !base.includes(t))};
  }
  function meaning(q, k = 5) {
    const {base, added} = expand(q), v = embed([...base, ...added]);
    const known = base.filter(t => idx.has(t)).length;
    const res = docs.map(d => { let s = 0; for (let j = 0; j < dim; j++) s += d.v[j] * v[j]; return {d, s}; });
    return {added, known, total: base.length, hits: res.sort((a, b) => b.s - a.s).slice(0, k)};
  }
  function keyword(q, k = 5) {
    const {base, added} = expand(q), ts = [...new Set([...base, ...added])], k1 = 1.2, b = 0.75;
    const res = docs.map(d => { let s = 0; for (const t of ts) { const f = d.t.filter(x => x === t).length; if (!f) continue;
      s += idf(t) * f * (k1 + 1) / (f + k1 * (1 - b + b * d.t.length / avgLen)); } return {d, s}; });
    const top = res.filter(r => r.s > 0).sort((a, b) => b.s - a.s).slice(0, k), mx = top[0]?.s || 1;
    return top.map(r => ({...r, s: r.s / mx}));
  }
  function both(q, k = 5) {
    const m = meaning(q, N), kw = new Map(keyword(q, N).map(r => [r.d.wo, r.s]));
    const lo = m.hits[m.hits.length - 1].s, hi = m.hits[0].s || 1;
    const res = m.hits.map(h => ({d: h.d, sem: h.s, kw: kw.get(h.d.wo) || 0}))
      .map(r => ({...r, s: 0.6 * (r.sem - lo) / (hi - lo || 1) + 0.4 * r.kw}));
    return {added: m.added, hits: res.sort((a, b) => b.s - a.s).slice(0, k)};
  }
  /* The query as the database needs it: the same 128 numbers the browser would use, and the words for full-text search. */
  function query(q) { const {base, added} = expand(q); return {vector: Array.from(embed([...base, ...added])), words: [...base, ...added], added}; }
  return {meaning, keyword, both, query, n: N, dim, vocab: words.length};
}
