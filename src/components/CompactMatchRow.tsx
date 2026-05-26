import { useState, useEffect } from "react";
import { getTeam } from "../data/teams";
import { useLocale } from "../i18n";
import type { Score } from "../types";
import "./CompactMatchRow.css";

export interface CompactMatchRowProps {
  homeTeamId: string | null;
  awayTeamId: string | null;
  dateUtc: string;
  badgeLabel: string;
  badgeKind: "group" | "knockout";
  currentScore: Score | null;
  realScore: Score | null;        // for prediction-mode comparison only
  isPrediction: boolean;
  locked?: boolean;
  synced?: boolean;
  disabled?: boolean;
  lockedReason?: string;
  autoSyncTooltip?: string;
  pendingLabel?: string;          // shown when a team slot is unresolved (knockouts only)
  onScoreChange: (score: Score | null) => void;
}

export function CompactMatchRow(props: CompactMatchRowProps) {
  const {
    homeTeamId, awayTeamId, dateUtc, badgeLabel, badgeKind, currentScore,
    realScore, isPrediction, locked, synced, disabled, lockedReason,
    autoSyncTooltip, pendingLabel, onScoreChange,
  } = props;
  const { t, formatTime } = useLocale();
  const [homeStr, setHomeStr] = useState(currentScore?.home?.toString() ?? "");
  const [awayStr, setAwayStr] = useState(currentScore?.away?.toString() ?? "");

  useEffect(() => {
    setHomeStr(currentScore?.home?.toString() ?? "");
    setAwayStr(currentScore?.away?.toString() ?? "");
  }, [currentScore]);

  function commitScore(hStr: string, aStr: string) {
    const h = parseInt(hStr, 10);
    const a = parseInt(aStr, 10);
    if (!isNaN(h) && !isNaN(a) && h >= 0 && a >= 0) {
      onScoreChange({ home: h, away: a });
    } else if (hStr === "" && aStr === "") {
      onScoreChange(null);
    }
  }

  const homeTeam = homeTeamId ? getTeam(homeTeamId) : null;
  const awayTeam = awayTeamId ? getTeam(awayTeamId) : null;
  const bothKnown = homeTeamId !== null && awayTeamId !== null;
  const time = formatTime(dateUtc);
  const effectiveDisabled = locked || disabled;
  const inputTitle = effectiveDisabled
    ? (locked ? undefined : (lockedReason ?? autoSyncTooltip))
    : autoSyncTooltip;

  let indicator: { className: string; text: string } | null = null;
  if (isPrediction && realScore && currentScore) {
    if (realScore.home === currentScore.home && realScore.away === currentScore.away) {
      indicator = { className: "exact", text: "✓" };
    } else if (Math.sign(realScore.home - realScore.away) === Math.sign(currentScore.home - currentScore.away)) {
      indicator = { className: "winner", text: "½" };
    } else {
      indicator = { className: "wrong", text: "✗" };
    }
  }

  return (
    <div className={`compact-match-row ${badgeKind} ${synced ? "synced" : ""}`}>
      <span className={`compact-badge ${badgeKind}`}>
        <span className="badge-label">{badgeLabel}</span>
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
              className={`compact-score-input ${isPrediction ? "prediction" : ""} ${locked ? "locked" : ""}`}
              disabled={effectiveDisabled}
              title={inputTitle}
              value={homeStr}
              onChange={(e) => { setHomeStr(e.target.value); commitScore(e.target.value, awayStr); }} />
            <span className="compact-score-sep">–</span>
            <input type="number" min="0" max="99"
              className={`compact-score-input ${isPrediction ? "prediction" : ""} ${locked ? "locked" : ""}`}
              disabled={effectiveDisabled}
              title={inputTitle}
              value={awayStr}
              onChange={(e) => { setAwayStr(e.target.value); commitScore(homeStr, e.target.value); }} />
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
      {indicator && <span className={`compact-indicator ${indicator.className}`}>{indicator.text}</span>}
      {locked && !indicator && <span className="compact-status locked" title={lockedReason}>🔒</span>}
      {synced && !indicator && <span className="compact-status synced" title={t("scoreInput.syncedTitle")}>↻</span>}
    </div>
  );
}
