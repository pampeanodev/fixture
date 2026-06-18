import { useFixture } from "../context/FixtureContext";
import { useViewMode } from "../context/ViewModeContext";
import { ScoreInput } from "./ScoreInput";
import { BracketTree } from "./bracket/BracketTree";
import { BracketMobile } from "./bracket/BracketMobile";
import { getTeam } from "../data/teams";
import { isMatchLocked } from "../utils/lockTime";
import { isMatchEditable } from "../espn/graceLock";
import { loadAutoSyncMeta } from "../espn/autoSyncMeta";
import { loadBreakerState } from "../espn/circuitBreaker";
import { getEffectiveNow } from "../utils/devClock";
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
  const { mode: viewMode } = useViewMode();
  const roundsToShow: KnockoutRound[] = round === "F" ? ["F", "3P"] : [round];
  const breakerState = loadBreakerState();
  const now = getEffectiveNow();
  const autoSyncMeta = loadAutoSyncMeta();

  if (viewMode === "compact") {
    return (
      <div className="bracket-view compact">
        <BracketTree />
        <BracketMobile round={round} />
      </div>
    );
  }

  return (
    <div className="bracket-view expanded">
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
                const bothKnown = match.homeTeamId !== null && match.awayTeamId !== null;
                const editable = isMatchEditable(match, {
                  circuitBreakerTripped: breakerState.tripped,
                  now,
                });
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
                        <ScoreInput
                          prediction={match.prediction}
                          result={match.result}
                          onPredictionChange={(score) => dispatch({ type: "SET_KNOCKOUT_SCORE", matchId: match.id, score, field: "prediction" })}
                          onResultChange={(score) => dispatch({ type: "SET_KNOCKOUT_SCORE", matchId: match.id, score, field: "result" })}
                          predictionLocked={isMatchLocked(match.dateUtc)}
                          resultEditable={editable}
                          allowPenalties
                          synced={state.syncedResultIds.includes(match.id)}
                          autoSyncedAt={autoSyncMeta.autoSyncedAt[match.id]}
                          homeTeam={homeTeam ?? undefined} awayTeam={awayTeam ?? undefined} />
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
