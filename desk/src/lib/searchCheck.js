/* The search test. Hide one old quote, search for it, and see whether the top 5 hold the same machine type and the same make.
   Run by `npm test`, so the percentages on the page are the ones this code produces. */
const wording = d => (d.tr || "").trim().toLowerCase();
const makes = d => (d.makes ? d.makes.split(/,\s*/) : []);
const tested = docs => docs.filter(d => wording(d) && d.fam !== "Other");

/* The three ways to search. "both" blends the other two and is what the page uses. */
const METHODS = {
  both: (X, q) => X.both(q, 60).hits,
  words: (X, q) => X.keyword(q, 60),
  meaning: (X, q) => X.meaning(q, 60).hits,
};

/** withMachine: put the machine name from the work order in the query. hideCopies: also hide quotes with the same wording.
    method: "both", "words" or "meaning", so the three can be compared on the same test. */
export function searchCheck(X, allDocs, { withMachine = true, hideCopies = false, method = "both" } = {}) {
  let family = 0, make = 0, makeN = 0;
  const docs = tested(allDocs), find = METHODS[method];
  for (const d of docs) {
    const q = ((withMachine ? d.eq + " " : "") + d.tr).trim();
    const hits = find(X, q).filter(h => h.d.wo !== d.wo && !(hideCopies && wording(h.d) === wording(d))).slice(0, 5);
    if (hits.some(h => h.d.fam === d.fam)) family++;
    if (makes(d).length) { makeN++; if (hits.some(h => makes(h.d).some(m => makes(d).includes(m)))) make++; }
  }
  return { n: docs.length, family, make, makeN };
}

/** How many of the tested quotes share their wording with another quote (copies and repeat jobs). */
export function sharedWording(allDocs) {
  const seen = new Map();
  allDocs.forEach(d => { if (wording(d)) seen.set(wording(d), (seen.get(wording(d)) || 0) + 1); });
  return tested(allDocs).filter(d => seen.get(wording(d)) > 1).length;
}
