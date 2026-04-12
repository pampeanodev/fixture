import { useRef, useState, useEffect } from "react";
import { useFixture } from "../context/FixtureContext";
import { exportToJson, exportProde, importFromJson, importProde } from "../utils/persistence";
import "./TopBar.css";

interface TopBarProps {
  onToggleSidebar: () => void;
}

export function TopBar({ onToggleSidebar }: TopBarProps) {
  const { state, dispatch } = useFixture();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prodeInputRef = useRef<HTMLInputElement>(null);
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

  function handleExportProde() {
    if (!state.playerName.trim()) {
      alert("Primero poné tu nombre en el campo del topbar.");
      return;
    }
    exportProde(state.playerName, state.groupMatches, state.knockoutMatches);
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

  async function handleImportProde(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rival = await importProde(file);
      dispatch({ type: "ADD_RIVAL", rival });
      alert(`Prode de "${rival.name}" importado.`);
    } catch { alert("Error al importar prode. Verificá el archivo."); }
    if (prodeInputRef.current) prodeInputRef.current.value = "";
    setMenuOpen(false);
  }

  return (
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
            <div className="dropdown-section">Prode</div>
            <button className="dropdown-item" onClick={handleExportProde}>
              <span className="dropdown-icon">↑</span> Exportar mi prode
            </button>
            <button className="dropdown-item" onClick={() => { prodeInputRef.current?.click(); }}>
              <span className="dropdown-icon">↓</span> Importar prode rival
            </button>
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
        <input ref={prodeInputRef} type="file" accept=".json" className="import-input" onChange={handleImportProde} />
      </div>
    </div>
  );
}
