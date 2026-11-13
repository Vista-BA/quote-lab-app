import makeSearch from "./lib/search.js";

/* The page sets these two before the bundle loads: the search index, and the sample runs with the study counts.
   This file is the only place that knows where data comes from. To join a bigger app, swap these for API calls. */
export const SEM = window.QD_SEM, DATA = window.QD_DATA;
export const S = DATA.study, R = S.recheck;
export const X = makeSearch(SEM);

/* One name per sample run, in the order of the data. The first is the happy path. */
export const SCENARIOS = ["Standard job", "Missing price", "New machine"];

const days = Math.round((new Date(S.to) - new Date(S.from)) / 864e5);
export const PERIOD = { days, months: days / 30.44 };
export const pc = (a, b) => Math.round(a / b * 100);
export const pct1 = (a, b) => (a / b * 100).toFixed(1) + "%";
export const usd = x => (x < 0 ? "-$" : "$") + Math.abs(Math.round(x)).toLocaleString("en-US");
export const num = x => (Math.round(x * 10) / 10).toLocaleString("en-US");
