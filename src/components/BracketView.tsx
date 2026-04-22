import { useFixture } from "../context/FixtureContext";
import { ScoreInput } from "./ScoreInput";
import { getTeam } from "../data/teams";
import { isMatchLocked } from "../utils/lockTime";
import { useLocale } from "../i18n";
import type { TFunction } from "../i18n/translate";
import type { KnockoutRound, KnockoutMatch } from "../types";
import "./BracketView.css";

const ROUND_TABS: KnockoutRound[] = ["R32", "R16", "QF", "SF", "F"];

function slotLabel(t: TFunction, match: KnockoutMatch, side: "home" | "away"): string {
  const slot = side === "home" ? match.homeSlot : match.awaySlot;
  switch (slot.type) {
    case "group":
      return slot.position === 1
        ? t("knockout.slot.groupWinner", { group: slot.group })
        : t("knockout.slot.groupRunnerUp", { group: slot.group });
    case "best_third":
      return t("knockout.slot.bestThird", { groups: slot.possibleGroups.join("/") });
    case "winner":
      return t("knockout.slot.winnerOf", { matchId: slot.matchId });
    case "loser":
      return t("knockout.slot.loserOf", { matchId: slot.matchId });
  }
}

export function BracketView({ round }: { round: KnockoutRound }) {
  const { state, dispatch, resolvedKnockout } = useFixture();
  const { t, formatDate } = useLocale();
  const isPrediction = state.mode === "predictions";
  const roundsToShow: KnockoutRound[] = round === "F" ? ["F", "3P"] : [round];

  return (
    <div className="bracket-view">
      <div className="round-tabs" data-tour="round-tabs">
        {ROUND_TABS.map((r) => (
          <button key={r}
            className={`round-tab ${r === round ? "active" : ""}`}
            onClick={() => dispatch({ type: "SET_VIEW", view: { type: "knockout", round: r } })}>
            {t(`knockout.rounds.${r}`)}
          </button>
        ))}
      </div>
      <h2>{t(`knockout.roundTitle.${round}`)}</h2>
      {roundsToShow.map((r) => {
        const matches = resolvedKnockout.filter((m) => m.round === r).sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));
        return (
          <div key={r}>
            {roundsToShow.length > 1 && <div className="bracket-round-label">{t(`knockout.roundTitle.${r}`)}</div>}
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
                      <span className="bracket-match-date">{formatDate(match.dateUtc)}</span>
                    </div>
                    <div className="bracket-match-teams">
                      <div className={`bracket-team home ${!homeTeam ? "pending" : ""}`}>
                        {homeTeam ? (<><span>{t(`teams.${homeTeam.id}`)}</span><span className="team-flag">{homeTeam.flag}</span></>) : <span>{slotLabel(t, match, "home")}</span>}
                      </div>
                      {bothKnown ? (
                        <ScoreInput score={currentScore}
                          onScoreChange={(score) => dispatch({ type: "SET_KNOCKOUT_SCORE", matchId: match.id, score })}
                          isPrediction={isPrediction} readonlyScore={readonlyScore ?? undefined} allowPenalties
                          locked={isPrediction && isMatchLocked(match.dateUtc)}
                          synced={!isPrediction && state.syncedResultIds.includes(match.id)} />
                      ) : <span className="score-separator">{t("knockout.vs")}</span>}
                      <div className={`bracket-team ${!awayTeam ? "pending" : ""}`}>
                        {awayTeam ? (<><span className="team-flag">{awayTeam.flag}</span><span>{t(`teams.${awayTeam.id}`)}</span></>) : <span>{slotLabel(t, match, "away")}</span>}
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
