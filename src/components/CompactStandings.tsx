import { useState } from "react";
import { getTeam } from "../data/teams";
import { useLocale } from "../i18n";
import type { StandingRow } from "../types";
import "./CompactStandings.css";

export function CompactStandings({ standings }: { standings: StandingRow[] }) {
  const { t } = useLocale();
  const initialMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;
  const [collapsed, setCollapsed] = useState(initialMobile);
  return (
    <div className={`compact-standings ${collapsed ? "collapsed" : ""}`}>
      <button
        type="button"
        className="compact-standings-header"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? t("groups.standings.expandAria") : t("groups.standings.collapseAria")}
      >
        <span>{t("groups.standings.compactTeam")} · PJ · {t("groups.standings.goalDifference")} · {t("groups.standings.points")}</span>
        <span className="chev">{collapsed ? "▸" : "▾"}</span>
      </button>
      {!collapsed && (
        <table className="compact-standings-table">
          <thead>
            <tr>
              <th>{t("groups.standings.compactTeam")}</th>
              <th>{t("groups.standings.played")}</th>
              <th>{t("groups.standings.goalDifference")}</th>
              <th>{t("groups.standings.points")}</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => {
              const team = getTeam(row.teamId);
              return (
                <tr key={row.teamId} className={i < 2 ? "qualify" : i === 2 ? "maybe-qualify" : ""}>
                  <td>
                    <span className="team-flag">{team?.flag}</span>
                    <span>{team ? t(`teams.${team.id}`) : row.teamId}</span>
                  </td>
                  <td>{row.played}</td>
                  <td>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                  <td><strong>{row.points}</strong></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
