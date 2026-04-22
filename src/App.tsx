import { useEffect } from "react";
import { useFixture } from "./context/FixtureContext";
import { useNostr } from "./context/NostrContext";
import { SidebarProvider, useSidebar } from "./context/SidebarContext";
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
import { HelpMenu } from "./components/HelpMenu";
import { useNostrSync } from "./hooks/useNostrSync";
import type { TourId } from "./tour/steps";
import type { ViewTarget } from "./types";
import "./App.css";

function contextTour(activeView: ViewTarget): TourId {
  switch (activeView.type) {
    case "groups": return "groups";
    case "knockout": return "knockout";
    case "rooms":
    case "room": return "rooms";
    case "simulator": return "simulator";
    default: return "overview";
  }
}

function NostrSyncBridge() {
  useNostrSync();
  return null;
}

function TourBridge({ activeView }: { activeView: ViewTarget }) {
  return <HelpMenu tourId={contextTour(activeView)} />;
}

function InviteRouter() {
  const { joinRoom, setActiveRoom, identity } = useNostr();
  const { dispatch } = useFixture();

  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/r\/([a-z0-9]{8})$/);
    if (!match) return;
    if (!identity) return;

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

function AppContent() {
  const { state } = useFixture();
  const { activeView } = state;
  const { isOpen, isMobile, setOpen, toggle } = useSidebar();

  function handleNavigation() {
    if (isMobile) setOpen(false);
  }

  return (
    <>
      <NostrSyncBridge />
      <InviteRouter />
      <TourBridge activeView={activeView} />
      <div className="app-layout">
        {isMobile && isOpen && (
          <div className="sidebar-overlay visible" onClick={() => setOpen(false)} />
        )}
        <Sidebar
          collapsed={!isOpen}
          isMobile={isMobile}
          onNavigate={handleNavigation}
        />
        <div className="main-area">
          <TopBar onToggleSidebar={toggle} />
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

export default function App() {
  const { identity } = useNostr();

  if (!identity) return <Onboarding />;

  return (
    <SidebarProvider>
      <AppContent />
    </SidebarProvider>
  );
}
