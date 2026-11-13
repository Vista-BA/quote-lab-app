# 7-Eleven Quote Desk (prototype, version 4)

A proof of concept for drafting 7-Eleven quotes. The dispatcher sets a work order to "waiting for quote". The bot finds the call, reads it, matches old quotes, writes the scope and prices it by code. A person settles what the bot could not, then approves.

Stage: prototype. The calls are invented, the "AI" steps run on rules, and no dispatcher has used it yet.

New in version 4: every step can be opened in three views. **Result** is what the step produced. **How it did it** is the method, with this work order's own values. **Other ways** lists the other ways that step could be done, with what each one gives and what it costs.

## Run it

Open `dist/7eleven_quote_desk_v4.html` in a browser. It is one file. It needs no server and no internet, and it makes no network request: the fonts, the data and the code are all inside it.

The demo in three steps:

1. **Overview.** One message, three numbers, one button: "Watch it draft a quote".
2. **The bot runs.** The button sets the standard job to "waiting for quote" and the five steps run. Each finished step writes what it produced on its tile.
3. **The outcome.** The client quote with what must be settled. Change the hours, approve.

Then, for the questions: pick a step, and use the three buttons under its title (Result, How it did it, Other ways).

The "Demo controls" button at the bottom left picks one of two harder cases (a missing price, a machine never quoted before) or resets everything. Picking a case opens it and waits, so the one button on the screen is pressed on purpose.

## Change it

You need Node 20 or newer.

```
npm install      # once
npm test         # 74 checks on the logic, the data, the options and the styles
npm run build    # writes dist/7eleven_quote_desk_v4.html
```

## Read the code in this order

1. `data/data.json`: the three sample work orders and the study counts. Everything the page shows starts here.
2. `src/lib/pricing.js`: how a quote is priced and what blocks approval. Plain functions, no page in them. `tests/pricing.test.mjs` shows each rule with real numbers.
3. `src/lib/evidence.js`: how each fact is traced back to a line of the call.
4. `src/lib/steps.js`: what each step can say about its own work (the "How it did it" view), worked out from the sample by code.
5. `src/options.js`: the other ways each step could be done (the "Other ways" view). Plain data, one file.
6. `src/App.jsx`: the five tabs and the state of the demo.
7. `src/components/LiveDemo.jsx` and `src/components/StepDetail.jsx`: the screen that draws all of it.

Four React ideas are enough to follow the screens:

- A **component** is a function that returns what to draw. `LiveDemo`, `Overview` and the rest are components.
- **Props** are the inputs a component is given, like `r` (the sample run) and `q` (its prices).
- **State** is what can change while the page is open: which step is shown, which view of it, the hours, a typed price. It lives in `App.jsx` in one object called `demo`.
- When state changes, React **draws the screen again** from the data. Nothing on the page is edited by hand, which is why the totals can never disagree with the lines.

## What is where

| Path | What it does |
|---|---|
| `src/App.jsx` | The five tabs and the demo state (which work order, which step and view, hours, typed prices, markup, ticked checks, approvals). |
| `src/components/Overview.jsx` | The message, three numbers, one button. The rest opens on click. |
| `src/components/LiveDemo.jsx` | The work order card, the five step tiles, and the draft quote with its review. |
| `src/components/StepDetail.jsx` | One step in its three views: result, how it did it, other ways. |
| `src/components/SearchQuotes.jsx` | Search over the old quotes, by words and by meaning. |
| `src/components/Numbers.jsx` | Four numbers, then what the data says, one sentence at a time. |
| `src/components/BusinessCase.jsx` | Inputs, hours and money per month, payback. |
| `src/components/DemoControls.jsx` | The floating button for the presenter. |
| `src/options.js` | The other ways each step could be done, with what each gives and costs. |
| `src/lib/pricing.js` | Prices a quote in whole cents, and decides what blocks approval. Code only, no AI. |
| `src/lib/evidence.js` | Finds the line of the call behind each fact. |
| `src/lib/steps.js` | The facts behind "How it did it": the call match, the gaps, the match counts, the source of each scope line, the sums. |
| `src/lib/search.js` | The in-browser search (word search plus meaning search). |
| `src/lib/searchCheck.js` | The search test behind the percentages on the page, for each of the three search methods. |
| `src/lib/caseModel.js` | The business case sums. |
| `src/data.js` | The only file that knows where data comes from. |
| `src/styles/tokens.css` | Every color, font and shadow. |
| `src/styles/app.css` | Component styles. No color values, only tokens. |
| `data/data.json` | The three sample work orders and the study counts. |
| `data/search-index.json` | 532 real quotes, prepared for search. |
| `build.mjs` | Puts fonts, styles, data and app into one HTML file. |
| `tests/` | The checks that `npm test` runs. |

