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

interface SidebarProps {
  collapsed: boolean;
  isMobile: boolean;
  onNavigate: () => void;
}

export function Sidebar({ collapsed, isMobile, onNavigate }: SidebarProps) {
  const { state, dispatch } = useFixture();
  const { activeView, groupMatches, mode } = state;

  function countPlayed(group: string): string {
    const field = mode === "predictions" ? "prediction" : "result";
    const matches = groupMatches.filter((m) => m.group === group);
    const played = matches.filter((m) => m[field] !== null).length;
    return `${played}/6`;
  }

  function navigate(action: Parameters<typeof dispatch>[0]) {
    dispatch(action);
    onNavigate();
  }

  const className = [
    "sidebar",
    collapsed ? "collapsed" : "",
    isMobile && !collapsed ? "open" : "",
  ].filter(Boolean).join(" ");

  return (
    <nav className={className}>
      <div
        className={`sidebar-item ${activeView.type === "schedule" ? "active" : ""}`}
        style={{ padding: "14px 16px", fontWeight: 700, fontSize: "12px", letterSpacing: "0.5px" }}
        onClick={() => navigate({ type: "SET_VIEW", view: { type: "schedule" } })}>
        Calendario
      </div>
      <div className="sidebar-section-title">Fase de Grupos</div>
      {GROUPS.map((group) => {
        const isActive = activeView.type === "group" && activeView.group === group;
        return (
          <div key={group} className={`sidebar-item ${isActive ? "active" : ""}`}
            onClick={() => navigate({ type: "SET_VIEW", view: { type: "group", group } })}>
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
            onClick={() => navigate({ type: "SET_VIEW", view: { type: "knockout", round } })}>
            {label}
          </div>
        );
      })}
    </nav>
  );
}
