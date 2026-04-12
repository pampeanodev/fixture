import { useRef } from "react";
import { useFixture } from "../context/FixtureContext";
import { exportToJson, importFromJson } from "../utils/persistence";
import "./TopBar.css";

interface TopBarProps {
  onToggleSidebar: () => void;
}

export function TopBar({ onToggleSidebar }: TopBarProps) {
  const { state, dispatch } = useFixture();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    exportToJson({ groupMatches: state.groupMatches, knockoutMatches: state.knockoutMatches });
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importFromJson(file);
      dispatch({ type: "IMPORT_STATE", groupMatches: data.groupMatches, knockoutMatches: data.knockoutMatches });
    } catch { alert("Error al importar. Verificá que sea un JSON válido."); }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button className="sidebar-toggle" onClick={onToggleSidebar}>☰</button>
        <div className="topbar-title">Mundial 2026</div>
      </div>
      <div className="topbar-actions">
        <div className="mode-toggle">
          <button className={state.mode === "results" ? "active" : ""}
            onClick={() => state.mode !== "results" && dispatch({ type: "TOGGLE_MODE" })}>Resultados</button>
          <button className={state.mode === "predictions" ? "active" : ""}
            onClick={() => state.mode !== "predictions" && dispatch({ type: "TOGGLE_MODE" })}>Predicciones</button>
        </div>
        <button className="topbar-btn" onClick={handleExport}>Exportar</button>
        <button className="topbar-btn" onClick={() => fileInputRef.current?.click()}>Importar</button>
        <input ref={fileInputRef} type="file" accept=".json" className="import-input" onChange={handleImport} />
      </div>
    </div>
  );
}
