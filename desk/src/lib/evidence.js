/* Where on the call each fact came from. Plain text matching, no model.
   A fact with no line behind it comes back with quote = null, and the page says "not said on the call". */
import { money } from "./pricing.js";

const low = s => String(s).toLowerCase();

export function evidenceFor(run) {
  const f = run.findings;
  const lines = run.call.lines.map(l => { const [who, ...t] = l.split(":"); return { who, text: t.join(":").trim() }; });
  const at = test => { const i = lines.findIndex(l => test(low(l.text))); return i < 0 ? null : i; };

  const rows = [["Problem", null, at(l => l.includes(low(f.problem).replace(/\.$/, "")))]];
  for (const p of f.parts) {
    rows.push([`Part needed: ${p.name}`, null, at(l => l.includes("new " + low(p.name))) ?? at(l => l.includes(low(p.name)))]);
    if (p.price_said) rows.push([`Price said for the ${p.name}`, money(p.price_said), at(l => l.includes("$" + p.price_said))]);
  }
  if (f.labor_hours != null) rows.push(["Repair hours", String(f.labor_hours), at(l => new RegExp(`about ${f.labor_hours} hours?`).test(l))]);
  if (f.techs > 1) rows.push(["Techs", String(f.techs), at(l => /second tech|two techs/.test(l))]);
  if (f.overtime) rows.push(["After hours", "yes", at(l => /after hours|overtime/.test(l))]);
  for (const make of run.makes) rows.push(["Make", make, at(l => l.includes(low(make)))]);

  return rows.map(([fact, value, i]) => ({ fact, value, line: i, who: i == null ? null : lines[i].who, quote: i == null ? null : lines[i].text }));
}
