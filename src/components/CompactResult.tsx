import { useState, useEffect } from "react";
import type { Score } from "../types";

// The real-result cell of a CompactMatchRow. Renders as the tight desktop badge
// column or the full-width mobile line. Falls back to editable inputs when the
// result is manually editable, and to a lock indicator while predictions are
// closed with no result yet.
export function CompactResult({ format, result, editable, onChange, label, locked, lockedLabel }: {
  format: "badge" | "line";
  result: Score | null;
  editable: boolean;
  onChange: (score: Score | null) => void;
  label: string;
  locked: boolean;
  lockedLabel: string;
}) {
  const [h, setH] = useState(result?.home?.toString() ?? "");
  const [a, setA] = useState(result?.away?.toString() ?? "");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- controlled-input resync to external result, matches the prediction-input pattern above
  useEffect(() => { setH(result?.home?.toString() ?? ""); setA(result?.away?.toString() ?? ""); }, [result]);
  function commit(hStr: string, aStr: string) {
    const hh = parseInt(hStr, 10), aa = parseInt(aStr, 10);
    if (!isNaN(hh) && !isNaN(aa) && hh >= 0 && aa >= 0) onChange({ home: hh, away: aa });
    else if (hStr === "" && aStr === "") onChange(null);
  }
  const cls = format === "badge" ? "compact-result-badge" : "compact-result-line";
  if (editable) {
    return (
      <span className={`${cls} editable`} title={label}>
        {format === "line" && <span className="compact-result-line-label">{label}:</span>}
        <input type="number" min="0" max="99" className="compact-score-input"
          value={h}
          onChange={(e) => { setH(e.target.value); commit(e.target.value, a); }} />
        <span>–</span>
        <input type="number" min="0" max="99" className="compact-score-input"
          value={a}
          onChange={(e) => { setA(e.target.value); commit(h, e.target.value); }} />
      </span>
    );
  }
  if (!result) {
    // No result yet. While predictions are locked (match in progress / closed),
    // show the lock indicator: just the padlock in the tight desktop badge
    // column, the full label on the mobile result line.
    if (locked) {
      return format === "badge"
        ? <span className="compact-result-badge locked" title={lockedLabel}>🔒</span>
        : <span className="compact-result-line locked">{lockedLabel}</span>;
    }
    // Otherwise the badge keeps an empty placeholder to hold its grid column on
    // desktop; the line simply renders nothing (no second row) for pending matches.
    return format === "badge" ? <span className="compact-result-badge none" aria-hidden="true" /> : null;
  }
  if (format === "line") {
    return (
      <span className="compact-result-line">
        <span className="compact-result-line-label">{label}:</span> {result.home}–{result.away}
      </span>
    );
  }
  return <span className="compact-result-badge" title={label}>{result.home}–{result.away}</span>;
}
