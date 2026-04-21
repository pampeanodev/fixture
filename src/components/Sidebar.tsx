import { useFixture } from "../context/FixtureContext";
import { SidebarFooter } from "./SidebarFooter";
import "./Sidebar.css";

interface SidebarProps {
  collapsed: boolean;
  isMobile: boolean;
  onNavigate: () => void;
}

export function Sidebar({ collapsed, isMobile, onNavigate }: SidebarProps) {
  const { state, dispatch } = useFixture();
  const { activeView } = state;

  function navigate(view: typeof activeView) {
    dispatch({ type: "SET_VIEW", view });
    onNavigate();
  }

  const className = [
    "sidebar",
    collapsed ? "collapsed" : "",
    isMobile && !collapsed ? "open" : "",
  ].filter(Boolean).join(" ");

  return (
    <nav className={className}>
      <div className="sidebar-brand">
        <img src="/favicon.svg" alt="" className="sidebar-brand-logo" aria-hidden="true" />
        <span>Mundial 2026</span>
      </div>
      <div className="sidebar-nav">
        <div
          className={`sidebar-item ${activeView.type === "schedule" ? "active" : ""}`}
          onClick={() => navigate({ type: "schedule" })}>
          Calendario
        </div>
        <div
          data-tour="nav-groups"
          className={`sidebar-item ${activeView.type === "groups" ? "active" : ""}`}
          onClick={() => navigate({ type: "groups", group: activeView.type === "groups" ? activeView.group : "A" })}>
          Grupos
        </div>
        <div
          data-tour="nav-knockout"
          className={`sidebar-item ${activeView.type === "knockout" ? "active" : ""}`}
          onClick={() => navigate({ type: "knockout", round: activeView.type === "knockout" ? activeView.round : "R32" })}>
          Eliminatorias
        </div>
        <div className="sidebar-divider" />
        <div
          className={`sidebar-item ${activeView.type === "ranking" ? "active" : ""}`}
          onClick={() => navigate({ type: "ranking" })}>
          Ranking
          {state.rivals.length > 0 && (
            <span style={{ fontSize: "10px", opacity: 0.6, marginLeft: "6px" }}>
              {state.rivals.length + 1}
            </span>
          )}
        </div>
        <div
          data-tour="nav-rooms"
          className={`sidebar-item ${activeView.type === "rooms" || activeView.type === "room" ? "active" : ""}`}
          onClick={() => navigate({ type: "rooms" })}>
          Salas
        </div>
        {state.simulationActive && (
          <div
            className={`sidebar-item ${activeView.type === "simulator" ? "active" : ""}`}
            onClick={() => navigate({ type: "simulator" })}>
            <span className="sim-dot">●</span> Simulación
          </div>
        )}
      </div>
      <SidebarFooter />
    </nav>
  );
}
