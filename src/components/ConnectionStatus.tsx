import { useNostr } from "../context/NostrContext";
import { useLocale } from "../i18n";
import "./ConnectionStatus.css";

export function ConnectionStatus() {
  const { connectionStatus } = useNostr();
  const { t } = useLocale();
  const label =
    connectionStatus === "connected"
      ? t("rooms.connection.connected")
      : connectionStatus === "connecting"
        ? t("rooms.connection.connecting")
        : t("rooms.connection.disconnected"); // "offline" maps to disconnected label
  return (
    <div className={`connection-status connection-status--${connectionStatus}`}>
      <span className="connection-status-dot" />
      <span className="connection-status-label">{label}</span>
    </div>
  );
}
