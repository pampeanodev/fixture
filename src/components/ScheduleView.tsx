import { useMemo, useState, useEffect } from "react";
import { useFixture } from "../context/FixtureContext";
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
  label: string;
  isKnockout: boolean;
  hasResult: boolean;
  currentScore: Score | null;
  realScore: Score | null;
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
        currentScore: m[scoreField],
        realScore: m.result,
      });
    }
    for (const m of resolvedKnockout) {
      matches.push({
        id: m.id, dateUtc: m.dateUtc, venue: m.venue,
        homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId,
        label: ROUND_LABELS[m.round], isKnockout: true,
        hasResult: m[scoreField] !== null,
        currentScore: m[scoreField],
        realScore: m.result,
      });
    }
    matches.sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));
    return matches;
  }, [state.groupMatches, resolvedKnockout, scoreField]);

  const matchesByDay = useMemo(() => {
    const groups: { day: string; matches: UnifiedMatch[] }[] = [];
    let currentDay = "";
    for (const match of allMatches) {
      const date = new Date(match.dateUtc);
      const day = date.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
      if (day !== currentDay) {
        currentDay = day;
        groups.push({ day, matches: [] });
      }
      groups[groups.length - 1].matches.push(match);
    }
    return groups;
  }, [allMatches]);

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
          <div className="schedule-day-matches">
          {matches.map((match) => (
            <ScheduleMatchCard
              key={match.id}
              match={match}
              isPrediction={isPrediction}
              onScoreChange={(score) => handleScoreChange(match.id, match.isKnockout, score)}
            />
          ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScheduleMatchCard({ match, isPrediction, onScoreChange }: {
  match: UnifiedMatch;
  isPrediction: boolean;
  onScoreChange: (score: Score | null) => void;
}) {
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

  const time = new Date(match.dateUtc).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  });

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
        <span className={`schedule-badge ${match.isKnockout ? "ko" : "group"}`}>{match.label}</span>
        <span className="schedule-match-venue">{match.venue}</span>
      </div>
      <div className="schedule-team-row">
        {homeTeam ? (
          <>
            <span className="team-flag">{homeTeam.flag}</span>
            <span className="schedule-team-row-name">{homeTeam.name}</span>
          </>
        ) : (
          <span className="schedule-team-row-name pending">{match.id}</span>
        )}
        {bothKnown && (
          <input type="number" min="0" max="99"
            className={`schedule-score-input ${isPrediction ? "prediction" : ""}`}
            value={homeStr}
            onChange={(e) => { setHomeStr(e.target.value); commitScore(e.target.value, awayStr); }} />
        )}
      </div>
      <div className="schedule-team-row">
        {awayTeam ? (
          <>
            <span className="team-flag">{awayTeam.flag}</span>
            <span className="schedule-team-row-name">{awayTeam.name}</span>
          </>
        ) : (
          <span className="schedule-team-row-name pending">{match.id}</span>
        )}
        {bothKnown && (
          <input type="number" min="0" max="99"
            className={`schedule-score-input ${isPrediction ? "prediction" : ""}`}
            value={awayStr}
            onChange={(e) => { setAwayStr(e.target.value); commitScore(homeStr, e.target.value); }} />
        )}
      </div>
      {isPrediction && match.realScore && (
        <div className="schedule-prediction-row">
          Real: {match.realScore.home} - {match.realScore.away}
          {indicator && <span className={`prediction-indicator ${indicator.className}`}>{indicator.text}</span>}
        </div>
      )}
    </div>
  );
}
