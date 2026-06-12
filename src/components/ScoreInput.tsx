import { useState, useRef, useEffect } from "react";
import { useLocale } from "../i18n";
import { indicatorFor } from "../utils/scoring";
import type { Score, Team } from "../types";
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
  homeTeam?: Team;
  awayTeam?: Team;
}

function getPenWinner(score: Score | null): "home" | "away" | null {
  if (!score?.penalties) return null;
  if (score.penalties.home > score.penalties.away) return "home";
  if (score.penalties.away > score.penalties.home) return "away";
  return null;
}

export function ScoreInput({ score, onScoreChange, isPrediction, readonlyScore, allowPenalties, locked, synced, disabled, lockedReason, autoSyncedAt, homeTeam, awayTeam }: ScoreInputProps) {
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

  function tryCommit(nextHome: string, nextAway: string) {
    const home = parseInt(nextHome, 10);
    const away = parseInt(nextAway, 10);
    if (!isNaN(home) && !isNaN(away) && home >= 0 && away >= 0) {
      onScoreChange({ home, away, penalties: score?.penalties });
    } else if (nextHome === "" && nextAway === "") {
      onScoreChange(null);
    }
  }

  function commitScore() {
    tryCommit(homeStr, awayStr);
  }

  function handleHomeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setHomeStr(v);
    tryCommit(v, awayStr);
  }

  function handleAwayChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setAwayStr(v);
    tryCommit(homeStr, v);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { commitScore(); (e.target as HTMLInputElement).blur(); }
  }

  const scored = indicatorFor(readonlyScore ?? null, score);
  const indicator = scored ? { className: scored.kind, symbol: scored.label } : null;

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
      <div className="score-with-pen">
        <div className="score-row">
          <input ref={homeRef} type="number" min="0" max="99"
            className={`score-field ${isPrediction ? "prediction" : ""} ${locked ? "locked" : ""}`}
            disabled={locked || disabled}
            title={inputTitle}
            value={homeStr} onChange={handleHomeChange}
            onBlur={commitScore} onKeyDown={handleKeyDown}
            aria-label={t("scoreInput.ariaHome", { team: "home" })} />
          <span className="score-separator">-</span>
          <input type="number" min="0" max="99"
            className={`score-field ${isPrediction ? "prediction" : ""} ${locked ? "locked" : ""}`}
            disabled={locked || disabled}
            title={inputTitle}
            value={awayStr} onChange={handleAwayChange}
            onBlur={commitScore} onKeyDown={handleKeyDown}
            aria-label={t("scoreInput.ariaAway", { team: "away" })} />
        </div>
        {allowPenalties && score && score.home === score.away && (() => {
          const penWinner = getPenWinner(score);
          const pickPen = (winner: "home" | "away") => {
            if (penWinner === winner) return;
            onScoreChange({ ...score, penalties: winner === "home" ? { home: 1, away: 0 } : { home: 0, away: 1 } });
          };
          return (
            <div className="penalties-input">
              <span className="penalties-label">{t("scoreInput.penLabel")}</span>
              <div className="penalties-row">
                <button type="button"
                  className={`penalties-pick ${penWinner === "home" ? "active" : ""}`}
                  disabled={locked || disabled}
                  onClick={() => pickPen("home")}
                  aria-pressed={penWinner === "home"}
                  aria-label={t("scoreInput.penPickAria", { team: homeTeam ? t(`teams.${homeTeam.id}`) : "home" })}>
                  {homeTeam?.flag ?? "1"}
                </button>
                <button type="button"
                  className={`penalties-pick ${penWinner === "away" ? "active" : ""}`}
                  disabled={locked || disabled}
                  onClick={() => pickPen("away")}
                  aria-pressed={penWinner === "away"}
                  aria-label={t("scoreInput.penPickAria", { team: awayTeam ? t(`teams.${awayTeam.id}`) : "away" })}>
                  {awayTeam?.flag ?? "2"}
                </button>
              </div>
            </div>
          );
        })()}
      </div>
      {locked && <span className="locked-badge" title={t("scoreInput.lockedBadgeTitle")}>{t("scoreInput.lockedBadge")}</span>}
      {synced && <span className="synced-badge" title={t("scoreInput.syncedTitle")}>↻</span>}
      {indicator && <span className={`prediction-indicator ${indicator.className}`}>{indicator.symbol}</span>}
    </div>
  );
}
