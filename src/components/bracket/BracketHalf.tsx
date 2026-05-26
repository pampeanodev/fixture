import { useLocale } from "../../i18n";
import type { KnockoutMatch } from "../../types";
import { BracketMatchCard } from "./BracketMatchCard";
import { matchIdsForHalf, BRACKET_ROUNDS_BY_DEPTH, type Half } from "./bracketLayout";

interface BracketHalfProps {
  side: Half;
  matchesById: Map<string, KnockoutMatch>;
}

export function BracketHalf({ side, matchesById }: BracketHalfProps) {
  const { t } = useLocale();
  const columns = side === "left"
    ? BRACKET_ROUNDS_BY_DEPTH
    : [...BRACKET_ROUNDS_BY_DEPTH].reverse();

  return (
    <div className={`bk-half bk-half-${side}`}>
      {columns.map((round) => {
        const ids = matchIdsForHalf(side, round);
        return (
          <div key={round} className={`bk-col bk-col-${round}`}>
            <div className="bk-col-label">{t(`knockout.rounds.${round}`)}</div>
            <div className="bk-col-body">
              {ids.map((id) => {
                const m = matchesById.get(id);
                if (!m) return null;
                return <BracketMatchCard key={id} match={m} />;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
