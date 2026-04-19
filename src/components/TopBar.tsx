import { useRef, useState, useEffect } from "react";
import { useFixture } from "../context/FixtureContext";
import { exportToJson, importFromJson } from "../utils/persistence";
import { AccountModal } from "./AccountModal";
import { randomizePredictions } from "../simulator/randomize";
import "./TopBar.css";

interface TopBarProps {
  onToggleSidebar: () => void;
}

export function TopBar({ onToggleSidebar }: TopBarProps) {
  const { state, dispatch } = useFixture();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
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
    } catch { alert("Error al importar. Verificá que sea un JSON válido."); }
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
    <>
    <div className="topbar">
      <div className="topbar-left">
        <button className="sidebar-toggle" onClick={onToggleSidebar}>☰</button>
        <input
          className="topbar-name-input"
          type="text"
          placeholder="Tu nombre"
          value={state.playerName}
          onChange={(e) => dispatch({ type: "SET_PLAYER_NAME", name: e.target.value })}
        />
      </div>

      <div className="topbar-center">
        <div className="mode-toggle">
          <button className={state.mode === "results" ? "active" : ""}
            onClick={() => state.mode !== "results" && dispatch({ type: "TOGGLE_MODE" })}>
            Resultados
          </button>
          <button className={state.mode === "predictions" ? "active" : ""}
            onClick={() => state.mode !== "predictions" && dispatch({ type: "TOGGLE_MODE" })}>
            Predicciones
          </button>
        </div>
      </div>

      <div className="topbar-right" ref={menuRef}>
        <button className="topbar-menu-btn" onClick={() => setMenuOpen((v) => !v)}>
          ⋯
        </button>
        {menuOpen && (
          <div className="topbar-dropdown">
            <div className="dropdown-section">Cuenta</div>
            <button className="dropdown-item" onClick={() => { setShowAccount(true); setMenuOpen(false); }}>
              <span className="dropdown-icon">&#9881;</span> Mi cuenta
            </button>
            {state.mode === "predictions" && (
              <>
                <div className="dropdown-divider" />
                <div className="dropdown-section">Predicciones</div>
                <button className="dropdown-item" onClick={handleRandomize}>
                  <span className="dropdown-icon">🎲</span> Regenerar random
                </button>
              </>
            )}
            <div className="dropdown-divider" />
            <div className="dropdown-section">Simulación</div>
            {!state.simulationActive ? (
              <button className="dropdown-item" onClick={handleStartSimulation}>
                <span className="dropdown-icon">▶</span> Iniciar simulación
              </button>
            ) : (
              <button className="dropdown-item" onClick={handleExitSimulation}>
                <span className="dropdown-icon">■</span> Salir de simulación
              </button>
            )}
            <div className="dropdown-divider" />
            <div className="dropdown-section">Fixture</div>
            <button className="dropdown-item" onClick={handleExport}>
              <span className="dropdown-icon">↑</span> Exportar todo
            </button>
            <button className="dropdown-item" onClick={() => { fileInputRef.current?.click(); }}>
              <span className="dropdown-icon">↓</span> Importar todo
            </button>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept=".json" className="import-input" onChange={handleImport} />
      </div>
    </div>
    {showAccount && <AccountModal onClose={() => setShowAccount(false)} />}
  </>
  );
}
