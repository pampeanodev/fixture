import { useMemo } from "react";
import { useFixture } from "../context/FixtureContext";
import { ScoreInput } from "./ScoreInput";
import { getTeam } from "../data/teams";
import type { KnockoutRound, Score } from "../types";
import "./ScheduleView.css";

const ROUND_LABELS: Record<KnockoutRound, string> = {
  R32: "32avos", R16: "Octavos", QF: "Cuartos",
  SF: "Semis", "3P": "3er puesto", F: "Final",
};

interface UnifiedMatch {
  id: string;
  dateUtc: string;
  venue: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  label: string;          // "Grupo A" or "32avos"
  isKnockout: boolean;
  hasResult: boolean;
}

export function ScheduleView() {
  const { state, dispatch, resolvedKnockout } = useFixture();
  const isPrediction = state.mode === "predictions";
  const scoreField = isPrediction ? "prediction" : "result";

  const allMatches = useMemo(() => {
    const matches: UnifiedMatch[] = [];

    for (const m of state.groupMatches) {
      matches.push({
        id: m.id, dateUtc: m.dateUtc, venue: m.venue,
        homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId,
        label: `Grupo ${m.group}`, isKnockout: false,
        hasResult: m[scoreField] !== null,
      });
    }

    for (const m of resolvedKnockout) {
      matches.push({
        id: m.id, dateUtc: m.dateUtc, venue: m.venue,
        homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId,
        label: ROUND_LABELS[m.round], isKnockout: true,
        hasResult: m[scoreField] !== null,
      });
    }

    matches.sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));
    return matches;
  }, [state.groupMatches, resolvedKnockout, scoreField]);

  // Group matches by day (local timezone)
  const matchesByDay = useMemo(() => {
    const groups: { day: string; matches: UnifiedMatch[] }[] = [];
    let currentDay = "";

    for (const match of allMatches) {
      const date = new Date(match.dateUtc);
      const day = date.toLocaleDateString("es-AR", {
        weekday: "long", day: "numeric", month: "long",
      });

      if (day !== currentDay) {
        currentDay = day;
        groups.push({ day, matches: [] });
      }
      groups[groups.length - 1].matches.push(match);
    }
    return groups;
  }, [allMatches]);

  function getScore(matchId: string) {
    const gm = state.groupMatches.find((m) => m.id === matchId);
    if (gm) return isPrediction ? gm.prediction : gm.result;
    const km = resolvedKnockout.find((m) => m.id === matchId);
    if (km) return isPrediction ? km.prediction : km.result;
    return null;
  }

  function getReadonlyScore(matchId: string) {
    if (!isPrediction) return undefined;
    const gm = state.groupMatches.find((m) => m.id === matchId);
    if (gm) return gm.result;
    const km = resolvedKnockout.find((m) => m.id === matchId);
    if (km) return km.result;
    return undefined;
  }

  function handleScoreChange(matchId: string, isKnockout: boolean, score: Score | null) {
    if (isKnockout) {
      dispatch({ type: "SET_KNOCKOUT_SCORE", matchId, score });
    } else {
      dispatch({ type: "SET_GROUP_SCORE", matchId, score });
    }
  }

  return (
    <div className="schedule-view">
      <h2>Calendario</h2>
      {matchesByDay.map(({ day, matches }) => (
        <div key={day}>
          <div className="schedule-day-header">{day}</div>
          {matches.map((match) => {
            const homeTeam = match.homeTeamId ? getTeam(match.homeTeamId) : null;
            const awayTeam = match.awayTeamId ? getTeam(match.awayTeamId) : null;
            const currentScore = getScore(match.id);
            const readonlyScore = getReadonlyScore(match.id);
            const bothKnown = match.homeTeamId !== null && match.awayTeamId !== null;

            const time = new Date(match.dateUtc).toLocaleTimeString("en-US", {
              hour: "2-digit", minute: "2-digit", hour12: false,
            });

            return (
              <div key={match.id}
                className={`schedule-match-row ${match.isKnockout ? "knockout" : ""} ${match.hasResult ? "has-result" : ""}`}>
                <span className="schedule-time">{time}</span>
                <span className={`schedule-badge ${match.isKnockout ? "ko" : "group"}`}>
                  {match.label}
                </span>
                <div className="schedule-teams">
                  {homeTeam ? (
                    <>
                      <span className="team-flag">{homeTeam.flag}</span>
                      <span className="schedule-team-name home">{homeTeam.name}</span>
                    </>
                  ) : (
                    <span className="schedule-team-name home pending">{match.id}</span>
                  )}
                  {bothKnown ? (
                    <ScoreInput
                      score={currentScore}
                      onScoreChange={(score) => handleScoreChange(match.id, match.isKnockout, score)}
                      isPrediction={isPrediction}
                      readonlyScore={readonlyScore ?? undefined}
                      allowPenalties={match.isKnockout}
                    />
                  ) : (
                    <span className="score-separator">vs</span>
                  )}
                  {awayTeam ? (
                    <>
                      <span className="schedule-team-name">{awayTeam.name}</span>
                      <span className="team-flag">{awayTeam.flag}</span>
                    </>
                  ) : (
                    <span className="schedule-team-name pending">{match.id}</span>
                  )}
                </div>
                <span className="schedule-venue">{match.venue}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
