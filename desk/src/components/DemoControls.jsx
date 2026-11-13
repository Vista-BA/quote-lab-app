import { useEffect, useRef, useState } from "react";
import { Check, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { DATA, SCENARIOS } from "../data.js";

/** Floating pill for the presenter: pick a scenario, or put the demo back to the start.
    Picking a scenario opens it and waits, so the one button on the live demo is pressed on purpose.
    On screens too narrow to hold it beside the page, it shrinks to a round button so it does not cover the content. */
export default function DemoControls({ current, onScenario, onReset }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null), pill = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === "Escape") { setOpen(false); pill.current?.focus(); } };
    const onDown = e => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [open]);

  const pick = fn => { setOpen(false); pill.current?.focus(); fn(); };

  return (
    <div className="dc" ref={box}>
      <button ref={pill} type="button" className="dc-pill" title="Demo controls" aria-expanded={open} aria-controls="dc-menu" onClick={() => setOpen(o => !o)}>
        {open ? <X size={16} aria-hidden="true" /> : <SlidersHorizontal size={16} aria-hidden="true" />}<span className="dc-text">Demo controls</span>
      </button>
      {open && (
        <div className="dc-menu" id="dc-menu" role="group" aria-label="Demo controls">
          <div className="label">Pick a scenario</div>
          {DATA.runs.map((r, i) => (
            <button key={r.wo} type="button" className="dc-item" aria-pressed={i === current} onClick={() => pick(() => onScenario(i))}>
              <b>{SCENARIOS[i] ?? r.wo}{i === current && <Check size={14} aria-hidden="true" />}</b><span>{r.equipment}, {r.city}</span>
            </button>
          ))}
          <button type="button" className="dc-item reset" onClick={() => pick(onReset)}>
            <b><RotateCcw size={14} aria-hidden="true" />Reset the demo</b><span>Back to the start, with every change cleared</span>
          </button>
        </div>
      )}
    </div>
  );
}
