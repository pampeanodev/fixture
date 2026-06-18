import { useState, useRef, useEffect } from "react";
import { useLocale } from "../i18n";
import { indicatorFor } from "../utils/scoring";
import type { Score, Team } from "../types";
import "./ScoreInput.css";

interface ScoreInputProps {
  prediction: Score | null;
  result: Score | null;
  onPredictionChange: (score: Score | null) => void;
  onResultChange: (score: Score | null) => void;
  predictionLocked?: boolean;   // isMatchLocked -> prediction inputs read-only
  resultEditable?: boolean;     // fallback -> result becomes editable inline
  allowPenalties?: boolean;
  synced?: boolean;
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

export function ScoreInput({ prediction, result, onPredictionChange, onResultChange, predictionLocked, resultEditable, allowPenalties, synced, autoSyncedAt, homeTeam, awayTeam }: ScoreInputProps) {
  const { t } = useLocale();
  const autoSyncTooltip = autoSyncedAt
    ? t("autoSync.autoSyncedTooltip", { datetime: new Date(autoSyncedAt).toLocaleString() })
    : undefined;
  const inputTitle = predictionLocked ? undefined : autoSyncTooltip;
  const [homeStr, setHomeStr] = useState(prediction?.home?.toString() ?? "");
  const [awayStr, setAwayStr] = useState(prediction?.away?.toString() ?? "");
  const homeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHomeStr(prediction?.home?.toString() ?? "");
    setAwayStr(prediction?.away?.toString() ?? "");
  }, [prediction]);

  function tryCommit(nextHome: string, nextAway: string) {
    const home = parseInt(nextHome, 10);
    const away = parseInt(nextAway, 10);
    if (!isNaN(home) && !isNaN(away) && home >= 0 && away >= 0) {
      onPredictionChange({ home, away, penalties: prediction?.penalties });
    } else if (nextHome === "" && nextAway === "") {
      onPredictionChange(null);
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

  const scored = indicatorFor(result, prediction);
  const indicator = scored ? { className: scored.kind, symbol: scored.label } : null;

  return (
    <div className="score-input-wrapper">
      <ResultDisplay result={result} editable={!!resultEditable} onChange={onResultChange} />
      <div className="score-with-pen">
        <div className="score-row">
          <input ref={homeRef} type="number" min="0" max="99"
            className={`score-field prediction ${predictionLocked ? "locked" : ""}`}
            disabled={predictionLocked}
            title={inputTitle}
            value={homeStr} onChange={handleHomeChange}
            onBlur={commitScore} onKeyDown={handleKeyDown}
            aria-label={t("scoreInput.ariaHome", { team: "home" })} />
          <span className="score-separator">-</span>
          <input type="number" min="0" max="99"
            className={`score-field prediction ${predictionLocked ? "locked" : ""}`}
            disabled={predictionLocked}
            title={inputTitle}
            value={awayStr} onChange={handleAwayChange}
            onBlur={commitScore} onKeyDown={handleKeyDown}
            aria-label={t("scoreInput.ariaAway", { team: "away" })} />
        </div>
        {allowPenalties && prediction && prediction.home === prediction.away && (() => {
          const penWinner = getPenWinner(prediction);
          const pickPen = (winner: "home" | "away") => {
            if (penWinner === winner) return;
            onPredictionChange({ ...prediction, penalties: winner === "home" ? { home: 1, away: 0 } : { home: 0, away: 1 } });
          };
          return (
            <div className="penalties-input">
              <span className="penalties-label">{t("scoreInput.penLabel")}</span>
              <div className="penalties-row">
                <button type="button"
                  className={`penalties-pick ${penWinner === "home" ? "active" : ""}`}
                  disabled={predictionLocked}
                  onClick={() => pickPen("home")}
                  aria-pressed={penWinner === "home"}
                  aria-label={t("scoreInput.penPickAria", { team: homeTeam ? t(`teams.${homeTeam.id}`) : "home" })}>
                  {homeTeam?.flag ?? "1"}
                </button>
                <button type="button"
                  className={`penalties-pick ${penWinner === "away" ? "active" : ""}`}
                  disabled={predictionLocked}
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
      {predictionLocked && <span className="locked-badge" title={t("scoreInput.lockedBadgeTitle")}>{t("scoreInput.lockedBadge")}</span>}
      {synced && <span className="synced-badge" title={t("scoreInput.syncedTitle")}>↻</span>}
      {indicator && <span className={`prediction-indicator ${indicator.className}`}>{indicator.symbol}</span>}
    </div>
  );
}

function ResultDisplay({ result, editable, onChange }: {
  result: Score | null;
  editable: boolean;
  onChange: (score: Score | null) => void;
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
  if (editable && result) {
    return (
      <>
        <input type="number" min="0" max="99" className="score-field result-edit" value={h}
          onChange={(e) => { setH(e.target.value); commit(e.target.value, a); }} />
        <span className="score-separator">-</span>
        <input type="number" min="0" max="99" className="score-field result-edit" value={a}
          onChange={(e) => { setA(e.target.value); commit(h, e.target.value); }} />
        <span className="score-separator">|</span>
      </>
    );
  }
  if (!result) return null;
  return (
    <>
      <span className="score-readonly">{result.home}</span>
      <span className="score-separator">-</span>
      <span className="score-readonly">{result.away}</span>
      <span className="score-separator">|</span>
    </>
  );
}
