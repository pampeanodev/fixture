import { useFixture } from "../context/FixtureContext";
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
      <div className="sidebar-brand">Mundial 2026</div>
      <div
        className={`sidebar-item ${activeView.type === "schedule" ? "active" : ""}`}
        onClick={() => navigate({ type: "schedule" })}>
        Calendario
      </div>
      <div
        className={`sidebar-item ${activeView.type === "groups" ? "active" : ""}`}
        onClick={() => navigate({ type: "groups", group: activeView.type === "groups" ? activeView.group : "A" })}>
        Grupos
      </div>
      <div
        className={`sidebar-item ${activeView.type === "knockout" ? "active" : ""}`}
        onClick={() => navigate({ type: "knockout", round: activeView.type === "knockout" ? activeView.round : "R32" })}>
        Eliminatorias
      </div>
    </nav>
  );
}
