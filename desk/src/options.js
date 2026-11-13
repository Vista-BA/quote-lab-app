/* The other ways each of the five steps could be done, with what each one gives and what it costs.
   Plain data, kept in one file on purpose: these are choices, and a choice should be easy to find, argue about and change.

   Three kinds of statement live here, and the page keeps them apart:
   - a figure: always taken from the study counts or the search test, never typed in by hand;
   - what this prototype does ("Used here"): true of the code in this folder;
   - a judgment (everything else, including "Suggested next"): a proposal to test in a pilot, not something agreed. */

export const TAGS = {
  used: "Used here",          /* what this prototype does */
  next: "Suggested next",     /* what a pilot should try first */
  option: "Option",           /* a workable way that was not chosen */
  today: "Today",             /* how it is done by hand now */
  avoid: "Not advised",       /* workable, but the cost is too high */
  never: "Never",             /* breaks a rule of the design */
};

const pct = (a, b) => (a / b * 100).toFixed(1) + "%";
const whole = (a, b) => Math.round(a / b * 100) + "%";

/* The line under every list of options: what kind of statement the reader has just read. */
const JUDGEMENT = "This is design judgment, not a measurement.";
const MEASURED = "The figures are measured on the past quotes in this file. The rest is design judgment.";
const PROPOSAL = "\"Suggested next\" is a proposal for a pilot, not something agreed.";

/* ---- Step 1 ---- */
function findCall(run, study, runs) {
  const unpaid = runs.find(r => !r.paid);
  return {
    ask: "How does the bot get the right call for this work order?",
    choice: "From the status change, by the tech's phone number. The dispatcher already changes the status, so the bot adds no step. The fallback keeps it working without a number, and showing the picked call lets a person catch a wrong one.",
    items: [
      { tag: "used", name: "Start from the status change, find the call by the tech's phone number",
        gain: "The dispatcher does nothing extra. When the assessment was paid, the tech's number is on the PPR line, so only that tech's calls are read.",
        cost: "It needs that number on the work order. Without it, the bot falls back to the next way." },
      { tag: "used", name: "No number: read all of the dispatcher's calls since \"assessment ongoing\"",
        gain: "It still works when the assessment was not paid.",
        cost: `More calls to read${unpaid ? ` (${unpaid.calls_checked} on the missing price sample)` : ""} and a higher chance of a wrong pick. The picked call is always shown, so a person can see it.` },
      { tag: "next", name: "Ask the dispatcher to pick when more than one call fits",
        gain: "A person settles the doubtful cases, so a wrong call cannot slip into a quote.",
        cost: "One click on some quotes, and the draft waits for it." },
      { tag: "option", name: "The dispatcher pastes the transcript",
        gain: "It needs no link to the phone system, so a pilot could start with it.",
        cost: "A manual step on every quote." },
      { tag: "option", name: "Link the call to the work order when the call is made",
        gain: "An exact link. Nothing to search for.",
        cost: "Dispatchers and techs change how they call. Whether the phone system can do it is not checked." },
    ],
    basis: JUDGEMENT,
  };
}

/* ---- Step 2 ---- */
function readCall() {
  return {
    ask: "How do the tech's spoken words become facts a quote can use?",
    choice: "Fixed rules, for now. They keep this file offline and repeatable. What stays in any version is the form and the line check: an answer with no line of the call behind it is shown as not said.",
    items: [
      { tag: "used", name: "Fixed rules that look for set phrases",
        gain: "The same answer every time, no running cost, and no call text leaves this file.",
        cost: "It only catches the phrasings someone wrote a rule for. A tech who says it another way is missed." },
      { tag: "next", name: "A language model fills the same form, and code checks each answer against the call",
        gain: "It copes with the way people really talk, and each answer still points at the line it came from.",
        cost: "A cost per call and the odd misread, both to measure in a pilot. Call text goes to the model provider, so it needs a security review first." },
      { tag: "option", name: "Text the tech for what was not said",
        gain: "The gap is closed by the person standing at the machine.",
        cost: "The tech has to answer, and the quote waits until then. Shown, simulated, in the new machine sample." },
      { tag: "avoid", name: "A language model writes a free summary",
        gain: "The fastest to build.",
        cost: "Nothing to check it against. It can state something the tech never said, and nobody would see it." },
      { tag: "today", name: "The dispatcher carries the facts from the call into the quote",
        gain: "A person's judgment on every call.",
        cost: "It is the hand work this project sets out to cut." },
    ],
    basis: JUDGEMENT,
  };
}

