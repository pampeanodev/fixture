import { useState, useCallback, useEffect } from "react";
import { useFixture } from "./context/FixtureContext";
import { useNostr } from "./context/NostrContext";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { GroupView } from "./components/GroupView";
import { BracketView } from "./components/BracketView";
import { ScheduleView } from "./components/ScheduleView";
import { RankingView } from "./components/RankingView";
import { RoomList } from "./components/RoomList";
import { RoomDetail } from "./components/RoomDetail";
import { SimulatorView } from "./components/SimulatorView";
import { Onboarding } from "./components/Onboarding";
import { useNostrSync } from "./hooks/useNostrSync";
import "./App.css";

function NostrSyncBridge() {
  useNostrSync();
  return null;
}

function InviteRouter() {
  const { joinRoom, setActiveRoom, identity } = useNostr();
  const { dispatch } = useFixture();

  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/r\/([a-z0-9]{8})$/);
    if (!match) return;
    if (!identity) return; // wait for identity before processing

    const roomId = match[1];
    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get("i") ?? undefined;

    joinRoom(roomId, inviteCode);
    setActiveRoom(roomId);
    dispatch({ type: "SET_VIEW", view: { type: "room", roomId } });

    window.history.replaceState(null, "", "/");
  }, [identity, joinRoom, setActiveRoom, dispatch]);

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
  const { identity } = useNostr();
  const { state } = useFixture();
  const { activeView } = state;
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  const handleNavigation = useCallback(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  if (!identity) return <Onboarding />;

  return (
    <>
      <NostrSyncBridge />
      <InviteRouter />
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
          {activeView.type === "rooms" && <RoomList />}
          {activeView.type === "room" && <RoomDetail roomId={activeView.roomId} />}
          {activeView.type === "simulator" && <SimulatorView />}
        </div>
      </div>
      </div>
    </>
  );
}
