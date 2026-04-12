import { useRef } from "react";
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

  function handleExport() {
    exportToJson({ groupMatches: state.groupMatches, knockoutMatches: state.knockoutMatches });
  }

  function handleExportProde() {
    if (!state.playerName.trim()) {
      alert("Primero poné tu nombre en el campo de arriba.");
      return;
    }
    exportProde(state.playerName, state.groupMatches, state.knockoutMatches);
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

  async function handleImportProde(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rival = await importProde(file);
      dispatch({ type: "ADD_RIVAL", rival });
      alert(`Prode de "${rival.name}" importado.`);
    } catch { alert("Error al importar prode. Verificá el archivo."); }
    if (prodeInputRef.current) prodeInputRef.current.value = "";
  }

  return (
    <div className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button className="sidebar-toggle" onClick={onToggleSidebar}>☰</button>
        <div className="topbar-title">Mundial 2026</div>
      </div>
      <div className="topbar-actions">
        <input
          className="topbar-name-input"
          type="text"
          placeholder="Tu nombre"
          value={state.playerName}
          onChange={(e) => dispatch({ type: "SET_PLAYER_NAME", name: e.target.value })}
        />
        <div className="mode-toggle">
          <button className={state.mode === "results" ? "active" : ""}
            onClick={() => state.mode !== "results" && dispatch({ type: "TOGGLE_MODE" })}>Resultados</button>
          <button className={state.mode === "predictions" ? "active" : ""}
            onClick={() => state.mode !== "predictions" && dispatch({ type: "TOGGLE_MODE" })}>Predicciones</button>
        </div>
        <button className="topbar-btn" onClick={handleExportProde} title="Exportar tus predicciones para compartir">Exportar Prode</button>
        <button className="topbar-btn" onClick={() => prodeInputRef.current?.click()} title="Importar predicciones de un amigo">Importar Prode</button>
        <button className="topbar-btn topbar-btn-secondary" onClick={handleExport} title="Exportar fixture completo">Exportar Todo</button>
        <button className="topbar-btn topbar-btn-secondary" onClick={() => fileInputRef.current?.click()} title="Importar fixture completo">Importar Todo</button>
        <input ref={fileInputRef} type="file" accept=".json" className="import-input" onChange={handleImport} />
        <input ref={prodeInputRef} type="file" accept=".json" className="import-input" onChange={handleImportProde} />
      </div>
    </div>
  );
}