/* ---- Step 3, a make that has been quoted before: how to search ---- */
function matchQuotes(run, study) {
  const R = study.recheck, { words, meaning, both } = R.methods, n = R.n, mk = R.make_n;
  const hits = [words.family, meaning.family, both.family], spread = Math.max(...hits) - Math.min(...hits);
  const row = (name, m, used) => ({ name, used, cells: [[pct(m.family, n), `${m.family} of ${n}`], [pct(m.make, mk), `${m.make} of ${mk}`]] });
  return {
    ask: "Which old quotes are most like this job?",
    choice: `Words and meaning together. On old quotes the three searches are only ${spread} quotes apart out of ${n} on the machine type, and word search is ahead on makes. Both is kept because a call is spoken, not written, and that is where meaning search should help. Only a pilot on real calls can settle it.`,
    /* The same test for the three searches: each past quote hidden in turn, then searched for by its machine name and reported text. */
    measured: {
      caption: "The search test: each past quote was hidden in turn and searched for. Did the top 5 hold a quote for the same machine type, and for the same make?",
      head: ["Search", "Same machine type", "Same make"],
      rows: [row("Words and meaning together", both, true), row("Word search only", words, false), row("Meaning search only", meaning, false)],
    },
    items: [
      { tag: "used", name: "Words and meaning together",
        gain: "The most hits on the machine type in this test.",
        cost: `Two searches to run. It leans on the machine named on the work order: from the tech's words alone it drops to ${pct(R.no_machine.family, n)} (${R.no_machine.family} of ${n}).` },
      { tag: "option", name: "Word search only",
        gain: "Nearly the same on the machine type, and the best of the three on makes. The simplest to run.",
        cost: "It needs the same words. This test cannot show that weak spot, because it searches with old quotes written in the same style." },
      { tag: "option", name: "Meaning search only",
        gain: "It can find the same job told in other words.",
        cost: "The weakest of the three on makes. A make is a name, not a meaning." },
      { tag: "option", name: "A stronger hosted model for the meaning search",
        gain: "Likely better when a tech's spoken words differ from written quotes. Not measured.",
        cost: "A cost per search, and quote text leaves the building. Worth it only if a pilot shows misses." },
      { tag: "option", name: "A book of standard jobs for each machine",
        gain: "One agreed scope and price for each common repair. No search needed.",
        cost: "Someone has to write it and keep it current. Rare jobs are not in it." },
      { tag: "today", name: "The dispatcher looks for a similar old quote by hand",
        gain: "Nothing to build.",
        cost: "It depends on what the dispatcher remembers and can find." },
    ],
    basis: MEASURED,
    link: ["search", "Try the three searches yourself"],
  };
}

/* ---- Step 3, a make never quoted: what to do about it ---- */
function newMachine(run) {
  return {
    ask: "What should the bot do with a make it has never quoted?",
    choice: "Ask first, then the maker's manual. A new make is where a confident wrong answer costs the most. So the bot asks for the model, reads only the maker's own pages, and flags the draft for a person. How the search itself can be done is shown on the standard job.",
    items: [
      { tag: "used", name: "Ask the tech for the model, then read the maker's own manual",
        gain: "The right machine before anything is written, and a source that can be named: the manufacturer.",
        cost: "The quote waits for the tech's answer. A manual gives steps and part numbers, not prices." },
      { tag: "used", name: "Start from old quotes for the same machine type",
        gain: `House wording and typical hours, from the ${run.new_work.family_quotes} ${run.family.toLowerCase()} quotes on file.`,
        cost: "Another make is built differently, so parts and access steps may not carry over. The draft is flagged as new work." },
      { tag: "avoid", name: "Search the open web for the machine and the fault",
        gain: "An answer in seconds for almost any machine.",
        cost: "Forums and shops mix models and years. Nobody can say which page a step came from, and a wrong step would reach the client under our name." },
      { tag: "option", name: "Keep our own library of manuals for the makes 7-Eleven uses",
        gain: "The same trusted source every time, with no searching.",
        cost: "Someone has to collect the manuals and keep them current." },
      { tag: "option", name: "Stop and hand it to a person",
        gain: "No risk of a wrong draft.",
        cost: "No time saved on these jobs." },
    ],
    basis: JUDGEMENT,
  };
}

