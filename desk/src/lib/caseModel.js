/* The business case. Pure functions: an input nobody has measured stays null, and the result says what is missing. */
export const emptyCase = quotes => ({ quotes, byHand: null, withBot: 5, hourCost: null, caught: 0, build: null, run: null });

/** f scales the unmeasured minutes per quote: 0.75 low, 1 as entered, 1.25 high. */
export function calcCase(st, lossMonth, f = 1) {
  const q = st.quotes, mh = st.byHand == null ? null : st.byHand * f;
  const hand = q != null && mh != null ? q * mh / 60 : null;                  // hours a month writing by hand
  const bot = q != null && st.withBot != null ? q * st.withBot / 60 : null;   // hours a month checking drafts
  const freed = hand != null && bot != null ? Math.max(0, hand - bot) : null;
  const timeValue = freed != null && st.hourCost != null ? freed * st.hourCost : null;
  const loss = lossMonth * (st.caught || 0) / 100;                            // losses avoided a month
  const benefit = timeValue != null ? timeValue + loss : null;
  const net = benefit != null && st.run != null ? benefit - st.run : null;
  return { hand, bot, freed, timeValue, loss, benefit, net };
}

const NEEDS = [["quotes", "the quotes a month"], ["byHand", "the minutes per quote"], ["withBot", "the minutes to check a draft"],
  ["hourCost", "the cost of a dispatcher hour"], ["build", "the cost to build"], ["run", "the cost to run"]];

/** Low, middle and high case, what is still missing, the payback in months (null = never), and a one-word verdict. */
export function caseSummary(st, lossMonth) {
  const lo = calcCase(st, lossMonth, 0.75), mid = calcCase(st, lossMonth, 1), hi = calcCase(st, lossMonth, 1.25);
  const missing = NEEDS.filter(([k]) => st[k] == null).map(([, text]) => text);
  const ready = missing.length === 0;
  const months = c => (ready && c.net > 0 ? st.build / c.net : null);
  const payback = { fast: months(hi), mid: months(mid), slow: months(lo) };
  const verdict = !ready ? "unproven" : payback.fast == null ? "no" : payback.slow == null ? "close" : "promising";
  return { lo, mid, hi, missing, ready, payback, verdict };
}
