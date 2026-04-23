import { useState, useRef, useEffect } from "react";
import { useLocale } from "../i18n";
import type { Score } from "../types";
import "./ScoreInput.css";

interface ScoreInputProps {
  score: Score | null;
  onScoreChange: (score: Score | null) => void;
  isPrediction?: boolean;
  readonlyScore?: Score | null;
  allowPenalties?: boolean;
  locked?: boolean;
  synced?: boolean;
  disabled?: boolean;
  lockedReason?: string;
  autoSyncedAt?: number;
}

export function ScoreInput({ score, onScoreChange, isPrediction, readonlyScore, allowPenalties, locked, synced, disabled, lockedReason, autoSyncedAt }: ScoreInputProps) {
  const { t } = useLocale();
  const autoSyncTooltip = autoSyncedAt
    ? t("autoSync.autoSyncedTooltip", { datetime: new Date(autoSyncedAt).toLocaleString() })
    : undefined;
  const effectiveDisabled = locked || disabled;
  const inputTitle = effectiveDisabled
    ? (locked ? undefined : (lockedReason ?? autoSyncTooltip))
    : autoSyncTooltip;
  const [homeStr, setHomeStr] = useState(score?.home?.toString() ?? "");
  const [awayStr, setAwayStr] = useState(score?.away?.toString() ?? "");
  const homeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHomeStr(score?.home?.toString() ?? "");
    setAwayStr(score?.away?.toString() ?? "");
  }, [score]);

  function commitScore() {
    const home = parseInt(homeStr, 10);
    const away = parseInt(awayStr, 10);
    if (!isNaN(home) && !isNaN(away) && home >= 0 && away >= 0) {
      onScoreChange({ home, away, penalties: score?.penalties });
    } else if (homeStr === "" && awayStr === "") {
      onScoreChange(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { commitScore(); (e.target as HTMLInputElement).blur(); }
  }

  function getPredictionIndicator() {
    if (!readonlyScore || !score) return null;
    if (readonlyScore.home === score.home && readonlyScore.away === score.away) return { className: "exact", symbol: "✓" };
    const realOut = Math.sign(readonlyScore.home - readonlyScore.away);
    const predOut = Math.sign(score.home - score.away);
    if (realOut === predOut) return { className: "winner", symbol: "½" };
    return { className: "wrong", symbol: "✗" };
  }

  const indicator = getPredictionIndicator();

  return (
    <div className="score-input-wrapper">
      {readonlyScore && (
        <>
          <span className="score-readonly">{readonlyScore.home}</span>
          <span className="score-separator">-</span>
          <span className="score-readonly">{readonlyScore.away}</span>
          <span className="score-separator">|</span>
        </>
      )}
      <input ref={homeRef} type="number" min="0" max="99"
        className={`score-field ${isPrediction ? "prediction" : ""} ${locked ? "locked" : ""}`}
        disabled={locked || disabled}
        title={inputTitle}
        value={homeStr} onChange={(e) => setHomeStr(e.target.value)}
        onBlur={commitScore} onKeyDown={handleKeyDown}
        aria-label={t("scoreInput.ariaHome", { team: "home" })} />
      <span className="score-separator">-</span>
      <input type="number" min="0" max="99"
        className={`score-field ${isPrediction ? "prediction" : ""} ${locked ? "locked" : ""}`}
        disabled={locked || disabled}
        title={inputTitle}
        value={awayStr} onChange={(e) => setAwayStr(e.target.value)}
        onBlur={commitScore} onKeyDown={handleKeyDown}
        aria-label={t("scoreInput.ariaAway", { team: "away" })} />
      {locked && <span className="locked-badge" title={t("scoreInput.lockedBadgeTitle")}>{t("scoreInput.lockedBadge")}</span>}
      {synced && <span className="synced-badge" title={t("scoreInput.syncedTitle")}>↻</span>}
      {indicator && <span className={`prediction-indicator ${indicator.className}`}>{indicator.symbol}</span>}
      {allowPenalties && score && score.home === score.away && (
        <div className="penalties-input">
          <span>{t("scoreInput.penLabel")}</span>
          <input type="number" min="0" max="99" className="score-field"
            value={score.penalties?.home?.toString() ?? ""}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v)) onScoreChange({ ...score, penalties: { home: v, away: score.penalties?.away ?? 0 } });
            }} />
          <span className="score-separator">-</span>
          <input type="number" min="0" max="99" className="score-field"
            value={score.penalties?.away?.toString() ?? ""}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v)) onScoreChange({ ...score, penalties: { home: score.penalties?.home ?? 0, away: v } });
            }} />
        </div>
      )}
    </div>
  );
}
