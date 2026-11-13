/* Two tabs taken from Quote Desk v4: "What the data says" and "Business case".
   STUDY (the ClickUp study counts) and the case functions (calcCase, caseSummary, emptyCase from desk/src/lib/caseModel.js)
   are put in front of this file by scripts/build.mjs. Every figure is read from STUDY, never typed in. */
(() => {
const S = STUDY, R = S.recheck;
const h = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = iso => { const [, m, d] = iso.split("-").map(Number); return `${d} ${MON[m - 1]}`; };
const days = Math.round((new Date(S.to) - new Date(S.from)) / 864e5), months = days / 30.44;
const pc = (a, b) => Math.round(a / b * 100), pct1 = (a, b) => (a / b * 100).toFixed(1) + "%";
const usd = x => (x < 0 ? "-$" : "$") + Math.abs(Math.round(x)).toLocaleString("en-US");
const num = x => (Math.round(x * 10) / 10).toLocaleString("en-US"), hrs = x => num(x) + " h";
const list = a => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
const period = `${day(S.from)} to ${day(S.to)} ${S.to.slice(0, 4)}`;
const top = S.assignees[0], share = pc(top[1], S.wos), lossTotal = usd(Math.abs(S.loss_total)), lossMonth = Math.abs(S.loss_total) / months;

const kpi = (v, t, how, unknown) => `<div class="kpi"><div class="v${unknown ? " unknown" : ""}">${h(v)}</div><div class="t">${h(t)}</div>${how ? `<div class="note">${h(how)}</div>` : ""}</div>`;
const bar = (label, v, max, shown) => `<div class="bbar"><span>${h(label)}</span><span class="track"><b style="width:${max ? v / max * 100 : 0}%"></b></span><span class="money">${h(shown ?? v)}</span></div>`;
const fold = (label, title, body) => `<details class="fold pane"><summary>${label ? `<span class="label">${h(label)}</span>` : ""}<span>${h(title)}</span></summary><div class="fbody">${body}</div></details>`;
const table = (head, rows, best) => `<div class="scroll"><table class="dt"><thead><tr>${head.map(c => `<th>${h(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r, i) => `<tr${best === i ? ' class="best"' : ""}>${r.map(c => `<td>${h(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

/* ---------------- What the data says ---------------- */
function renderData() {
  const hits = Object.values(R.methods).map(m => m.family), spread = Math.max(...hits) - Math.min(...hits);
  const STORED = {keyword: "word search", vector: "meaning search", hybrid: "both", bot: "both plus the machine from the work order"};
  const issues = [
    [pc(S.over_nte, S.repair_quotes) + "%", "of repair quotes go over the NTE", `${S.over_nte} of ${S.repair_quotes}. Each needs 7-Eleven approval, so the bot flags it at once.`],
    [S.loss_jobs, "jobs paid the tech more than we billed", `Total loss ${lossTotal}. Median margin on the other jobs: ${Math.round(S.median_margin * 100)}%.`],
    [S.mismatch, "quotes where the lines don't add up to the total", `${S.mismatch} of ${S.priced}. Code pricing makes this zero.`],
    [pc(S.make_named, S.quotes) + "%", "of quotes name the machine make", `${S.make_named} of ${S.quotes}. Without the make, matching old quotes is harder, so the bot asks for it.`],
  ];
  const worked = [
    [`${S.wos} work orders`, `Every ClickUp task in the Vista space with Client = 7-Eleven, plus 1 tagged by FM only. ${period}.`],
    [`${S.quotes} quotes`, `The work orders that have quote text.`],
    [`${S.priced} priced quotes`, `The quotes that carry a total. Added up they come to ${usd(S.quoted_total)}. The middle one is ${usd(S.median_quote)}.`],
    [`${pc(S.over_nte, S.repair_quotes)}% over the NTE`, `${S.over_nte} ÷ ${S.repair_quotes} repair quotes with a total above the work order's NTE.`],
    [`${S.mismatch} do not add up`, `For each of the ${S.priced} priced quotes the lines were added up again and compared with the total written on the quote.`],
    [`${share}% with one dispatcher`, `${top[1]} ÷ ${S.wos} work orders have the same assignee.`],
    [`${S.wait_hours_median} h waiting`, `${S.wait_n} work orders have a status history through "waiting for quote". ${S.wait_hours_median} h is the middle value and ${S.wait_p75} h the 75th percentile.`],
    [`${S.loss_jobs} loss jobs`, `Of ${S.invoiced_with_cost} billed jobs that also have a tech cost, ${S.loss_jobs} paid the tech more than was billed, ${lossTotal} together.`],
    [`${pc(S.make_named, S.quotes)}% name the make`, `${S.make_named} ÷ ${S.quotes} quotes name a machine make.`],
  ];
  $("#view-data").innerHTML = `
    <div class="pane" style="margin-bottom:14px"><div class="label">What the data says</div><h2>Every 7-Eleven quote in ClickUp, ${h(period)}</h2>
      <p class="note">Counted from the ClickUp pull. Each section opens on click and shows how its number was worked out.</p></div>
    <div class="kpis">
      ${kpi(S.wos, `7-Eleven work orders in ClickUp, ${period}`)}
      ${kpi("$" + (S.quoted_total / 1e6).toFixed(2) + "M", "quoted across the priced quotes", `${S.priced} quotes carry a total. The middle one is ${usd(S.median_quote)}.`)}
      ${kpi(share + "%", "of all 7-Eleven work orders sit with one dispatcher", `${top[1]} of the ${S.wos} work orders.`)}
      ${kpi(S.wait_hours_median + " h", `median time a work order sits in "waiting for quote"`, `${S.wait_n} work orders; a quarter waited longer than ${S.wait_p75} h.`)}
    </div>
    ${fold("What breaks", `${S.families[0][0]} and ${S.families[1][0]} lead the quotes.`,
      S.families.filter(f => f[0] !== "Other").map(([k, v]) => bar(k, v, S.families[0][1])).join("") + `<p class="note">Quotes by machine type. The type is read from the work order and the quote text by rules, so a few are approximate.</p>`)}
    ${fold("Where quotes go wrong today", "Totals over the NTE, sums that do not add up, jobs that lose money, makes left out.",
      issues.map(([big, what, why]) => `<div class="issue"><span class="big">${h(big)}</span><span><b>${h(what)}</b><br><span class="note">${h(why)}</span></span></div>`).join(""))}
    ${fold("Who quotes", share >= 45 && share <= 55 ? "One dispatcher holds about half of the account." : `One dispatcher holds ${share}% of the account.`,
      [...S.assignees, ["Everyone else", S.assignee_other]].map(([k, v]) => bar(k, v, top[1])).join("") + `<p class="note">7-Eleven work orders by dispatcher. Names are replaced by letters.</p>`)}
    ${fold("Search test on the real quotes", "It finds the same machine type nearly every time, when the machine is named.",
      `<p class="note">Each old quote was treated as a new job, with itself hidden. Did the top 5 results include the same type of machine and the same make? Run on ${h(R.date)} with the browser search from Quote Desk v4; the Vector search tab here ranks in Postgres with the same mix of meaning and words.</p>` +
      table(["Search method", "Same machine type in top 5", "Same make in top 5"],
        [["words", "Word search"], ["meaning", "Meaning search"], ["both", "Both together (used here)"]].map(([k, l]) => [l, pct1(R.methods[k].family, R.n), pct1(R.methods[k].make, R.make_n)]), 2) +
      `<div class="callout"><b>The machine on the work order matters:</b> with it, both together finds the machine type for ${pct1(R.methods.both.family, R.n)} (${R.methods.both.family} of ${R.n}). From the tech's words alone it is ${pct1(R.no_machine.family, R.n)}.</div>
      <ul class="note"><li>The three methods are ${spread} quotes apart on the machine type. Word search is ahead on makes, because a make is a name, not a meaning.</li>
      <li>${R.shared_wording} of the ${R.n} quotes share their wording with another quote. With those copies hidden too, both together scores ${pct1(R.copies_hidden.family, R.n)}.</li>
      <li>Old quotes are written text. A tech on a call speaks differently, so real calls may score lower. Only a pilot can measure that.</li>
      <li>The first study stored its own table (${Object.entries(S.eval).map(([k, v]) => `${STORED[k] || k} ${(v["hit@5_family"] * 100).toFixed(1)}%`).join(", ")}). How those rows were run is not recorded, so they are not used here.</li></ul>`)}
    ${fold("The working", "How each number was worked out.", table(["Number", "How it was counted"], worked))}
    ${fold("Coverage", "What is in the data, and what is not.",
      `<div class="grid2"><div><h3>In the data</h3><ul class="note"><li>${S.wos} 7-Eleven work orders from the ClickUp Vista space, ${h(period)}, pulled 12 Nov 2026.</li><li>${S.quotes} of them have quote text.</li><li>Wait times come from the status history in an earlier pull, on 4 Nov 2026.</li></ul></div>
       <div><h3>Not in the data, or not confirmed</h3><ul class="note"><li>Work orders from before ${h(day(S.from))}.</li><li>Archived tasks, and tasks kept outside the Vista space.</li><li>Quotes that exist only in Yoda or as a PDF.</li><li>Real calls. The sample calls are invented.</li></ul></div></div>
       <p class="note">So this is every 7-Eleven quote found in ClickUp for the period. It is not proven to be every quote that was sent.</p>`)}`;
}

/* ---------------- Business case ---------------- */
const INPUTS = [ // key, label, tag kind, tag text, why, step, placeholder
  ["quotes", "7-Eleven quotes a month", "ok", "Measured", `${S.priced} priced quotes in ${days} days.`, 1, ""],
  ["byHand", "Minutes to write one quote by hand", "bad", "Not measured", "Nobody has timed this. Time ten quotes with two dispatchers.", 1, "minutes"],
  ["withBot", "Minutes to check and approve a draft", "warn", "Assumption", "A placeholder until dispatchers try it.", 1, "minutes"],
  ["hourCost", "Cost of one dispatcher hour ($)", "bad", "To enter", "Pay plus overheads. Ask Finance.", 1, "dollars"],
  ["caught", "Loss jobs the checks would catch (%)", "bad", "To test", `${S.loss_jobs} jobs lost ${lossTotal} in the period. Unknown until the checks are run over them.`, 5, "percent"],
  ["build", "One-time cost to build ($)", "bad", "To enter", "Build time plus the first data setup.", 100, "dollars"],
  ["run", "Cost to run per month ($)", "bad", "To enter", "Claude API, hosting and upkeep.", 10, "dollars"],
];
const start = emptyCase(Math.round(S.priced / months));
const raw = Object.fromEntries(Object.entries(start).map(([k, v]) => [k, v == null ? "" : String(v)]));
const toNumber = (k, v) => { const n = v.trim() === "" ? null : Number(v); if (n == null || !isFinite(n) || n < 0) return null; return k === "caught" ? Math.min(100, n) : n; };

function renderCaseShell() {
  const wait = S.wait_hours_median;
  const JUDGED = [
    [`Time in "waiting for quote"`, `${wait} h median. A quarter wait longer than ${S.wait_p75} h (${S.wait_n} work orders)`, "Set after the split is measured"],
    ["Repair quotes over the NTE", `${pc(S.over_nte, S.repair_quotes)}% (${S.over_nte} of ${S.repair_quotes})`, "Not a target. The bot flags it at once, so approval is asked sooner"],
    ["Quotes that do not add up", `${S.mismatch} of ${S.priced}`, "0, because code does the sums"],
    ["Jobs that paid the tech more than we billed", `${S.loss_jobs} of ${S.invoiced_with_cost} billed jobs with a cost, ${lossTotal}`, "Set after the checks are run over them"],
    ["Quotes that name the machine make", `${pc(S.make_named, S.quotes)}% (${S.make_named} of ${S.quotes})`, "To agree. The bot asks for the make"],
    ["Search finds the same machine type", `${pct1(R.methods.both.family, R.n)} in the top 5 (${R.n} quotes)`, "Stay at or above this"],
  ];
  $("#view-case").innerHTML = `
    <div class="kpis" id="casekpis"></div>
    <div class="grid2" style="gap:14px">
      <div class="pane"><div class="label">Inputs</div><h2>Change a number and the case follows</h2>
        <div class="form">${INPUTS.map(([k, label, kind, tagText, why, step, ph]) => `<div class="field"><label for="in-${k}">${h(label)} <span class="chip ${kind}">${h(tagText)}</span></label>
          <input id="in-${k}" data-k="${k}" type="number" inputmode="decimal" min="0"${k === "caught" ? ' max="100"' : ""} step="${step}" placeholder="${ph}" value="${h(raw[k])}"><span class="note">${h(why)}</span></div>`).join("")}</div>
        <p class="note" style="margin-top:10px"><span class="chip ok">Measured</span> from the ClickUp pull. <span class="chip warn">Assumption</span> a placeholder to test. <span class="chip bad">Not known yet</span> to measure, test or ask for.</p></div>
      <div class="pane"><div class="label">Result per month</div><h2>Time first, money when the costs are in</h2><div id="caseout"></div>
        <p class="note" style="margin-top:10px"><b>Not counted:</b> quotes reaching 7-Eleven sooner, fewer NTE surprises, and depending less on one person for half the account. They are real, and nothing in the data prices them yet.</p></div>
    </div>
    <div class="pane" style="margin-top:14px"><div class="label">The open question</div><h2>How much of the ${wait} hours can a bot remove?</h2>
      <p>The ${wait} hours are not all writing time. A work order can also wait for a part price, for a detail from the tech, or for the dispatcher to reach it. The bot removes the writing. It cannot make a supplier answer faster. Nobody has measured the split yet.</p>
      <p class="label" style="margin-top:10px">Three moments to record in a pilot</p><ol><li>The call with the tech ends.</li><li>The draft is ready.</li><li>The dispatcher approves it.</li></ol>
      <div class="callout"><b>The pilot passes</b> if the agreed target is met and dispatchers keep using it. <b>It stops</b> if drafts need rewriting more often than not, or a wrong price reaches a client.</div>
      <p class="note" style="margin-top:8px"><b>A test that needs no pilot:</b> run the checks over the ${S.loss_jobs} past jobs that paid the tech more than we billed, and count how many they would have caught.</p></div>
    ${fold("", "What it is judged on: the numbers today and the targets to agree", table(["Measure", "Today", "Target"], JUDGED))}
    <p class="note" style="margin-top:10px">Quotes a month = ${S.priced} priced quotes ÷ ${months.toFixed(1)} months (${S.from} to ${S.to}). Hours = quotes × minutes ÷ 60. Losses a month = ${lossTotal} ÷ ${months.toFixed(1)} months. Payback = cost to build ÷ net per month. Time and money are shown as a range of plus or minus 25% around the minutes entered, because that number is not measured yet.</p>`;
  $("#view-case").addEventListener("input", e => { const k = e.target.dataset?.k; if (k) { raw[k] = e.target.value; renderCase(); } });
  renderCase();
}

function renderCase() {
  const st = Object.fromEntries(Object.keys(start).map(k => [k, toNumber(k, raw[k])]));
  const {lo, mid, hi, missing, ready, payback, verdict} = caseSummary(st, lossMonth);
  const span = (k, f) => (mid[k] == null ? null : f(lo[k]) === f(hi[k]) ? f(mid[k]) : `${f(lo[k])} to ${f(hi[k])}`);
  const payText = !ready ? "needs the lines above" : payback.fast == null ? "does not pay back" : payback.slow == null ? `${num(payback.fast)} months, or never`
    : num(payback.fast) === num(payback.slow) ? `${num(payback.mid)} months` : `${num(payback.fast)} to ${num(payback.slow)} months`;
  const needMinutes = st.byHand == null ? "Needs the minutes per quote" : "Needs the inputs on the left";
  const rows = [
    ["Hours by hand", "quotes × minutes ÷ 60", span("hand", hrs) ?? "needs the minutes"],
    ["Hours with the bot", "quotes × check minutes ÷ 60", mid.bot == null ? "needs the check minutes" : hrs(mid.bot)],
    ["Hours freed", "by hand, minus with the bot", span("freed", hrs) ?? "needs the minutes"],
    ["Worth of that time", "hours freed × cost of an hour", span("timeValue", usd) ?? (mid.freed == null ? "needs the minutes" : "needs the hourly cost")],
    ["Losses avoided", `${usd(lossMonth)} lost a month × share caught`, usd(mid.loss)],
    ["Cost to run", "per month", st.run == null ? "to enter" : usd(st.run)],
    ["Net per month", "worth of time, plus losses avoided, minus cost to run", span("net", usd) ?? "needs the lines above"],
    ["Payback", "cost to build ÷ net per month", payText],
  ];
  const V = {
    unproven: ["", "Unproven.", `The case still needs ${list(missing)}. These are the first things to collect.`],
    no: ["warn", "Does not pay on these inputs.", "The cost to run is higher than the time and losses saved. Check the inputs before deciding."],
    close: ["warn", "Too close to call.", "At the high end of the range it pays back. At the low end it never does. Time the minutes before deciding."],
    promising: ["", "Promising on these inputs.", "It becomes proven when a pilot times the minutes per quote and the checks are run over the past loss jobs."],
  }[verdict];
  const barMax = Math.max(mid.hand || 0, mid.bot || 0) || 1;
  $("#casekpis").innerHTML = kpi(st.quotes ?? "?", "7-Eleven quotes a month", st.quotes == null ? "Enter the quotes a month" : "Measured from ClickUp", st.quotes == null)
    + kpi(mid.hand == null ? "?" : hrs(mid.hand), "a month writing them by hand", mid.hand == null ? needMinutes : "Estimate until timed", mid.hand == null)
    + kpi(mid.freed == null ? "?" : hrs(mid.freed), "a month freed for dispatchers", mid.freed == null ? needMinutes : "Estimate until timed", mid.freed == null)
    + kpi(payback.mid == null ? "?" : num(payback.mid) + " mo", "to pay back the build", payback.mid != null ? "Estimate" : ready ? "Does not pay back on these inputs" : "Needs " + list(missing), payback.mid == null);
  $("#caseout").innerHTML = (mid.hand == null ? `<p class="empty">Enter the minutes to write one quote by hand, and the two bars appear here.</p>`
      : bar("By hand", mid.hand, barMax, hrs(mid.hand)) + (mid.bot != null ? bar("With the bot", mid.bot, barMax, hrs(mid.bot)) : ""))
    + `<div class="casemath">${rows.map(([a, src, v]) => `<div class="mathrow"><span>${h(a)} <span class="note">${h(src)}</span></span><span class="money">${h(v)}</span></div>`).join("")}</div>`
    + `<div aria-live="polite"><div class="callout ${V[0]}"><b>${h(V[1])}</b> ${h(V[2])}</div></div>`;
}

renderData(); renderCaseShell();
})();
