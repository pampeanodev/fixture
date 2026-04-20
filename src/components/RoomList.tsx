import { useState } from "react";
import { useNostr } from "../context/NostrContext";
import { useFixture } from "../context/FixtureContext";
import "./RoomList.css";

export function RoomList() {
  const { rooms, createRoom, joinRoom, setActiveRoom } = useNostr();
  const { dispatch } = useFixture();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMode, setNewMode] = useState<"open" | "closed">("open");
  const [joinCode, setJoinCode] = useState("");

  function handleCreate() {
    if (!newName.trim()) return;
    const roomId = createRoom(newName.trim(), newMode);
    setActiveRoom(roomId);
    dispatch({ type: "SET_VIEW", view: { type: "room", roomId } });
    setShowCreate(false);
    setNewName("");
  }

  function handleJoin() {
    if (!joinCode.trim()) return;
    const roomId = joinCode.trim().slice(0, 8);
    joinRoom(roomId);
    setActiveRoom(roomId);
    dispatch({ type: "SET_VIEW", view: { type: "room", roomId } });
    setShowJoin(false);
    setJoinCode("");
  }

  function handleSelectRoom(roomId: string) {
    setActiveRoom(roomId);
    dispatch({ type: "SET_VIEW", view: { type: "room", roomId } });
  }

  return (
    <div className="room-list">
      <div className="room-list-header">
        <h2>Mis Salas</h2>
        <div className="room-list-actions">
          <button data-tour="room-create" className="room-btn" onClick={() => { setShowCreate(true); setShowJoin(false); }}>
            Crear sala
          </button>
          <button data-tour="room-join" className="room-btn" onClick={() => { setShowJoin(true); setShowCreate(false); }}>
            Unirme
          </button>
        </div>
      </div>
      {showCreate && (
        <div className="room-form">
          <input type="text" placeholder="Nombre de la sala" value={newName}
            onChange={(e) => setNewName(e.target.value)} className="room-input" />
          <div className="room-mode-select">
            <label><input type="radio" checked={newMode === "open"} onChange={() => setNewMode("open")} /> Abierta</label>
            <label><input type="radio" checked={newMode === "closed"} onChange={() => setNewMode("closed")} /> Solo con invitacion</label>
          </div>
          <button className="room-btn primary" onClick={handleCreate} disabled={!newName.trim()}>Crear</button>
        </div>
      )}
      {showJoin && (
        <div className="room-form">
          <input type="text" placeholder="Codigo de sala (8 caracteres)" value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)} maxLength={8} className="room-input" />
          <button className="room-btn primary" onClick={handleJoin} disabled={!joinCode.trim()}>Unirme</button>
        </div>
      )}
      {rooms.length === 0 ? (
        <div className="room-list-empty">
          <p>No estas en ninguna sala.</p>
          <p>Crea una para competir con tus amigos, o unite con un codigo.</p>
        </div>
      ) : (
        <div className="room-list-items">
          {rooms.map((room) => (
            <button key={room.roomId} className="room-list-item" onClick={() => handleSelectRoom(room.roomId)}>
              <span className="room-item-name">{room.name}</span>
              <span className="room-item-role">{room.role === "creator" ? "Creador" : "Miembro"}</span>
              <span className="room-item-arrow">&rsaquo;</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
