import { useState, useEffect } from "react";
import { useFixture } from "../../context/FixtureContext";
import { getTeam } from "../../data/teams";
import { isMatchLocked } from "../../utils/lockTime";
import { isMatchEditable } from "../../espn/graceLock";
import { loadAutoSyncEnabled } from "../../espn/autoSyncMeta";
import { loadBreakerState } from "../../espn/circuitBreaker";
import { getEffectiveNow } from "../../utils/devClock";
import { useLocale } from "../../i18n";
import type { TFunction } from "../../i18n/translate";
import type { KnockoutMatch } from "../../types";

function slotShort(t: TFunction, match: KnockoutMatch, side: "home" | "away"): string {
  const slot = side === "home" ? match.homeSlot : match.awaySlot;
  switch (slot.type) {
    case "group": return slot.position === 1 ? `1°${slot.group}` : `2°${slot.group}`;
    case "best_third": return `3°(${slot.possibleGroups.join("/")})`;
    case "winner": return `W ${slot.matchId}`;
    case "loser": return `L ${slot.matchId}`;
    default: return t("knockout.vs");
  }
}

export function BracketMatchCard({ match, variant = "regular" }: { match: KnockoutMatch; variant?: "regular" | "final" | "third" }) {
  const { state, dispatch } = useFixture();
  const { t } = useLocale();
  const isPrediction = state.mode === "predictions";
  const currentScore = isPrediction ? match.prediction : match.result;
  const realScore = match.result;

  const [homeStr, setHomeStr] = useState(currentScore?.home?.toString() ?? "");
  const [awayStr, setAwayStr] = useState(currentScore?.away?.toString() ?? "");

  useEffect(() => {
    setHomeStr(currentScore?.home?.toString() ?? "");
    setAwayStr(currentScore?.away?.toString() ?? "");
  }, [currentScore]);

  function commit(h: string, a: string) {
    const hi = parseInt(h, 10);
    const ai = parseInt(a, 10);
    if (!isNaN(hi) && !isNaN(ai) && hi >= 0 && ai >= 0) {
      dispatch({ type: "SET_KNOCKOUT_SCORE", matchId: match.id, score: { home: hi, away: ai, penalties: currentScore?.penalties } });
    } else if (h === "" && a === "") {
      dispatch({ type: "SET_KNOCKOUT_SCORE", matchId: match.id, score: null });
    }
  }

  function pickPen(winner: "home" | "away") {
    if (!currentScore || currentScore.home !== currentScore.away) return;
    const penalties = winner === "home" ? { home: 1, away: 0 } : { home: 0, away: 1 };
    dispatch({ type: "SET_KNOCKOUT_SCORE", matchId: match.id, score: { ...currentScore, penalties } });
  }

  const homeTeam = match.homeTeamId ? getTeam(match.homeTeamId) : null;
  const awayTeam = match.awayTeamId ? getTeam(match.awayTeamId) : null;
  const bothKnown = match.homeTeamId !== null && match.awayTeamId !== null;
  const editable = isMatchEditable(match, {
    autoSyncEnabled: loadAutoSyncEnabled(),
    circuitBreakerTripped: loadBreakerState().tripped,
    now: getEffectiveNow(),
  });
  const locked = isPrediction && isMatchLocked(match.dateUtc);
  const disabled = locked || (!editable && !isPrediction);
  const tied = currentScore !== null && currentScore.home === currentScore.away;
  const penWinner: "home" | "away" | null = currentScore?.penalties
    ? currentScore.penalties.home > currentScore.penalties.away ? "home"
    : currentScore.penalties.away > currentScore.penalties.home ? "away" : null
    : null;

  let indicatorClass: string | null = null;
  if (isPrediction && realScore && currentScore) {
    if (realScore.home === currentScore.home && realScore.away === currentScore.away) indicatorClass = "exact";
    else if (Math.sign(realScore.home - realScore.away) === Math.sign(currentScore.home - currentScore.away)) indicatorClass = "winner";
    else indicatorClass = "wrong";
  }

  return (
    <div className={`bk-card ${variant} ${indicatorClass ? "ind-" + indicatorClass : ""}`}>
      <div className={`bk-card-team ${homeTeam ? "" : "pending"}`}>
        <span className="bk-card-flag">{homeTeam?.flag ?? "·"}</span>
        <span className="bk-card-name">{homeTeam ? t(`teams.${homeTeam.id}`) : slotShort(t, match, "home")}</span>
        {bothKnown && (
          <input type="number" min="0" max="99"
            className={`bk-card-input ${isPrediction ? "prediction" : ""}`}
            disabled={disabled}
            value={homeStr}
            onChange={(e) => { setHomeStr(e.target.value); commit(e.target.value, awayStr); }} />
        )}
      </div>
      <div className={`bk-card-team ${awayTeam ? "" : "pending"}`}>
        <span className="bk-card-flag">{awayTeam?.flag ?? "·"}</span>
        <span className="bk-card-name">{awayTeam ? t(`teams.${awayTeam.id}`) : slotShort(t, match, "away")}</span>
        {bothKnown && (
          <input type="number" min="0" max="99"
            className={`bk-card-input ${isPrediction ? "prediction" : ""}`}
            disabled={disabled}
            value={awayStr}
            onChange={(e) => { setAwayStr(e.target.value); commit(homeStr, e.target.value); }} />
        )}
      </div>
      {bothKnown && tied && variant !== "third" && (
        <div className="bk-card-pen">
          <span className="bk-card-pen-label">PEN</span>
          <button type="button" className={`bk-card-pen-pick ${penWinner === "home" ? "active" : ""}`} disabled={disabled} onClick={() => pickPen("home")} aria-label={t("scoreInput.penPickAria", { team: homeTeam ? t(`teams.${homeTeam.id}`) : "home" })}>{homeTeam?.flag ?? "1"}</button>
          <button type="button" className={`bk-card-pen-pick ${penWinner === "away" ? "active" : ""}`} disabled={disabled} onClick={() => pickPen("away")} aria-label={t("scoreInput.penPickAria", { team: awayTeam ? t(`teams.${awayTeam.id}`) : "away" })}>{awayTeam?.flag ?? "2"}</button>
        </div>
      )}
    </div>
  );
}
