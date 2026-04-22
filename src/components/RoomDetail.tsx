import { useState } from "react";
import { useNostr } from "../context/NostrContext";
import { useFixture } from "../context/FixtureContext";
import { useLocale } from "../i18n";
import { RankingView } from "./RankingView";
import { InviteModal } from "./InviteModal";
import { ConnectionStatus } from "./ConnectionStatus";
import "./RoomDetail.css";

interface RoomDetailProps {
  roomId: string;
}

export function RoomDetail({ roomId }: RoomDetailProps) {
  const { rooms, leaveRoom, setActiveRoom } = useNostr();
  const { dispatch } = useFixture();
  const { t } = useLocale();
  const room = rooms.find((r) => r.roomId === roomId);
  const [showInvite, setShowInvite] = useState(false);

  if (!room) return null;

  function handleLeave() {
    leaveRoom(roomId);
    dispatch({ type: "SET_VIEW", view: { type: "rooms" } });
  }

  function handleBack() {
    setActiveRoom(null);
    dispatch({ type: "SET_VIEW", view: { type: "rooms" } });
  }

  return (
    <div className="room-detail">
      <div className="room-detail-header">
        <button className="room-back-btn" onClick={handleBack}>{t("rooms.detail.backButton")}</button>
        <h2>{room.name}</h2>
        <div className="room-detail-actions">
          <button className="room-btn" onClick={() => setShowInvite(true)}>{t("rooms.detail.inviteButton")}</button>
          <button className="room-btn danger" onClick={handleLeave}>{t("rooms.detail.leaveButton")}</button>
        </div>
      </div>
      <div className="room-detail-meta">
        <span className="room-detail-code">{t("rooms.detail.codeLabel")}: <code>{roomId}</code></span>
        <ConnectionStatus />
      </div>
      <RankingView />
      {showInvite && <InviteModal roomId={roomId} onClose={() => setShowInvite(false)} />}
    </div>
  );
}
