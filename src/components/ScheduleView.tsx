import { useMemo, useState, useEffect } from "react";
import { useFixture } from "../context/FixtureContext";
import { getTeam } from "../data/teams";
import { isMatchLocked } from "../utils/lockTime";
import { isMatchEditable } from "../espn/graceLock";
import { loadAutoSyncEnabled, loadAutoSyncMeta } from "../espn/autoSyncMeta";
import { loadBreakerState } from "../espn/circuitBreaker";
import { getEffectiveNow } from "../utils/devClock";
import { useLocale } from "../i18n";
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
  hasResult: boolean;
  currentScore: Score | null;
  realScore: Score | null;
  editable: boolean;
}

export function ScheduleView() {
  const { state, dispatch, resolvedKnockout } = useFixture();
  const { t, locale } = useLocale();
  const isPrediction = state.mode === "predictions";
  const scoreField = isPrediction ? "prediction" : "result";

  const allMatches = useMemo(() => {
    const autoSyncEnabled = loadAutoSyncEnabled();
    const breakerState = loadBreakerState();
    const now = getEffectiveNow();
    const ctx = {
      autoSyncEnabled,
      circuitBreakerTripped: breakerState.tripped,
      now,
    };
    const matches: UnifiedMatch[] = [];
    for (const m of state.groupMatches) {
      matches.push({
        id: m.id, dateUtc: m.dateUtc, venue: m.venue,
        homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId,
        stageKind: "group", stageValue: m.group, isKnockout: false,
        hasResult: m[scoreField] !== null,
        currentScore: m[scoreField],
        realScore: m.result,
        editable: isMatchEditable(m, ctx),
      });
    }
    for (const m of resolvedKnockout) {
      matches.push({
        id: m.id, dateUtc: m.dateUtc, venue: m.venue,
        homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId,
        stageKind: "knockout", stageValue: m.round, isKnockout: true,
        hasResult: m[scoreField] !== null,
        currentScore: m[scoreField],
        realScore: m.result,
        editable: isMatchEditable(m, ctx),
      });
    }
    matches.sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));
    return matches;
  }, [state.groupMatches, resolvedKnockout, scoreField]);

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

  function handleScoreChange(matchId: string, isKnockout: boolean, score: Score | null) {
    if (isKnockout) {
      dispatch({ type: "SET_KNOCKOUT_SCORE", matchId, score });
    } else {
      dispatch({ type: "SET_GROUP_SCORE", matchId, score });
    }
  }

  function stageLabelFor(m: UnifiedMatch): string {
    if (m.stageKind === "group") return t("schedule.stage.group", { group: m.stageValue });
    return t(`schedule.stage.${m.stageValue as KnockoutRound}`);
  }

  return (
    <div className="schedule-view">
      <h2>{t("schedule.title")}</h2>
      {matchesByDay.length === 0 ? (
        <p>{t("schedule.empty")}</p>
      ) : matchesByDay.map(({ day, matches }) => (
        <div key={day}>
          <div className="schedule-day-header">{day}</div>
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
                isPrediction={isPrediction}
                locked={isPrediction && isMatchLocked(match.dateUtc)}
                synced={!isPrediction && state.syncedResultIds.includes(match.id)}
                disabled={!match.editable && !isPrediction}
                lockedReason={t("autoSync.waitingResult")}
                autoSyncTooltip={autoSyncTooltip}
                onScoreChange={(score) => handleScoreChange(match.id, match.isKnockout, score)}
              />
            );
          })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScheduleMatchCard({ match, label, isPrediction, locked, synced, disabled, lockedReason, autoSyncTooltip, onScoreChange }: {
  match: UnifiedMatch;
  label: string;
  isPrediction: boolean;
  locked?: boolean;
  synced?: boolean;
  disabled?: boolean;
  lockedReason?: string;
  autoSyncTooltip?: string;
  onScoreChange: (score: Score | null) => void;
}) {
  const effectiveDisabled = locked || disabled;
  const inputTitle = effectiveDisabled
    ? (locked ? undefined : (lockedReason ?? autoSyncTooltip))
    : autoSyncTooltip;
  const { t, formatTime } = useLocale();
  const [homeStr, setHomeStr] = useState(match.currentScore?.home?.toString() ?? "");
  const [awayStr, setAwayStr] = useState(match.currentScore?.away?.toString() ?? "");

  useEffect(() => {
    setHomeStr(match.currentScore?.home?.toString() ?? "");
    setAwayStr(match.currentScore?.away?.toString() ?? "");
  }, [match.currentScore]);

  function commitScore(hStr: string, aStr: string) {
    const h = parseInt(hStr, 10);
    const a = parseInt(aStr, 10);
    if (!isNaN(h) && !isNaN(a) && h >= 0 && a >= 0) {
      onScoreChange({ home: h, away: a });
    } else if (hStr === "" && aStr === "") {
      onScoreChange(null);
    }
  }

  const homeTeam = match.homeTeamId ? getTeam(match.homeTeamId) : null;
  const awayTeam = match.awayTeamId ? getTeam(match.awayTeamId) : null;
  const bothKnown = match.homeTeamId !== null && match.awayTeamId !== null;

  const time = formatTime(match.dateUtc);

  let indicator: { className: string; text: string } | null = null;
  if (isPrediction && match.realScore && match.currentScore) {
    const r = match.realScore;
    const p = match.currentScore;
    if (r.home === p.home && r.away === p.away) {
      indicator = { className: "exact", text: "✓" };
    } else if (Math.sign(r.home - r.away) === Math.sign(p.home - p.away)) {
      indicator = { className: "winner", text: "½" };
    } else {
      indicator = { className: "wrong", text: "✗" };
    }
  }

  return (
    <div className={`schedule-match-card ${match.isKnockout ? "knockout" : ""} ${match.hasResult ? "has-result" : ""}`}>
      <div className="schedule-match-top">
        <span>{time}</span>
        <span className={`schedule-badge ${match.isKnockout ? "ko" : "group"}`}>{label}</span>
        <span className="schedule-match-venue">{match.venue}</span>
      </div>
      <div className="schedule-team-row">
        {homeTeam ? (
          <>
            <span className="team-flag">{homeTeam.flag}</span>
            <span className="schedule-team-row-name">{t(`teams.${homeTeam.id}`)}</span>
          </>
        ) : (
          <span className="schedule-team-row-name pending">{match.id}</span>
        )}
        {bothKnown && (
          <input type="number" min="0" max="99"
            className={`schedule-score-input ${isPrediction ? "prediction" : ""} ${locked ? "locked" : ""}`}
            disabled={locked || disabled}
            title={inputTitle}
            value={homeStr}
            onChange={(e) => { setHomeStr(e.target.value); commitScore(e.target.value, awayStr); }} />
        )}
      </div>
      <div className="schedule-team-row">
        {awayTeam ? (
          <>
            <span className="team-flag">{awayTeam.flag}</span>
            <span className="schedule-team-row-name">{t(`teams.${awayTeam.id}`)}</span>
          </>
        ) : (
          <span className="schedule-team-row-name pending">{match.id}</span>
        )}
        {bothKnown && (
          <input type="number" min="0" max="99"
            className={`schedule-score-input ${isPrediction ? "prediction" : ""} ${locked ? "locked" : ""}`}
            disabled={locked || disabled}
            title={inputTitle}
            value={awayStr}
            onChange={(e) => { setAwayStr(e.target.value); commitScore(homeStr, e.target.value); }} />
        )}
      </div>
      {locked && <div className="schedule-locked">{t("schedule.matchCard.locked")}</div>}
      {synced && <div className="schedule-synced" title={t("schedule.matchCard.syncedTitle")}>{t("schedule.matchCard.synced")}</div>}
      {isPrediction && match.realScore && (
        <div className="schedule-prediction-row">
          {t("schedule.matchCard.real")}: {match.realScore.home} - {match.realScore.away}
          {indicator && <span className={`prediction-indicator ${indicator.className}`}>{indicator.text}</span>}
        </div>
      )}
    </div>
  );
}
