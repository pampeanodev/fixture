import { useNostr } from "../context/NostrContext";
import "./ConnectionStatus.css";

const LABELS = {
  offline: "Sin conexión",
  connecting: "Conectando...",
  connected: "Conectado",
} as const;

export function ConnectionStatus() {
  const { connectionStatus } = useNostr();
  return (
    <div className={`connection-status connection-status--${connectionStatus}`}>
      <span className="connection-status-dot" />
      <span className="connection-status-label">{LABELS[connectionStatus]}</span>
    </div>
  );
}
