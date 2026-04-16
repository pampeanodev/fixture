import { useState } from "react";
import { useNostr } from "../context/NostrContext";
import { useFixture } from "../context/FixtureContext";
import { RankingView } from "./RankingView";
import { InviteModal } from "./InviteModal";
import "./RoomDetail.css";

interface RoomDetailProps {
  roomId: string;
}

export function RoomDetail({ roomId }: RoomDetailProps) {
  const { rooms, leaveRoom, setActiveRoom } = useNostr();
  const { dispatch } = useFixture();
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
        <button className="room-back-btn" onClick={handleBack}>&lsaquo; Salas</button>
        <h2>{room.name}</h2>
        <div className="room-detail-actions">
          <button className="room-btn" onClick={() => setShowInvite(true)}>Invitar</button>
          <button className="room-btn danger" onClick={handleLeave}>Salir</button>
        </div>
      </div>
      <div className="room-detail-code">Codigo: <code>{roomId}</code></div>
      <RankingView />
      {showInvite && <InviteModal roomId={roomId} onClose={() => setShowInvite(false)} />}
    </div>
  );
}
