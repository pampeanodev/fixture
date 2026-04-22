import { useRef, useState, useEffect } from "react";
import { useFixture } from "../context/FixtureContext";
import { exportToJson, importFromJson } from "../utils/persistence";
import { randomizePredictions } from "../simulator/randomize";
import { useLocale } from "../i18n";
import "./TopBar.css";

interface TopBarProps {
  onToggleSidebar: () => void;
}

export function TopBar({ onToggleSidebar }: TopBarProps) {
  const { state, dispatch } = useFixture();
  const { t } = useLocale();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  function handleExport() {
    exportToJson({ groupMatches: state.groupMatches, knockoutMatches: state.knockoutMatches });
    setMenuOpen(false);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importFromJson(file);
      dispatch({ type: "IMPORT_STATE", groupMatches: data.groupMatches, knockoutMatches: data.knockoutMatches });
    } catch { alert(t("topbar.importError")); }
    if (fileInputRef.current) fileInputRef.current.value = "";
    setMenuOpen(false);
  }

  function handleRandomize() {
    const { groupMatches, knockoutMatches } = randomizePredictions(
      state.groupMatches,
      state.knockoutMatches,
      state.teams,
    );
    dispatch({ type: "IMPORT_STATE", groupMatches, knockoutMatches });
    setMenuOpen(false);
  }

  function handleStartSimulation() {
    dispatch({ type: "ENTER_SIMULATION" });
    dispatch({ type: "SET_VIEW", view: { type: "simulator" } });
    setMenuOpen(false);
  }

  function handleExitSimulation() {
    dispatch({ type: "EXIT_SIMULATION" });
    if (state.activeView.type === "simulator") {
      dispatch({ type: "SET_VIEW", view: { type: "ranking" } });
    }
    setMenuOpen(false);
  }

  return (
    <div className="topbar">
      <div className="topbar-left">
        <button className="sidebar-toggle" onClick={onToggleSidebar}>☰</button>
        <input
          className="topbar-name-input"
          type="text"
          placeholder={t("topbar.namePlaceholder")}
          value={state.playerName}
          onChange={(e) => dispatch({ type: "SET_PLAYER_NAME", name: e.target.value })}
        />
      </div>

      <div className="topbar-center">
        <div className="mode-toggle" data-tour="mode-toggle">
          <button className={state.mode === "results" ? "active" : ""}
            onClick={() => state.mode !== "results" && dispatch({ type: "TOGGLE_MODE" })}>
            {t("topbar.mode.results")}
          </button>
          <button className={state.mode === "predictions" ? "active" : ""}
            onClick={() => state.mode !== "predictions" && dispatch({ type: "TOGGLE_MODE" })}>
            {t("topbar.mode.predictions")}
          </button>
        </div>
      </div>

      <div className="topbar-right" ref={menuRef}>
        <button className="topbar-menu-btn" onClick={() => setMenuOpen((v) => !v)}>
          ⋯
        </button>
        {menuOpen && (
          <div className="topbar-dropdown">
            {state.mode === "predictions" && (
              <>
                <div className="dropdown-section">{t("topbar.menu.sectionPredictions")}</div>
                <button className="dropdown-item" onClick={handleRandomize}>
                  <span className="dropdown-icon">🎲</span> {t("topbar.menu.randomize")}
                </button>
                <div className="dropdown-divider" />
              </>
            )}
            <div className="dropdown-section">{t("topbar.menu.sectionSimulation")}</div>
            {!state.simulationActive ? (
              <button className="dropdown-item" onClick={handleStartSimulation}>
                <span className="dropdown-icon">▶</span> {t("topbar.menu.startSimulation")}
              </button>
            ) : (
              <button className="dropdown-item" onClick={handleExitSimulation}>
                <span className="dropdown-icon">■</span> {t("topbar.menu.exitSimulation")}
              </button>
            )}
            {state.mode === "results" && (
              <>
                <div className="dropdown-divider" />
                <div className="dropdown-section">{t("topbar.menu.sectionResults")}</div>
                <button className="dropdown-item disabled" disabled
                  title={t("topbar.menu.fetchApiTitle")}>
                  <span className="dropdown-icon">↻</span> {t("topbar.menu.fetchApi")}
                </button>
              </>
            )}
            <div className="dropdown-divider" />
            <div className="dropdown-section">{t("topbar.menu.sectionFixture")}</div>
            <button className="dropdown-item" onClick={handleExport}>
              <span className="dropdown-icon">↑</span> {t("topbar.menu.exportAll")}
            </button>
            <button className="dropdown-item" onClick={() => { fileInputRef.current?.click(); }}>
              <span className="dropdown-icon">↓</span> {t("topbar.menu.importAll")}
            </button>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept=".json" className="import-input" onChange={handleImport} />
      </div>
    </div>
  );
}
