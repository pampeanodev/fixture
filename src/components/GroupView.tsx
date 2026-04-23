import { useState, useEffect } from "react";
import { useFixture } from "../context/FixtureContext";
import { getTeam, GROUPS } from "../data/teams";
import { isMatchLocked } from "../utils/lockTime";
import { isMatchEditable } from "../espn/graceLock";
import { loadAutoSyncEnabled, loadAutoSyncMeta } from "../espn/autoSyncMeta";
import { loadBreakerState } from "../espn/circuitBreaker";
import { getEffectiveNow } from "../utils/devClock";
import { useLocale } from "../i18n";
import type { Score } from "../types";
import "./GroupView.css";

interface GroupViewProps { group: string; }

function ScoreField({ value, onChange, isPrediction, locked, disabled, lockedReason, autoSyncTooltip }: {
  value: string;
  onChange: (v: string) => void;
  isPrediction?: boolean;
  locked?: boolean;
  disabled?: boolean;
  lockedReason?: string;
  autoSyncTooltip?: string;
}) {
  const effectiveDisabled = locked || disabled;
  const title = effectiveDisabled
    ? (locked ? undefined : (lockedReason ?? autoSyncTooltip))
    : autoSyncTooltip;
  return (
    <input
      type="number" min="0" max="99"
      className={`group-match-score-input ${isPrediction ? "prediction" : ""} ${locked ? "locked" : ""}`}
      disabled={locked || disabled}
      title={title}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function GroupView({ group }: GroupViewProps) {
  const { state, dispatch, standingsByGroup } = useFixture();
  const { t } = useLocale();
  const standings = standingsByGroup[group] ?? [];
  const matches = state.groupMatches
    .filter((m) => m.group === group)
    .sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));
  const isPrediction = state.mode === "predictions";
  const autoSyncEnabled = loadAutoSyncEnabled();
  const breakerState = loadBreakerState();
  const now = getEffectiveNow();
  const autoSyncMeta = loadAutoSyncMeta();

  return (
    <div className="group-view">
      <div className="group-tabs" data-tour="group-tabs">
        {GROUPS.map((g) => (
          <button key={g}
            className={`group-tab ${g === group ? "active" : ""}`}
            onClick={() => dispatch({ type: "SET_VIEW", view: { type: "groups", group: g } })}>
            {g}
          </button>
        ))}
      </div>
      <h2>{t("groups.title", { group })}</h2>
      <table className="standings-table" data-tour="standings-table">
        <thead>
          <tr>
            <th>{t("groups.standings.team")}</th>
            <th>{t("groups.standings.played")}</th>
            <th>{t("groups.standings.won")}</th>
            <th>{t("groups.standings.drawn")}</th>
            <th>{t("groups.standings.lost")}</th>
            <th>{t("groups.standings.goalsFor")}</th>
            <th>{t("groups.standings.goalsAgainst")}</th>
            <th>{t("groups.standings.goalDifference")}</th>
            <th>{t("groups.standings.points")}</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, i) => {
            const team = getTeam(row.teamId);
            return (
              <tr key={row.teamId} className={i < 2 ? "qualify" : i === 2 ? "maybe-qualify" : ""}>
                <td><div className="team-cell"><span className="team-flag">{team?.flag}</span><span>{team ? t(`teams.${team.id}`) : row.teamId}</span></div></td>
                <td>{row.played}</td><td>{row.won}</td><td>{row.drawn}</td><td>{row.lost}</td>
                <td>{row.goalsFor}</td><td>{row.goalsAgainst}</td>
                <td>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                <td><strong>{row.points}</strong></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="group-matches-title">{t("groups.matches")}</div>
      <div className="group-matches-grid" data-tour="match-cards">
      {matches.map((match) => {
        const editable = isMatchEditable(match, {
          autoSyncEnabled,
          circuitBreakerTripped: breakerState.tripped,
          now,
        });
        const ts = autoSyncMeta.autoSyncedAt[match.id];
        const autoSyncTooltip = ts
          ? t("autoSync.autoSyncedTooltip", { datetime: new Date(ts).toLocaleString() })
          : undefined;
        return (
          <MatchCard
            key={match.id}
            homeTeamId={match.homeTeamId}
            awayTeamId={match.awayTeamId}
            dateUtc={match.dateUtc}
            result={match.result}
            prediction={match.prediction}
            isPrediction={isPrediction}
            locked={isPrediction && isMatchLocked(match.dateUtc)}
            synced={!isPrediction && state.syncedResultIds.includes(match.id)}
            disabled={!editable && !isPrediction}
            lockedReason={t("autoSync.waitingResult")}
            autoSyncTooltip={autoSyncTooltip}
            onScoreChange={(score) => dispatch({ type: "SET_GROUP_SCORE", matchId: match.id, score })}
          />
        );
      })}
      </div>
    </div>
  );
}

function MatchCard({ homeTeamId, awayTeamId, dateUtc, result, prediction, isPrediction, locked, synced, disabled, lockedReason, autoSyncTooltip, onScoreChange }: {
  homeTeamId: string;
  awayTeamId: string;
  dateUtc: string;
  result: Score | null;
  prediction: Score | null;
  isPrediction: boolean;
  locked?: boolean;
  synced?: boolean;
  disabled?: boolean;
  lockedReason?: string;
  autoSyncTooltip?: string;
  onScoreChange: (score: Score | null) => void;
}) {
  const { t, formatDate } = useLocale();
  const currentScore = isPrediction ? prediction : result;
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

  const homeTeam = getTeam(homeTeamId);
  const awayTeam = getTeam(awayTeamId);

  // Prediction comparison
  let indicator: { className: string; symbol: string } | null = null;
  if (isPrediction && result && prediction) {
    if (result.home === prediction.home && result.away === prediction.away) {
      indicator = { className: "exact", symbol: t("groups.matchCard.exact") };
    } else {
      const realOut = Math.sign(result.home - result.away);
      const predOut = Math.sign(prediction.home - prediction.away);
      indicator = realOut === predOut
        ? { className: "winner", symbol: t("groups.matchCard.winner") }
        : { className: "wrong", symbol: t("groups.matchCard.wrong") };
    }
  }

  return (
    <div className="group-match-card">
      <div className="group-match-date">{formatDate(dateUtc)}</div>
      <div className="group-match-team-row">
        <span className="team-flag">{homeTeam?.flag}</span>
        <span className="group-match-team-name">{homeTeam ? t(`teams.${homeTeam.id}`) : ""}</span>
        <ScoreField value={homeStr} isPrediction={isPrediction} locked={locked} disabled={disabled} lockedReason={lockedReason} autoSyncTooltip={autoSyncTooltip}
          onChange={(v) => { setHomeStr(v); commitScore(v, awayStr); }} />
      </div>
      <div className="group-match-team-row">
        <span className="team-flag">{awayTeam?.flag}</span>
        <span className="group-match-team-name">{awayTeam ? t(`teams.${awayTeam.id}`) : ""}</span>
        <ScoreField value={awayStr} isPrediction={isPrediction} locked={locked} disabled={disabled} lockedReason={lockedReason} autoSyncTooltip={autoSyncTooltip}
          onChange={(v) => { setAwayStr(v); commitScore(homeStr, v); }} />
      </div>
      {locked && <div className="group-match-locked">{t("groups.matchCard.locked")}</div>}
      {synced && <div className="group-match-synced" title={t("groups.matchCard.syncedTitle")}>{t("groups.matchCard.synced")}</div>}
      {isPrediction && result && (
        <div className="group-match-prediction-row">
          {t("groups.matchCard.real")}: {result.home} - {result.away}
          {indicator && <span className={`prediction-indicator ${indicator.className}`}>{indicator.symbol}</span>}
        </div>
      )}
    </div>
  );
}
