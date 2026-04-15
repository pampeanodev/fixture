import { useState, useCallback, useEffect } from "react";
import { useFixture } from "./context/FixtureContext";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { GroupView } from "./components/GroupView";
import { BracketView } from "./components/BracketView";
import { ScheduleView } from "./components/ScheduleView";
import { RankingView } from "./components/RankingView";
import { useNostrSync } from "./hooks/useNostrSync";
import "./App.css";

function NostrSyncBridge() {
  useNostrSync();
  return null;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

export default function App() {
  const { state } = useFixture();
  const { activeView } = state;
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  // Close sidebar on mobile when navigating
  const handleNavigation = useCallback(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  // Sync sidebar state when crossing the breakpoint
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  return (
    <>
      <NostrSyncBridge />
      <div className="app-layout">
      {isMobile && sidebarOpen && (
        <div className="sidebar-overlay visible" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar
        collapsed={!sidebarOpen}
        isMobile={isMobile}
        onNavigate={handleNavigation}
      />
      <div className="main-area">
        <TopBar onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <div className="main-content">
          {activeView.type === "groups" && <GroupView group={activeView.group} />}
          {activeView.type === "knockout" && <BracketView round={activeView.round} />}
          {activeView.type === "schedule" && <ScheduleView />}
          {activeView.type === "ranking" && <RankingView />}
        </div>
      </div>
      </div>
    </>
  );
}
