import { useNostr } from "../context/NostrContext";

export function ConnectionStatus() {
  const { connectionStatus } = useNostr();
  const labels: Record<string, string> = {
    offline: "Sin conexion",
    connecting: "Conectando...",
    connected: "Conectado",
  };
  const colors: Record<string, string> = {
    offline: "#999",
    connecting: "#f5a623",
    connected: "#4caf50",
  };
  return (
    <span
      className="connection-status"
      style={{ color: colors[connectionStatus] }}
      title={labels[connectionStatus]}
    >
      {connectionStatus === "connected" ? "\u25CF" : "\u25CB"}
    </span>
  );
}
