import { useMemo } from "react";
import { useFixture } from "../context/FixtureContext";
import { isMatchLocked } from "../utils/lockTime";
import { isMatchEditable } from "../espn/graceLock";
import { loadAutoSyncMeta } from "../espn/autoSyncMeta";
import { loadBreakerState } from "../espn/circuitBreaker";
import { getEffectiveNow } from "../utils/devClock";
import { useLocale } from "../i18n";
import { useViewMode } from "../context/ViewModeContext";
import { CompactMatchRow } from "./CompactMatchRow";
import { ScheduleMatchCard } from "./schedule/ScheduleMatchCard";
import type { KnockoutRound, Score } from "../types";
import "./ScheduleView.css";

interface UnifiedMatch {
  id: string;
  dateUtc: string;
  venue: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  stageKind: "group" | "knockout";
  stageValue: string; // group letter or round code
  isKnockout: boolean;
  prediction: Score | null;
  result: Score | null;
  editable: boolean;
}

export function ScheduleView() {
  const { state, dispatch, resolvedKnockout } = useFixture();
  const { t, locale } = useLocale();
  const { mode: viewMode } = useViewMode();

  const allMatches = useMemo(() => {
    const breakerState = loadBreakerState();
    const now = getEffectiveNow();
    const ctx = { circuitBreakerTripped: breakerState.tripped, now };
    const matches: UnifiedMatch[] = [];
    for (const m of state.groupMatches) {
      matches.push({
        id: m.id, dateUtc: m.dateUtc, venue: m.venue,
        homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId,
        stageKind: "group", stageValue: m.group, isKnockout: false,
        prediction: m.prediction, result: m.result,
        editable: isMatchEditable(m, ctx),
      });
    }
    for (const m of resolvedKnockout) {
      matches.push({
        id: m.id, dateUtc: m.dateUtc, venue: m.venue,
        homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId,
        stageKind: "knockout", stageValue: m.round, isKnockout: true,
        prediction: m.prediction, result: m.result,
        editable: isMatchEditable(m, ctx),
      });
    }
    matches.sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));
    return matches;
  }, [state.groupMatches, resolvedKnockout]);

  const dayFormatter = useMemo(() => {
    const bcp = locale === "es" ? "es-AR" : locale === "pt" ? "pt-BR" : "en-US";
    return new Intl.DateTimeFormat(bcp, { weekday: "long", day: "numeric", month: "long" });
  }, [locale]);

  const matchesByDay = useMemo(() => {
    const groups: { day: string; matches: UnifiedMatch[] }[] = [];
    let currentDay = "";
    for (const match of allMatches) {
      const date = new Date(match.dateUtc);
      const day = dayFormatter.format(date);
      if (day !== currentDay) {
        currentDay = day;
        groups.push({ day, matches: [] });
      }
      groups[groups.length - 1].matches.push(match);
    }
    return groups;
  }, [allMatches, dayFormatter]);

  const autoSyncMeta = loadAutoSyncMeta();

  function handleScoreChange(matchId: string, isKnockout: boolean, score: Score | null, field: "prediction" | "result") {
    if (isKnockout) {
      dispatch({ type: "SET_KNOCKOUT_SCORE", matchId, score, field });
    } else {
      dispatch({ type: "SET_GROUP_SCORE", matchId, score, field });
    }
  }

  function stageLabelFor(m: UnifiedMatch): string {
    if (m.stageKind === "group") return t("schedule.stage.group", { group: m.stageValue });
    return t(`schedule.stage.${m.stageValue as KnockoutRound}`);
  }

  return (
    <div className={`schedule-view ${viewMode}`}>
      <h2>{t("schedule.title")}</h2>
      {matchesByDay.length === 0 ? (
        <p>{t("schedule.empty")}</p>
      ) : matchesByDay.map(({ day, matches }) => (
        <div key={day}>
          {viewMode === "compact" ? (
            <div className="schedule-day-header-compact"><span>{day}</span></div>
          ) : (
            <div className="schedule-day-header">{day}</div>
          )}
          {viewMode === "compact" ? (
            <div className="schedule-day-matches-compact">
              {matches.map((match) => {
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
                    badgeLabel={stageLabelFor(match)}
                    badgeKind={match.isKnockout ? "knockout" : "group"}
                    prediction={match.prediction}
                    result={match.result}
                    predictionLocked={isMatchLocked(match.dateUtc)}
                    resultEditable={match.editable}
                    synced={state.syncedResultIds.includes(match.id)}
                    autoSyncTooltip={autoSyncTooltip}
                    pendingLabel={match.id}
                    onPredictionChange={(score) => handleScoreChange(match.id, match.isKnockout, score, "prediction")}
                    onResultChange={(score) => handleScoreChange(match.id, match.isKnockout, score, "result")}
                  />
                );
              })}
            </div>
          ) : (
            <div className="schedule-day-matches">
              {matches.map((match) => {
                const ts = autoSyncMeta.autoSyncedAt[match.id];
                const autoSyncTooltip = ts
                  ? t("autoSync.autoSyncedTooltip", { datetime: new Date(ts).toLocaleString() })
                  : undefined;
                return (
                  <ScheduleMatchCard
                    key={match.id}
                    match={match}
                    label={stageLabelFor(match)}
                    predictionLocked={isMatchLocked(match.dateUtc)}
                    resultEditable={match.editable}
                    synced={state.syncedResultIds.includes(match.id)}
                    autoSyncTooltip={autoSyncTooltip}
                    onPredictionChange={(score) => handleScoreChange(match.id, match.isKnockout, score, "prediction")}
                    onResultChange={(score) => handleScoreChange(match.id, match.isKnockout, score, "result")}
                  />
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
