import { useState, useEffect } from "react";
import { useFixture } from "../context/FixtureContext";
import { getTeam, GROUPS } from "../data/teams";
import { formatMatchDate } from "../utils/formatDate";
import { isMatchLocked } from "../utils/lockTime";
import type { Score } from "../types";
import "./GroupView.css";

interface GroupViewProps { group: string; }

function ScoreField({ value, onChange, isPrediction, locked }: {
  value: string;
  onChange: (v: string) => void;
  isPrediction?: boolean;
  locked?: boolean;
}) {
  return (
    <input
      type="number" min="0" max="99"
      className={`group-match-score-input ${isPrediction ? "prediction" : ""} ${locked ? "locked" : ""}`}
      disabled={locked}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function GroupView({ group }: GroupViewProps) {
  const { state, dispatch, standingsByGroup } = useFixture();
  const standings = standingsByGroup[group] ?? [];
  const matches = state.groupMatches
    .filter((m) => m.group === group)
    .sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));
  const isPrediction = state.mode === "predictions";

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
      <h2>Grupo {group}</h2>
      <table className="standings-table" data-tour="standings-table">
        <thead>
          <tr><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th></tr>
        </thead>
        <tbody>
          {standings.map((row, i) => {
            const team = getTeam(row.teamId);
            return (
              <tr key={row.teamId} className={i < 2 ? "qualify" : i === 2 ? "maybe-qualify" : ""}>
                <td><div className="team-cell"><span className="team-flag">{team?.flag}</span><span>{team?.name ?? row.teamId}</span></div></td>
                <td>{row.played}</td><td>{row.won}</td><td>{row.drawn}</td><td>{row.lost}</td>
                <td>{row.goalsFor}</td><td>{row.goalsAgainst}</td>
                <td>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                <td><strong>{row.points}</strong></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="group-matches-title">Partidos</div>
      <div className="group-matches-grid" data-tour="match-cards">
      {matches.map((match) => (
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
          onScoreChange={(score) => dispatch({ type: "SET_GROUP_SCORE", matchId: match.id, score })}
        />
      ))}
      </div>
    </div>
  );
}

function MatchCard({ homeTeamId, awayTeamId, dateUtc, result, prediction, isPrediction, locked, synced, onScoreChange }: {
  homeTeamId: string;
  awayTeamId: string;
  dateUtc: string;
  result: Score | null;
  prediction: Score | null;
  isPrediction: boolean;
  locked?: boolean;
  synced?: boolean;
  onScoreChange: (score: Score | null) => void;
}) {
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
      indicator = { className: "exact", symbol: "✓ Exacto" };
    } else {
      const realOut = Math.sign(result.home - result.away);
      const predOut = Math.sign(prediction.home - prediction.away);
      indicator = realOut === predOut
        ? { className: "winner", symbol: "½ Ganador" }
        : { className: "wrong", symbol: "✗ Errado" };
    }
  }

  return (
    <div className="group-match-card">
      <div className="group-match-date">{formatMatchDate(dateUtc)}</div>
      <div className="group-match-team-row">
        <span className="team-flag">{homeTeam?.flag}</span>
        <span className="group-match-team-name">{homeTeam?.name}</span>
        <ScoreField value={homeStr} isPrediction={isPrediction} locked={locked}
          onChange={(v) => { setHomeStr(v); commitScore(v, awayStr); }} />
      </div>
      <div className="group-match-team-row">
        <span className="team-flag">{awayTeam?.flag}</span>
        <span className="group-match-team-name">{awayTeam?.name}</span>
        <ScoreField value={awayStr} isPrediction={isPrediction} locked={locked}
          onChange={(v) => { setAwayStr(v); commitScore(homeStr, v); }} />
      </div>
      {locked && <div className="group-match-locked">🔒 Cerrado</div>}
      {synced && <div className="group-match-synced" title="Resultado publicado por el admin de la sala">↻ Sincronizado</div>}
      {isPrediction && result && (
        <div className="group-match-prediction-row">
          Real: {result.home} - {result.away}
          {indicator && <span className={`prediction-indicator ${indicator.className}`}>{indicator.symbol}</span>}
        </div>
      )}
    </div>
  );
}