## Where the choices live

`src/options.js` holds every "other way", step by step. Each one has a name, a tag, what you get and what it costs. To change a choice, change it there. Nothing else needs to be touched.

The tags:

| Tag | Meaning |
|---|---|
| Used here | What this prototype does. |
| Suggested next | A proposal for a pilot. Not something agreed. |
| Option | A workable way that was not chosen. |
| Today | How it is done by hand now. |
| Not advised | Workable, but the cost is too high. |
| Never | Breaks a rule of the design. |

Three kinds of statement are kept apart on the page: a figure (always read from the data, never typed in), what the prototype does, and a judgment. `tests/options.test.mjs` holds the file to that: the figures must match the search test and the study, what the words say about the figures must be true of them, a web search or a guessing model can never be tagged as a way to set a price, and a proposal must be labeled as a proposal.

## Rules the code keeps

1. **Code sets every price.** AI only writes words. `pricing.js` is the only place a total is worked out, in whole cents, and the tests check it against the stored totals.
2. **A price is never guessed.** A part with no price shows "price needed" and stays at zero until a person types it in.
3. **A supplier's price is a cost, not a client price.** When the tech gives what the supplier charges, the part is flagged and a person sets the markup. Zero is allowed, an empty box is not.
4. **Two kinds of open point, and both block approval.** "To fix" is something code can see is unsettled (no price, no markup). "To check" is something only a person can judge (a price borrowed from another machine, a make never quoted), so a person ticks it.
5. **What the bot assumed is shown, not hidden.** For example the usual state tax rate, or an assessment hour the tech did not state.
6. **A machine never quoted before:** the bot starts from the same machine type, asks the tech for the model, and reads only the manufacturer's manual. A web page never sets a price.
7. **Every fact points at its source.** Each fact read from the call shows the line it came from. Each price names the rate card, a past quote, the tech's words or a person. Each line of the scope names where it comes from.
8. **Internal stays internal.** The NTE, the price sources and the call details sit in the internal notes. The client quote shows none of them.
9. **An unknown stays unknown.** The business case shows "?" until a real number is entered. Where the sample does not record something, "How it did it" says so in words.
10. **Every percentage has a count behind it.** The search percentages are worked out again by `npm test`, so the page and the code cannot drift apart.
11. **Each step explains itself from the data.** The method shown for a step is worked out by code from the sample (`src/lib/steps.js`), so it changes when the sample or the dispatcher's entries change.

## What is real and what is simulated

Real: the 532 old quotes in the search index, and the counts in `data/data.json` under `study` (ClickUp Vista space, Client = 7-Eleven, 8 Jun to 11 Nov 2026).

Simulated: the three calls, the stores, phone numbers and techs, the text to the tech, and the saving and sending after Approve. The two AI steps (read the call, write the scope) are stored results in `data/data.json` (`findings` and `draft`). In production they would come from the Claude API.

Saved with the samples, not worked out by this page: the three matched quotes of each sample and their scores (`matches`), and the part prices with their source notes (`price.materials`). The page checks what it can about them (same machine type, same make, sums that add up) and says what it cannot.

