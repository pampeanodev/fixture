import { useFixture } from "../context/FixtureContext";
import { ScoreInput } from "./ScoreInput";
import { getTeam } from "../data/teams";
import { formatMatchDate } from "../utils/formatDate";
import "./GroupView.css";

interface GroupViewProps { group: string; }

export function GroupView({ group }: GroupViewProps) {
  const { state, dispatch, standingsByGroup } = useFixture();
  const standings = standingsByGroup[group] ?? [];
  const matches = state.groupMatches.filter((m) => m.group === group).sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));
  const isPrediction = state.mode === "predictions";

  return (
    <div className="group-view">
      <h2>Grupo {group}</h2>
      <table className="standings-table">
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
      {matches.map((match) => {
        const homeTeam = getTeam(match.homeTeamId);
        const awayTeam = getTeam(match.awayTeamId);
        const currentScore = isPrediction ? match.prediction : match.result;
        const readonlyScore = isPrediction ? match.result : undefined;
        return (
          <div key={match.id} className="group-match-row">
            <div className="match-date">{formatMatchDate(match.dateUtc)}</div>
            <div className="match-home">
              <span>{homeTeam?.name}</span>
              <span className="team-flag">{homeTeam?.flag}</span>
            </div>
            <ScoreInput score={currentScore}
              onScoreChange={(score) => dispatch({ type: "SET_GROUP_SCORE", matchId: match.id, score })}
              isPrediction={isPrediction} readonlyScore={readonlyScore ?? undefined} />
            <div className="match-away">
              <span className="team-flag">{awayTeam?.flag}</span>
              <span>{awayTeam?.name}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
