import { useState } from "react";
import { useFixture } from "../context/FixtureContext";
import { getTeam, GROUPS } from "../data/teams";
import { isMatchLocked } from "../utils/lockTime";
import { isMatchEditable } from "../espn/graceLock";
import { loadAutoSyncMeta } from "../espn/autoSyncMeta";
import { loadBreakerState } from "../espn/circuitBreaker";
import { getEffectiveNow } from "../utils/devClock";
import { useLocale } from "../i18n";
import { useViewMode } from "../context/ViewModeContext";
import { CompactMatchRow } from "./CompactMatchRow";
import { CompactStandings } from "./CompactStandings";
import { GroupMatchCard } from "./group/GroupMatchCard";
import { GroupStandingsToggle, type StandingsSource } from "./group/GroupStandingsToggle";
import "./GroupView.css";

interface GroupViewProps { group: string; }

export function GroupView({ group }: GroupViewProps) {
  const { state, dispatch, standingsByGroup, realStandingsByGroup, groupSeedsConfirmed } = useFixture();
  const { t } = useLocale();
  const { mode: viewMode } = useViewMode();
  const [source, setSource] = useState<StandingsSource>("real");
  const standings =
    (source === "real" ? realStandingsByGroup[group] : standingsByGroup[group]) ?? [];
  const confirmedTeamIds = groupSeedsConfirmed[group];
  const matches = state.groupMatches
    .filter((m) => m.group === group)
    .sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));
  const breakerState = loadBreakerState();
  const now = getEffectiveNow();
  const autoSyncMeta = loadAutoSyncMeta();

  return (
    <div className={`group-view ${viewMode}`}>
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

      {viewMode === "compact" ? (
        <>
          <GroupStandingsToggle value={source} onChange={setSource} />
          <CompactStandings standings={standings} confirmedTeamIds={confirmedTeamIds} />
          <div className="group-matches-title">{t("groups.matches")}</div>
          <div className="group-matches-compact" data-tour="match-cards">
            {matches.map((match) => {
              const editable = isMatchEditable(match, {
                circuitBreakerTripped: breakerState.tripped,
                now,
              });
              const ts = autoSyncMeta.autoSyncedAt[match.id];
              const autoSyncTooltip = ts
                ? t("autoSync.autoSyncedTooltip", { datetime: new Date(ts).toLocaleString() })
                : undefined;
              return (
                <CompactMatchRow
                  key={match.id}
                  homeTeamId={match.homeTeamId}
                  awayTeamId={match.awayTeamId}
                  dateUtc={match.dateUtc}
                  badgeLabel={t("schedule.stage.group", { group: match.group })}
                  badgeKind="group"
                  prediction={match.prediction}
                  result={match.result}
                  predictionLocked={isMatchLocked(match.dateUtc)}
                  resultEditable={editable}
                  synced={state.syncedResultIds.includes(match.id)}
                  autoSyncTooltip={autoSyncTooltip}
                  showDate
                  pendingLabel={match.id}
                  onPredictionChange={(score) => dispatch({ type: "SET_GROUP_SCORE", matchId: match.id, score, field: "prediction" })}
                  onResultChange={(score) => dispatch({ type: "SET_GROUP_SCORE", matchId: match.id, score, field: "result" })}
                />
              );
            })}
          </div>
        </>
      ) : (
        <>
          <GroupStandingsToggle value={source} onChange={setSource} />
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
                    <td><div className="team-cell"><span className="team-flag">{team?.flag}</span><span>{team ? t(`teams.${team.id}`) : row.teamId}</span>{confirmedTeamIds?.has(row.teamId) && <span className="group-confirmed" title={t("knockout.confirmed")}>✓</span>}</div></td>
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
                circuitBreakerTripped: breakerState.tripped,
                now,
              });
              const ts = autoSyncMeta.autoSyncedAt[match.id];
              const autoSyncTooltip = ts
                ? t("autoSync.autoSyncedTooltip", { datetime: new Date(ts).toLocaleString() })
                : undefined;
              return (
                <GroupMatchCard
                  key={match.id}
                  homeTeamId={match.homeTeamId}
                  awayTeamId={match.awayTeamId}
                  dateUtc={match.dateUtc}
                  prediction={match.prediction}
                  result={match.result}
                  predictionLocked={isMatchLocked(match.dateUtc)}
                  resultEditable={editable}
                  synced={state.syncedResultIds.includes(match.id)}
                  autoSyncTooltip={autoSyncTooltip}
                  onPredictionChange={(score) => dispatch({ type: "SET_GROUP_SCORE", matchId: match.id, score, field: "prediction" })}
                  onResultChange={(score) => dispatch({ type: "SET_GROUP_SCORE", matchId: match.id, score, field: "result" })}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
