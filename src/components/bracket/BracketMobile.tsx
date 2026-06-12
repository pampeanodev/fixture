import { useFixture } from "../../context/FixtureContext";
import { isMatchLocked } from "../../utils/lockTime";
import { isMatchEditable } from "../../espn/graceLock";
import { loadAutoSyncMeta } from "../../espn/autoSyncMeta";
import { loadBreakerState } from "../../espn/circuitBreaker";
import { getEffectiveNow } from "../../utils/devClock";
import { useLocale } from "../../i18n";
import type { KnockoutRound } from "../../types";
import { CompactMatchRow } from "../CompactMatchRow";

const ROUND_TABS: KnockoutRound[] = ["R32", "R16", "QF", "SF", "F"];

export function BracketMobile({ round }: { round: KnockoutRound }) {
  const { state, dispatch, resolvedKnockout } = useFixture();
  const { t } = useLocale();
  const isPrediction = state.mode === "predictions";
  const roundsToShow: KnockoutRound[] = round === "F" ? ["F", "3P"] : [round];
  const breakerState = loadBreakerState();
  const now = getEffectiveNow();
  const autoSyncMeta = loadAutoSyncMeta();

  return (
    <div className="bracket-mobile-fallback">
      <div className="round-tabs">
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
        const matches = resolvedKnockout
          .filter((m) => m.round === r)
          .sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));
        return (
          <div key={r} className="bracket-mobile-round">
            {roundsToShow.length > 1 && <div className="bracket-round-label">{t(`knockout.roundTitle.${r}`)}</div>}
            <div className="bracket-mobile-list">
              {matches.map((m) => {
                const editable = isMatchEditable(m, {
                  circuitBreakerTripped: breakerState.tripped,
                  now,
                });
                const ts = autoSyncMeta.autoSyncedAt[m.id];
                const autoSyncTooltip = ts
                  ? t("autoSync.autoSyncedTooltip", { datetime: new Date(ts).toLocaleString() })
                  : undefined;
                return (
                  <CompactMatchRow
                    key={m.id}
                    homeTeamId={m.homeTeamId}
                    awayTeamId={m.awayTeamId}
                    dateUtc={m.dateUtc}
                    badgeLabel={t(`knockout.rounds.${m.round}`)}
                    badgeKind="knockout"
                    currentScore={isPrediction ? m.prediction : m.result}
                    realScore={m.result}
                    isPrediction={isPrediction}
                    locked={isPrediction && isMatchLocked(m.dateUtc)}
                    synced={!isPrediction && state.syncedResultIds.includes(m.id)}
                    disabled={!editable && !isPrediction}
                    lockedReason={t("autoSync.waitingResult")}
                    autoSyncTooltip={autoSyncTooltip}
                    pendingLabel={m.id}
                    onScoreChange={(score) => dispatch({ type: "SET_KNOCKOUT_SCORE", matchId: m.id, score })}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
