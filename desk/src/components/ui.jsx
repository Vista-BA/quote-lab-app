/* Small shared pieces. Class names come from the page's own stylesheet. */
export const Label = ({ children, className = "" }) => <div className={("label " + className).trim()}>{children}</div>;

export const Chip = ({ kind, children }) => <span className={"chip " + kind}>{children}</span>;

/** A number explains itself on click, so the page stays short. */
export const How = ({ summary = "How we got this", children }) => (
  <details className="how"><summary>{summary}</summary><div className="body">{children}</div></details>
);

/** A whole section that stays closed until someone wants the detail.
    The closed line already says the point: a small label and one sentence. */
export const Fold = ({ label, title, children }) => (
  <details className="fold">
    <summary><span className="ft">{label && <span className="label">{label}</span>}<span>{title}</span></span></summary>
    <div className="body">{children}</div>
  </details>
);

export const Kpi = ({ v, t, why, how, unknown }) => (
  <div className="kpi">
    <div className={"v" + (unknown ? " unknown" : "")}>{v}</div>
    <div className="t">{t}</div>
    {why && <div className="why">{why}</div>}
    {how && <How>{how}</How>}
  </div>
);

export const Bar = ({ label, value, max, num, neutral, wide }) => (
  <div className={"bar" + (wide ? " wide" : "")}>
    <span>{label}</span>
    <span className="track"><span className={"fill" + (neutral ? " neutral" : "")} style={{ width: (max ? value / max * 100 : 0) + "%", display: "block" }} /></span>
    <span className="num">{num ?? value}</span>
  </div>
);

/** A status in words. The dot only repeats what the word says. */
export const Tag = ({ kind, children }) => <span className={"tag " + kind}>{children}</span>;
