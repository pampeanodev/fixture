import { useLocale } from "../../i18n";
import type { KnockoutMatch } from "../../types";
import { BracketMatchCard } from "./BracketMatchCard";

export function BracketCenter({ finalMatch, thirdPlaceMatch }: {
  finalMatch: KnockoutMatch | undefined;
  thirdPlaceMatch: KnockoutMatch | undefined;
}) {
  const { t } = useLocale();
  return (
    <div className="bk-center">
      <div className="bk-final-block">
        <div className="bk-col-label final-label">{t("knockout.rounds.F")}</div>
        {finalMatch && <BracketMatchCard match={finalMatch} variant="final" />}
      </div>
      {thirdPlaceMatch && (
        <div className="bk-third-block">
          <div className="bk-col-label third-label">{t("knockout.rounds.3P")}</div>
          <BracketMatchCard match={thirdPlaceMatch} variant="third" />
        </div>
      )}
    </div>
  );
}