The rate card shown on step 5 is read from the three samples. A parts markup is not in it, which is why a person sets one.

## Not in this proof of concept

- Several options on one quote (repair or replace).
- Editing every line. Only the hours, a missing price and the markup can be changed.
- A second approval by a manager, and the client's own approval.
- The order of the dispatcher's steps. The history lists what was done, not when.
- Switching the method of a step live. "Other ways" describes the options. Only the search can be tried three ways, on the "Search old quotes" tab.

## Handle the data with care

`data/search-index.json` holds real 7-Eleven quote text and totals. Keep it inside the company. Do not push this folder to a public repository.

Dispatcher names are replaced by letters in this copy. The first prototype file still has them.

## Joining a bigger app later

The pieces are built to be lifted out one at a time.

1. `src/lib/` has no React and no page in it. Copy it as it is, with its tests.
2. `src/data.js` reads two global variables today. Replace it with calls to the app's own data, and keep the same shape.
3. `src/styles/tokens.css` is the only place with color values. Map those variables to the host app's tokens.
4. Each file in `src/components/` is one screen. Take the screens that are wanted.
5. The in-browser search is for the demo. A real system would search on the server (for example Postgres with pgvector) and return the same fields: work order, machine type, make, reported text, total.
6. The AI plugs in at two places: where `findings` is produced from a call, and where `draft` is produced from the findings plus the matched quotes. Pricing stays in code.

Tailwind was left out on purpose. Plain CSS with one token file is easier to move into an app that already has its own design tokens.

Fonts: Archivo, IBM Plex Sans and IBM Plex Mono (SIL Open Font License), taken from the `@fontsource` packages at build time. A host app with its own fonts can drop them and change the three font variables in `tokens.css`.

## How it was checked (13 Nov 2026)

- `npm test`: 74 checks pass from a clean install. They cover pricing against the stored totals, missing prices, the markup rule, the ticks that unlock approval, the trace from each fact to the call, what each step says about its own work, the options and their figures, the business case sums, the search test for all three search methods, the sample data, and the style rules (colors only from tokens, no text under 12px, focus rings kept, real buttons, labeled fields).
- In a browser (Chromium, by script, 164 checks): the three-step flow, all three cases, every step in its three views, a typed price, the markup, the ticks, approve, history, search, the data tab, the business case, reset, keyboard-only use, deep links, reduced motion, clicking around mid-run, and that the page makes no network request.
- Thirty screen states at five widths from phone to wide, in light and dark (seven combinations): text contrast passes 4.5 to 1 (3 to 1 for large text), no text under 12px, every control at least 24px, no sideways scroll.
- Not checked: Safari and Firefox, a screen reader, and a real dispatcher using it.

## Known limits

- The minutes to write one quote by hand are not measured. The business case stays "Unproven" until they are.
- The 50 hours of waiting are not split into writing time and other waiting.
- The search test uses old quotes as the questions. A tech on a call speaks differently, so real calls may score lower, and the gap between the three search methods may change.
- On that test the three search methods are 3 quotes apart out of 518 on the machine type, and word search alone is ahead on makes. The case for using both rests on spoken calls, which are not measured yet.
- The first study stored a result table (up to 98.3%) that the search code in this build does not reproduce. The page shows the figures this build produces (96.1% for both together) and names the stored ones in a note.
- The three matched quotes of each sample were saved when the sample was made. Code confirms they share the machine type and, where there is one, the make. The search inside this file does not reproduce their ranking, and the page says so.
- For a part price taken from past quotes, the sample shows one matching line as an example. It does not record which old quote the figure came from, or how one is picked when several carry the part.
- Scope lines added by the bot's rules have no source recorded in the sample.
- Tax uses the usual state rate, not the store's ZIP rate. The draft says so under "What the bot assumed".
- The trace from a fact to the call is plain text matching. It works on the three samples. Real calls will need the model to return the line with each fact.
- The options in "Other ways" are design judgment, apart from the figures. They are there to be argued with.
