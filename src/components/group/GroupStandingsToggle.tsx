import { useLocale } from "../../i18n";
import "./GroupStandingsToggle.css";

export type StandingsSource = "real" | "projected";

const OPTIONS: { value: StandingsSource; key: "real" | "projected" }[] = [
  { value: "real", key: "real" },
  { value: "projected", key: "projected" },
];

export function GroupStandingsToggle({
  value,
  onChange,
}: {
  value: StandingsSource;
  onChange: (next: StandingsSource) => void;
}) {
  const { t } = useLocale();
  return (
    <div className="standings-source-toggle" role="group" aria-label={t("groups.standings.source.label")}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`standings-source-option ${value === opt.value ? "active" : ""}`}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {t(`groups.standings.source.${opt.key}`)}
        </button>
      ))}
    </div>
  );
}
