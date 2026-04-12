import { useFixture } from "./context/FixtureContext";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { GroupView } from "./components/GroupView";
import { BracketView } from "./components/BracketView";
import "./App.css";

export default function App() {
  const { state } = useFixture();
  const { activeView } = state;
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-area">
        <TopBar />
        <div className="main-content">
          {activeView.type === "group" && <GroupView group={activeView.group} />}
          {activeView.type === "knockout" && <BracketView round={activeView.round} />}
        </div>
      </div>
    </div>
  );
}