/* ---- Step 4 ---- */
function writeScope(run, study) {
  return {
    ask: "How are the \"Required is to\" lines written?",
    choice: "A fixed pattern. It cannot put a price into the words, and it writes the same way every time. The next step is a model that writes freer text, with every line traced to its source.",
    items: [
      { tag: "used", name: "A fixed pattern: opening line, two lines for each part, closing lines",
        gain: "The same house wording every time, and no price can end up in the words.",
        cost: "It only knows the repairs someone wrote rules for. An unusual job comes out thin." },
      { tag: "next", name: "A language model writes the steps, with the matched quotes as examples",
        gain: "Wording that fits the job, in the style of real past quotes.",
        cost: "It can add a step nobody asked for. So each line has to name the quote or call line it came from, and the dispatcher reads it before approving. Cost per quote to measure." },
      { tag: "option", name: "Copy the closest old quote and let the dispatcher edit it",
        gain: "Real wording that was approved once already.",
        cost: "It carries over the old job's parts and its mistakes. This is today's way, only faster." },
      { tag: "option", name: "A library of standard scopes, one for each machine and fault",
        gain: "Checked steps for the common repairs.",
        cost: "Someone has to write it and keep it current. Rare jobs are not covered." },
      { tag: "today", name: "The dispatcher rebuilds it by hand from an old quote",
        gain: "A person's judgment in every line.",
        cost: `It is the hand work this project sets out to cut. Only ${whole(study.make_named, study.quotes)} of past quotes name the machine make (${study.make_named} of ${study.quotes}).` },
    ],
    basis: MEASURED,
  };
}

/* ---- Step 5 ---- */
function priceIt(run, study) {
  return {
    ask: "Where does the price of each part come from? Labor, fees and tax come from the rate card.",
    choice: "A past quote or the tech's own price, never a guess. A price needs a source someone can point at. So the bot flags anything borrowed and leaves a gap open rather than fill it. A web search can hint at a price. It cannot stand behind one.",
    items: [
      { tag: "used", name: "Past quotes for the same part",
        gain: "A price 7-Eleven has been quoted before, with a matching line from past quotes shown as the source.",
        cost: "Old prices go stale, and it only works for parts quoted before. A price taken from another machine is flagged for a person." },
      { tag: "used", name: "The tech's or supplier's price, plus a markup",
        gain: "Today's real cost for this exact part.",
        cost: "It is a cost, not a client price. The markup for 7-Eleven is not in this prototype, so a person sets it." },
      { tag: "option", name: "An agreed parts price list",
        gain: "One agreed price for each part, the same on every quote.",
        cost: "Someone has to own it and keep it current. Whether one exists today is not checked." },
      { tag: "option", name: "The supplier's catalog, looked up by part number",
        gain: "Live cost and stock for the exact part.",
        cost: "It needs the part number, so the model has to be known first. It also needs an account and a connection to build." },
      { tag: "avoid", name: "Search the web for the part",
        gain: "A number for almost any part in seconds, even on a machine never quoted.",
        cost: "The same part name fits many models, so look-alikes come back. A shop's price is not our cost or our client price, it changes, and nobody here agreed to it. Useful as a lead for a person. Never as the price." },
      { tag: "never", name: "Let the AI estimate a price",
        gain: "No gap is ever left open.",
        cost: "A made-up number that looks real. It breaks the rule the whole design rests on." },
      { tag: "today", name: "The dispatcher prices it by hand",
        gain: "A person's judgment on every line.",
        cost: `${study.mismatch} of the ${study.priced} priced quotes in the study did not add up.` },
    ],
    basis: MEASURED,
  };
}

/** The options for step `i` (0 to 4) of one sample run. `study` is data.study and `runs` is data.runs.
    Returns { ask, choice, items: [{ tag, name, gain, cost }], basis, measured?, link? }, or null for a step that does not exist. */
export function optionsFor(i, run, study, runs) {
  const make = [findCall, readCall, run.new_work.is_new ? newMachine : matchQuotes, writeScope, priceIt][i];
  if (!make) return null;
  const o = make(run, study, runs);
  return { ...o, basis: o.items.some(it => it.tag === "next") ? `${o.basis} ${PROPOSAL}` : o.basis };
}
