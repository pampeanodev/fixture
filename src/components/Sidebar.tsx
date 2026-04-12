import { useFixture } from "../context/FixtureContext";
import { GROUPS } from "../data/teams";
import type { KnockoutRound } from "../types";
import "./Sidebar.css";

const KNOCKOUT_ROUNDS: { round: KnockoutRound; label: string }[] = [
  { round: "R32", label: "32avos" },
  { round: "R16", label: "Octavos" },
  { round: "QF", label: "Cuartos" },
  { round: "SF", label: "Semifinales" },
  { round: "F", label: "Final" },
];

export function Sidebar() {
  const { state, dispatch } = useFixture();
  const { activeView, groupMatches, mode } = state;

  function countPlayed(group: string): string {
    const field = mode === "predictions" ? "prediction" : "result";
    const matches = groupMatches.filter((m) => m.group === group);
    const played = matches.filter((m) => m[field] !== null).length;
    return `${played}/6`;
  }

  return (
    <nav className="sidebar">
      <div className="sidebar-section-title">Fase de Grupos</div>
      {GROUPS.map((group) => {
        const isActive = activeView.type === "group" && activeView.group === group;
        return (
          <div key={group} className={`sidebar-item ${isActive ? "active" : ""}`}
            onClick={() => dispatch({ type: "SET_VIEW", view: { type: "group", group } })}>
            <span>Grupo {group}</span>
            <span className="sidebar-badge">{countPlayed(group)}</span>
          </div>
        );
      })}
      <div className="sidebar-section-title">Eliminatorias</div>
      {KNOCKOUT_ROUNDS.map(({ round, label }) => {
        const isActive = activeView.type === "knockout" && activeView.round === round;
        return (
          <div key={round} className={`sidebar-item ${isActive ? "active" : ""}`}
            onClick={() => dispatch({ type: "SET_VIEW", view: { type: "knockout", round } })}>
            {label}
          </div>
        );
      })}
    </nav>
  );
}
