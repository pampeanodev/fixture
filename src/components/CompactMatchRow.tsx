import { useState, useEffect } from "react";
import { getTeam } from "../data/teams";
import { useLocale } from "../i18n";
import { indicatorFor } from "../utils/scoring";
import { CompactResult } from "./CompactResult";
import type { Score } from "../types";
import "./CompactMatchRow.css";

export interface CompactMatchRowProps {
  homeTeamId: string | null;
  awayTeamId: string | null;
  dateUtc: string;
  badgeLabel: string;
  badgeKind: "group" | "knockout";
  prediction: Score | null;
  result: Score | null;
  predictionLocked: boolean;     // isMatchLocked -> prediction inputs read-only
  resultEditable: boolean;       // fallback -> result badge becomes inputs
  synced?: boolean;
  autoSyncTooltip?: string;
  showDate?: boolean;            // badge shows the match date (views without day headers, e.g. groups)
  pendingLabel?: string;         // shown when a team slot is unresolved (knockouts only)
  onPredictionChange: (score: Score | null) => void;
  onResultChange: (score: Score | null) => void;
}

function penWinnerOf(score: Score | null): "home" | "away" | null {
  if (!score?.penalties) return null;
  if (score.penalties.home > score.penalties.away) return "home";
  if (score.penalties.away > score.penalties.home) return "away";
  return null;
}

export function CompactMatchRow(props: CompactMatchRowProps) {
  const {
    homeTeamId, awayTeamId, dateUtc, badgeLabel, badgeKind,
    prediction, result, predictionLocked, resultEditable, synced,
    autoSyncTooltip, showDate, pendingLabel, onPredictionChange, onResultChange,
  } = props;
  const { t, formatTime, formatDateShort } = useLocale();
  const [homeStr, setHomeStr] = useState(prediction?.home?.toString() ?? "");
  const [awayStr, setAwayStr] = useState(prediction?.away?.toString() ?? "");

  useEffect(() => {
    setHomeStr(prediction?.home?.toString() ?? "");
    setAwayStr(prediction?.away?.toString() ?? "");
  }, [prediction]);

  function commitPrediction(hStr: string, aStr: string) {
    const h = parseInt(hStr, 10);
    const a = parseInt(aStr, 10);
    if (!isNaN(h) && !isNaN(a) && h >= 0 && a >= 0) {
      onPredictionChange({ home: h, away: a, penalties: prediction?.penalties });
    } else if (hStr === "" && aStr === "") {
      onPredictionChange(null);
    }
  }

  const homeTeam = homeTeamId ? getTeam(homeTeamId) : null;
  const awayTeam = awayTeamId ? getTeam(awayTeamId) : null;
  const bothKnown = homeTeamId !== null && awayTeamId !== null;
  const time = formatTime(dateUtc);
  const inputTitle = predictionLocked ? undefined : autoSyncTooltip;
  const tied = prediction !== null && prediction.home === prediction.away;
  const showPen = badgeKind === "knockout" && bothKnown && tied;
  const penWinner = penWinnerOf(prediction);

  function pickPen(winner: "home" | "away") {
    if (!prediction || prediction.home !== prediction.away) return;
    if (penWinner === winner) return;
    const penalties = winner === "home" ? { home: 1, away: 0 } : { home: 0, away: 1 };
    onPredictionChange({ ...prediction, penalties });
  }

  const scored = indicatorFor(result, prediction);
  const indicator = scored ? { className: scored.kind, text: scored.label } : null;

  return (
    <div className={`compact-match-row ${badgeKind} ${synced ? "synced" : ""} ${showPen ? "with-pen" : ""}`}>
      <span className={`compact-badge ${badgeKind}`}>
        <span className="badge-label">{badgeLabel}</span>
        {showDate && <span className="badge-date">{formatDateShort(dateUtc)}</span>}
        <span className="badge-time">{time}</span>
      </span>
      <span className="compact-team home">
        {homeTeam ? (
          <>
            <span className="compact-team-name">{t(`teams.${homeTeam.id}`)}</span>
            <span className="team-flag">{homeTeam.flag}</span>
          </>
        ) : (
          <span className="compact-team-name pending">{pendingLabel ?? ""}</span>
        )}
      </span>
      <span className="compact-scores">
        {bothKnown ? (
          <>
            <input type="number" min="0" max="99"
              className={`compact-score-input prediction ${predictionLocked ? "locked" : ""}`}
              disabled={predictionLocked}
              title={inputTitle}
              value={homeStr}
              onChange={(e) => { setHomeStr(e.target.value); commitPrediction(e.target.value, awayStr); }} />
            <span className="compact-score-sep">–</span>
            <input type="number" min="0" max="99"
              className={`compact-score-input prediction ${predictionLocked ? "locked" : ""}`}
              disabled={predictionLocked}
              title={inputTitle}
              value={awayStr}
              onChange={(e) => { setAwayStr(e.target.value); commitPrediction(homeStr, e.target.value); }} />
          </>
        ) : (
          <span className="compact-score-sep">{t("knockout.vs")}</span>
        )}
      </span>
      <span className="compact-team away">
        {awayTeam ? (
          <>
            <span className="team-flag">{awayTeam.flag}</span>
            <span className="compact-team-name">{t(`teams.${awayTeam.id}`)}</span>
          </>
        ) : (
          <span className="compact-team-name pending">{pendingLabel ?? ""}</span>
        )}
      </span>
      <CompactResult format="badge" result={result} editable={resultEditable && bothKnown} onChange={onResultChange} label={t("matchCard.resultBadge")} locked={predictionLocked} lockedLabel={t("scoreInput.lockedBadge")} />
      <span className={`compact-indicator ${indicator ? indicator.className : "none"}`}>
        {indicator ? indicator.text : "·"}
      </span>
      {synced && <span className="compact-status synced" title={t("scoreInput.syncedTitle")}>↻</span>}
      {showPen && (
        <div className="compact-pen-row">
          <span className="compact-pen-label">{t("scoreInput.penLabel")}</span>
          <button type="button"
            className={`compact-pen-pick ${penWinner === "home" ? "active" : ""}`}
            disabled={predictionLocked}
            onClick={() => pickPen("home")}
            aria-pressed={penWinner === "home"}
            aria-label={t("scoreInput.penPickAria", { team: homeTeam ? t(`teams.${homeTeam.id}`) : "home" })}>
            {homeTeam?.flag ?? "1"}
          </button>
          <button type="button"
            className={`compact-pen-pick ${penWinner === "away" ? "active" : ""}`}
            disabled={predictionLocked}
            onClick={() => pickPen("away")}
            aria-pressed={penWinner === "away"}
            aria-label={t("scoreInput.penPickAria", { team: awayTeam ? t(`teams.${awayTeam.id}`) : "away" })}>
            {awayTeam?.flag ?? "2"}
          </button>
        </div>
      )}
      <CompactResult format="line" result={result} editable={resultEditable && bothKnown} onChange={onResultChange} label={t("matchCard.resultBadge")} locked={predictionLocked} lockedLabel={t("scoreInput.lockedBadge")} />
    </div>
  );
}
