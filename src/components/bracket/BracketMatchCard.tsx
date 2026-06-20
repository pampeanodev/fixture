import { useState, useEffect } from "react";
import { useFixture } from "../../context/FixtureContext";
import { getTeam } from "../../data/teams";
import { isMatchLocked } from "../../utils/lockTime";
import { indicatorFor } from "../../utils/scoring";
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
  const { dispatch, knockoutConfirmation } = useFixture();
  const { t } = useLocale();
  const prediction = match.prediction;
  const confirmed = knockoutConfirmation[match.id];

  const [homeStr, setHomeStr] = useState(prediction?.home?.toString() ?? "");
  const [awayStr, setAwayStr] = useState(prediction?.away?.toString() ?? "");

  useEffect(() => {
    setHomeStr(prediction?.home?.toString() ?? "");
    setAwayStr(prediction?.away?.toString() ?? "");
  }, [prediction]);

  function commit(h: string, a: string) {
    const hi = parseInt(h, 10);
    const ai = parseInt(a, 10);
    if (!isNaN(hi) && !isNaN(ai) && hi >= 0 && ai >= 0) {
      dispatch({ type: "SET_KNOCKOUT_SCORE", matchId: match.id, score: { home: hi, away: ai, penalties: prediction?.penalties }, field: "prediction" });
    } else if (h === "" && a === "") {
      dispatch({ type: "SET_KNOCKOUT_SCORE", matchId: match.id, score: null, field: "prediction" });
    }
  }

  function pickPen(winner: "home" | "away") {
    if (!prediction || prediction.home !== prediction.away) return;
    const penalties = winner === "home" ? { home: 1, away: 0 } : { home: 0, away: 1 };
    dispatch({ type: "SET_KNOCKOUT_SCORE", matchId: match.id, score: { ...prediction, penalties }, field: "prediction" });
  }

  const homeTeam = match.homeTeamId ? getTeam(match.homeTeamId) : null;
  const awayTeam = match.awayTeamId ? getTeam(match.awayTeamId) : null;
  const bothKnown = match.homeTeamId !== null && match.awayTeamId !== null;
  const predictionLocked = isMatchLocked(match.dateUtc);
  const tied = prediction !== null && prediction.home === prediction.away;
  const penWinner: "home" | "away" | null = prediction?.penalties
    ? prediction.penalties.home > prediction.penalties.away ? "home"
    : prediction.penalties.away > prediction.penalties.home ? "away" : null
    : null;

  const scored = indicatorFor(match.result, prediction);
  const indicatorClass = scored ? scored.kind : null;

  return (
    <div className={`bk-card ${variant} ${indicatorClass ? "ind-" + indicatorClass : ""}`}>
      <div className={`bk-card-team ${homeTeam ? "" : "pending"}`}>
        <span className="bk-card-flag">{homeTeam?.flag ?? "·"}</span>
        <span className="bk-card-name">{homeTeam ? t(`teams.${homeTeam.id}`) : slotShort(t, match, "home")}</span>
        {homeTeam && confirmed?.home && <span className="bk-confirmed" title={t("knockout.confirmed")}>✓</span>}
        {bothKnown && (
          <input type="number" min="0" max="99"
            className="bk-card-input prediction"
            disabled={predictionLocked}
            value={homeStr}
            onChange={(e) => { setHomeStr(e.target.value); commit(e.target.value, awayStr); }} />
        )}
      </div>
      <div className={`bk-card-team ${awayTeam ? "" : "pending"}`}>
        <span className="bk-card-flag">{awayTeam?.flag ?? "·"}</span>
        <span className="bk-card-name">{awayTeam ? t(`teams.${awayTeam.id}`) : slotShort(t, match, "away")}</span>
        {awayTeam && confirmed?.away && <span className="bk-confirmed" title={t("knockout.confirmed")}>✓</span>}
        {bothKnown && (
          <input type="number" min="0" max="99"
            className="bk-card-input prediction"
            disabled={predictionLocked}
            value={awayStr}
            onChange={(e) => { setAwayStr(e.target.value); commit(homeStr, e.target.value); }} />
        )}
      </div>
      {bothKnown && tied && variant !== "third" && (
        <div className="bk-card-pen">
          <span className="bk-card-pen-label">PEN</span>
          <button type="button" className={`bk-card-pen-pick ${penWinner === "home" ? "active" : ""}`} disabled={predictionLocked} onClick={() => pickPen("home")} aria-label={t("scoreInput.penPickAria", { team: homeTeam ? t(`teams.${homeTeam.id}`) : "home" })}>{homeTeam?.flag ?? "1"}</button>
          <button type="button" className={`bk-card-pen-pick ${penWinner === "away" ? "active" : ""}`} disabled={predictionLocked} onClick={() => pickPen("away")} aria-label={t("scoreInput.penPickAria", { team: awayTeam ? t(`teams.${awayTeam.id}`) : "away" })}>{awayTeam?.flag ?? "2"}</button>
        </div>
      )}
    </div>
  );
}
