import { useFixture } from "../context/FixtureContext";
import { ScoreInput } from "./ScoreInput";
import { getTeam } from "../data/teams";
import { formatMatchDate } from "../utils/formatDate";
import { isMatchLocked } from "../utils/lockTime";
import type { KnockoutRound, KnockoutMatch } from "../types";
import "./BracketView.css";

const ROUND_LABELS: Record<KnockoutRound, string> = {
  R32: "32avos de Final", R16: "Octavos de Final", QF: "Cuartos de Final",
  SF: "Semifinales", "3P": "Tercer Puesto", F: "Final",
};

const ROUND_TABS: { round: KnockoutRound; label: string }[] = [
  { round: "R32", label: "32avos" },
  { round: "R16", label: "Octavos" },
  { round: "QF", label: "Cuartos" },
  { round: "SF", label: "Semis" },
  { round: "F", label: "Final" },
];

function slotLabel(match: KnockoutMatch, side: "home" | "away"): string {
  const slot = side === "home" ? match.homeSlot : match.awaySlot;
  switch (slot.type) {
    case "group": return `${slot.position}° Grupo ${slot.group}`;
    case "best_third": return `3° (${slot.possibleGroups.join("/")})`;
    case "winner": return `Ganador ${slot.matchId}`;
    case "loser": return `Perdedor ${slot.matchId}`;
  }
}

export function BracketView({ round }: { round: KnockoutRound }) {
  const { state, dispatch, resolvedKnockout } = useFixture();
  const isPrediction = state.mode === "predictions";
  const roundsToShow: KnockoutRound[] = round === "F" ? ["F", "3P"] : [round];

  return (
    <div className="bracket-view">
      <div className="round-tabs" data-tour="round-tabs">
        {ROUND_TABS.map((t) => (
          <button key={t.round}
            className={`round-tab ${t.round === round ? "active" : ""}`}
            onClick={() => dispatch({ type: "SET_VIEW", view: { type: "knockout", round: t.round } })}>
            {t.label}
          </button>
        ))}
      </div>
      <h2>{ROUND_LABELS[round]}</h2>
      {roundsToShow.map((r) => {
        const matches = resolvedKnockout.filter((m) => m.round === r).sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));
        return (
          <div key={r}>
            {roundsToShow.length > 1 && <div className="bracket-round-label">{ROUND_LABELS[r]}</div>}
            <div className="bracket-matches">
              {matches.map((match) => {
                const homeTeam = match.homeTeamId ? getTeam(match.homeTeamId) : null;
                const awayTeam = match.awayTeamId ? getTeam(match.awayTeamId) : null;
                const currentScore = isPrediction ? match.prediction : match.result;
                const readonlyScore = isPrediction ? match.result : undefined;
                const bothKnown = match.homeTeamId !== null && match.awayTeamId !== null;
                return (
                  <div key={match.id} className={`bracket-match-card ${r === "3P" ? "third-place" : ""}`}>
                    <div className="bracket-match-header">
                      <span className="bracket-match-id">{match.id}</span>
                      <span className="bracket-match-date">{formatMatchDate(match.dateUtc)}</span>
                    </div>
                    <div className="bracket-match-teams">
                      <div className={`bracket-team home ${!homeTeam ? "pending" : ""}`}>
                        {homeTeam ? (<><span>{homeTeam.name}</span><span className="team-flag">{homeTeam.flag}</span></>) : <span>{slotLabel(match, "home")}</span>}
                      </div>
                      {bothKnown ? (
                        <ScoreInput score={currentScore}
                          onScoreChange={(score) => dispatch({ type: "SET_KNOCKOUT_SCORE", matchId: match.id, score })}
                          isPrediction={isPrediction} readonlyScore={readonlyScore ?? undefined} allowPenalties
                          locked={isPrediction && isMatchLocked(match.dateUtc)}
                          synced={!isPrediction && state.syncedResultIds.includes(match.id)} />
                      ) : <span className="score-separator">vs</span>}
                      <div className={`bracket-team ${!awayTeam ? "pending" : ""}`}>
                        {awayTeam ? (<><span className="team-flag">{awayTeam.flag}</span><span>{awayTeam.name}</span></>) : <span>{slotLabel(match, "away")}</span>}
                      </div>
                    </div>
                    <div className="bracket-venue">{match.venue}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
