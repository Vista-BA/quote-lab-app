import { R, S, X, pc, pct1, usd } from "../data.js";
import { moneyShort } from "../lib/pricing.js";
import { Bar, Fold, How, Kpi, Label } from "./ui.jsx";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = iso => { const [, m, d] = iso.split("-").map(Number); return `${d} ${MON[m - 1]}`; };
/* The search test as run by this build (data.study.recheck.methods), and the names of the rows the first study stored. */
const SEARCHES = [["words", "Word search"], ["meaning", "Meaning search"], ["both", "Both together (used here)"]];
const STORED = { keyword: "word search", vector: "meaning search", hybrid: "both", bot: "both plus the machine from the work order" };

/* Four numbers at a glance. Everything else is one sentence that opens on click. */
export default function Numbers() {
  const top = S.assignees[0], year = S.to.slice(0, 4), period = `${day(S.from)} to ${day(S.to)} ${year}`;
  const loss = usd(Math.abs(S.loss_total)), margin = Math.round(S.median_margin * 100), share = pc(top[1], S.wos);
  const hits = Object.values(R.methods).map(m => m.family), spread = Math.max(...hits) - Math.min(...hits);
  const issues = [
    [pc(S.over_nte, S.repair_quotes) + "%", "of repair quotes go over the NTE", `${S.over_nte} of ${S.repair_quotes}. Each needs 7-Eleven approval, so the bot flags it at once.`],
    [S.loss_jobs, "jobs paid the tech more than we billed", `Total loss ${loss}. Median margin on the other jobs: ${margin}%.`],
    [S.mismatch, "quotes where the lines don't add up to the total", `${S.mismatch} of ${S.priced}. Code pricing makes this zero.`],
    [pc(S.make_named, S.quotes) + "%", "of quotes name the machine make", `${S.make_named} of ${S.quotes}. Without the make, matching old quotes is harder, so the bot asks for it.`],
  ];
  /* Every figure on the page, with the count behind it. Where the rule is not in this file, it says so. */
  const worked = [
    [`${S.wos} work orders`, `Every ClickUp task in the Vista space with Client = 7-Eleven, plus 1 tagged by FM only. ${period}.`],
    [`${S.quotes} quotes`, `The work orders that have quote text. ${X.n} of them are in the search index. Why the other ${S.quotes - X.n} are not is not recorded in this file.`],
    [`${S.priced} priced quotes`, `The quotes that carry a total. Added up they come to ${usd(S.quoted_total)}. The middle one is ${moneyShort(S.median_quote)}.`],
    [`${pc(S.over_nte, S.repair_quotes)}% over the NTE`, `${S.over_nte} ÷ ${S.repair_quotes} repair quotes with a total above the work order's NTE. Which quotes count as repair quotes is a rule of the study and is not recorded in this file.`],
    [`${S.mismatch} do not add up`, `For each of the ${S.priced} priced quotes the lines were added up again and compared with the total written on the quote.`],
    [`${share}% with one dispatcher`, `${top[1]} ÷ ${S.wos} work orders have the same assignee.`],
    [`${S.wait_hours_median} h waiting`, `${S.wait_n} work orders have a status history through "waiting for quote". For each, the hours between entering and leaving that status. ${S.wait_hours_median} h is the middle value and ${S.wait_p75} h the 75th percentile.`],
    [`${S.loss_jobs} loss jobs`, `Of ${S.invoiced_with_cost} billed jobs that also have a tech cost, ${S.loss_jobs} paid the tech more than was billed, ${loss} together.`],
    [`${pc(S.make_named, S.quotes)}% name the make`, `${S.make_named} ÷ ${S.quotes} quotes name a machine make.`],
    [`${pc(R.methods.both.family, R.n)}% search test`, `${R.methods.both.family} ÷ ${R.n}. Each old quote that has reported text and a machine type was hidden in turn and searched for. A hit means the top 5 held a quote for the same machine type.`],
  ];
  return (
    <>
      <div className="kpis">
        <Kpi v={S.wos} t={`7-Eleven work orders in ClickUp, ${period}`}
          how="Every ClickUp task in the Vista space with Client = 7-Eleven, plus 1 tagged by FM only." />
        <Kpi v={"$" + (S.quoted_total / 1e6).toFixed(2) + "M"} t="quoted across the priced quotes"
          how={`${S.priced} quotes carry a total. Added up they come to ${usd(S.quoted_total)}. The middle one is ${moneyShort(S.median_quote)}.`} />
        <Kpi v={share + "%"} t="of all 7-Eleven work orders sit with one dispatcher"
          how={`${top[1]} of the ${S.wos} work orders have the same assignee.`} />
        <Kpi v={S.wait_hours_median + " h"} t={`median time a work order sits in "waiting for quote"`}
          how={`${S.wait_n} work orders passed through "waiting for quote". ${S.wait_hours_median} h is the middle value, and a quarter waited longer than ${S.wait_p75} h.`} />
      </div>

      <Fold label="What breaks" title={`${S.families[0][0]} and ${S.families[1][0]} lead the quotes.`}>
        <div className="narrow">
          {S.families.filter(f => f[0] !== "Other").map(([k, v]) => <Bar key={k} label={k} value={v} max={S.families[0][1]} />)}
          <p className="note">Quotes by machine type. The type is read from the work order and the quote text by rules, so a few are approximate.</p>
        </div>
      </Fold>

      <Fold label="Where quotes go wrong today" title="Totals over the NTE, sums that do not add up, jobs that lose money, makes left out.">
        <div className="narrow">
          {issues.map(([big, what, why]) => <div className="issue" key={what}><span className="what">{what}</span><span className="big">{big}</span><span className="why">{why}</span></div>)}
        </div>
      </Fold>

      <Fold label="Who quotes" title={share >= 45 && share <= 55 ? "One dispatcher holds about half of the account." : `One dispatcher holds ${share}% of the account.`}>
        <div className="narrow">
          {[...S.assignees, ["Everyone else", S.assignee_other]].map(([k, v]) => <Bar key={k} label={k} value={v} max={top[1]} />)}
          <p className="note">7-Eleven work orders by dispatcher. Names are replaced by letters in this copy.</p>
        </div>
      </Fold>

      <Fold label="Search test on the real quotes" title="It finds the same machine type nearly every time, when the machine is named.">
        <p className="note">Each old quote was treated as a new job, with itself hidden. Did the top 5 results include the same type of machine and the same make?</p>
        <div className="scroll">
          <table>
            <thead><tr><th>Search method</th><th className="n">Same machine type in top 5</th><th className="n">Same make in top 5</th></tr></thead>
            <tbody>
              {SEARCHES.map(([k, label]) => (
                <tr key={k} className={k === "both" ? "best" : ""}><td>{label}</td><td className="n">{pct1(R.methods[k].family, R.n)}</td><td className="n">{pct1(R.methods[k].make, R.make_n)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="callout info">
          <b>The machine on the work order matters:</b> with it, both together finds the machine type for {pct1(R.methods.both.family, R.n)} ({R.methods.both.family} of {R.n}). From the tech's words alone it is {pct1(R.no_machine.family, R.n)} ({R.no_machine.family} of {R.n}).
        </div>
        <How summary="How to read this test">
          <ul>
            <li>Run with the search code in this file. The query is what the bot would really have: the machine name on the work order and what the tech reported. The project's tests repeat it, so the table cannot drift from the code.</li>
            <li>The three methods are {spread} quotes apart on the machine type. Word search is ahead on makes ("FBD", "Franke"), because a make is a name, not a meaning.</li>
            <li>{R.shared_wording} of the {R.n} quotes share their wording with another quote. With those copies hidden too, both together scores {pct1(R.copies_hidden.family, R.n)}, so copies are not what makes it work. Same make with copies hidden: {pct1(R.copies_hidden.make, R.make_n)}.</li>
            <li>Old quotes are written text. A tech on a call speaks differently, so real calls may score lower, and the gap between the methods may change. Only a pilot can measure that.</li>
            <li>The first study stored its own table: {Object.entries(S.eval).map(([k, v]) => `${STORED[k]} ${(v["hit@5_family"] * 100).toFixed(1)}%`).join(", ")}. How those rows were run is not recorded in this file, so they are not used here.</li>
          </ul>
        </How>
      </Fold>

      <Fold label="The working" title="How each number was worked out.">
        <div className="scroll">
          <table className="worked">
            <thead><tr><th>Number</th><th>How it was counted</th></tr></thead>
            <tbody>{worked.map(([n, how]) => <tr key={n}><td>{n}</td><td>{how}</td></tr>)}</tbody>
          </table>
        </div>
      </Fold>

      <Fold label="Coverage" title="What is in the data, and what is not.">
        <div className="twocol">
          <div>
            <Label>In the data</Label>
            <ul>
              <li>{S.wos} 7-Eleven work orders from the ClickUp Vista space, {period}, pulled on 12 Nov 2026.</li>
              <li>{S.quotes} of them have quote text. Those are the quotes the bot can learn from.</li>
              <li>Wait times come from the status history in an earlier pull, on 4 Nov 2026.</li>
            </ul>
          </div>
          <div>
            <Label>Not in the data, or not confirmed</Label>
            <ul>
              <li>Work orders from before {day(S.from)} {year}.</li>
              <li>Archived tasks, and tasks kept outside the Vista space.</li>
              <li>Quotes that exist only in Yoda or as a PDF, with no text in ClickUp.</li>
              <li>Real calls. The three demo calls are invented.</li>
            </ul>
          </div>
        </div>
        <p className="note">So this is every 7-Eleven quote found in ClickUp for the period. It is not proven to be every quote that was sent.</p>
      </Fold>
      <footer>Source: ClickUp Vista space, every task with Client = 7-Eleven (plus 1 tagged by FM only), pulled 2026-11-12. {S.quotes} have quote text. Wait time comes from the status history of the {S.wait_n} WOs that passed through "waiting for quote" in the Nov 4 pull. Machine type is read from the WO and quote text by rules, so a few are approximate.</footer>
    </>
  );
}
