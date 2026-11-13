import { Play } from "lucide-react";
import { R, S, pc } from "../data.js";
import { Chip, Fold, How, Kpi, Label } from "./ui.jsx";

const STATUS = { shown: ["ok", "✓ Shown"], partly: ["wait", "Partly shown"], open: ["open", "Open"] };

/* One message, three numbers, one button. Everything else on this screen opens on click. */
export default function Overview({ onWatch, go }) {
  const wait = S.wait_hours_median;
  const levels = [
    { t: "It works", q: "Does it do the task correctly?", st: "partly",
      shown: `Search finds the same machine type in the top 5 for ${pc(R.methods.both.family, R.n)}% of ${R.n} old quotes. Code does every sum.`,
      how: `${R.methods.both.family} of ${R.n} old quotes. Each one was hidden in turn and searched for by its machine name and what the tech reported. The top 5 results held a quote for the same machine type.`,
      open: "The AI steps run on rules here, and the calls are simulated.", to: ["demo", "Open the live demo"] },
    { t: "It solves the problem", q: "Whose problem is it, and how will we know it is solved?", st: "partly",
      shown: "The wait and the errors are measured.",
      open: `No owner, no target, and the ${wait} hours are not split yet.`, to: ["data", "See what the data says"] },
    { t: "It is worth it", q: "Does the value beat the full cost?", st: "open",
      open: "Value and cost are not known. The business case lists what to collect.", to: ["case", "Open the business case"] },
    { t: "It is the right bet", q: "Should we do this now, and who does it?", st: "open",
      open: "Why 7-Eleven first, what waits meanwhile, and who builds and runs it." },
  ];
  const path = [
    ["The tech calls the dispatcher", "person"],
    ["It finds and reads the call", "bot: AI, words only"],
    ["It matches old quotes", "bot: search"],
    ["It sets every price", "bot: code, fixed rules"],
    ["The dispatcher checks and approves", "person"],
  ];
  const asks = [
    ["Start the project", "As a four-week pilot on 7-Eleven, with a person checking every draft.", true],
    ["Name the owner", "Not agreed yet."],
    ["Set the target", `After measuring where the ${wait} hours go.`],
    ["Approve the AI use", "The Claude API reads call transcripts and old quotes, with a monthly spending limit."],
  ];
  return (
    <>
      <div className="pane hero">
        <Label>The message</Label>
        <h2 className="msg">A 7-Eleven quote is drafted the moment the dispatcher hangs up. Code sets every price. A person approves.</h2>
        <div className="herorow">
          <button className="btn primary big" type="button" onClick={onWatch}><Play size={16} aria-hidden="true" />Watch it draft a quote</button>
          <Chip kind="wait">Stage: prototype</Chip>
          <span className="note">Sample calls, real past quotes. Dispatchers have not used it yet.</span>
        </div>
      </div>

      <Label className="sect">The problem today</Label>
      <div className="kpis three">
        <Kpi v={`${wait} h`} t={`median time a work order sits in "waiting for quote"`}
          how={`${S.wait_n} work orders passed through "waiting for quote". For each one, the hours between entering and leaving that status. ${wait} h is the middle value, and a quarter waited longer than ${S.wait_p75} h. How much of it is writing time is not measured yet.`} />
        <Kpi v={`${pc(S.over_nte, S.repair_quotes)}%`} t="of repair quotes go over the NTE"
          how={`${S.over_nte} of the ${S.repair_quotes} repair quotes had a total above the work order's NTE. Each one needs 7-Eleven's approval. The bot does not lower this number. It flags the quote at once, so approval is asked for sooner.`} />
        <Kpi v={`${S.mismatch} of ${S.priced}`} t="quotes did not add up"
          how={`In ${S.mismatch} of the ${S.priced} priced quotes, the lines do not sum to the total written on the quote. With code doing the sums this goes to zero.`} />
      </div>

      <Label className="sect">More, when it is asked for</Label>
      <Fold label="How it works" title="Five steps. The bot does the three in the middle.">
        <ol className="path">
          {path.map(([t, who], i) => <li key={t} className={i > 0 && i < 4 ? "me" : ""}><span>{t}</span><span className="who">{who}</span></li>)}
        </ol>
        <p className="note">The three bot steps are what this prototype adds. Nothing goes out until the dispatcher approves.</p>
      </Fold>
      <Fold label="Where the project stands" title="Four questions every project has to answer. Two are partly answered, two are open.">
        <div className="levels">
          {levels.map((l, i) => (
            <article className="lvl" key={l.t}>
              <span className="n">Level {i + 1} of 4</span>
              <h3>{l.t}</h3>
              <p className="q">{l.q}</p>
              <span><Chip kind={STATUS[l.st][0]}>{STATUS[l.st][1]}</Chip></span>
              <dl>
                {l.shown && <><dt>Shown</dt><dd>{l.shown}{l.how && <How>{l.how}</How>}</dd></>}
                <dt>Open</dt><dd>{l.open}</dd>
              </dl>
              {l.to && <button className="linkbtn" type="button" onClick={() => go(l.to[0])}>{l.to[1]}</button>}
            </article>
          ))}
        </div>
      </Fold>
      <Fold label="What we ask for" title="Agree to start the project, as a four-week pilot on 7-Eleven.">
        <ol className="decide">
          {asks.map(([t, s, ask]) => <li key={t}><span><b>{t}{ask && <Chip kind="fam">the ask today</Chip>}</b><span className="sug">{s}</span></span></li>)}
        </ol>
      </Fold>
      <footer>Every number comes from the ClickUp pull described under "What the data says". Nothing here is a forecast, and open points are shown as open.</footer>
    </>
  );
}
