import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import type {
  NostrIdentity,
  RoomMembership,
  RoomManifest,
  ConnectionStatus,
} from "../nostr/types";
import {
  generateIdentity,
  restoreFromMnemonic,
  persistIdentity,
  loadIdentity,
  clearIdentity,
  encodeNsec,
} from "../nostr/identity";
import {
  createRoom as createRoomId,
  generateInviteCode,
  persistRooms,
  loadRooms,
  addRoom,
  removeRoom,
} from "../nostr/rooms";
import { buildManifestEvent, buildClaimEvent } from "../nostr/events";
import { publishEvent, flushOutbox, closePool } from "../nostr/relayPool";
import { enqueueEvent } from "../nostr/outbox";

interface NostrContextValue {
  identity: NostrIdentity | null;
  rooms: RoomMembership[];
  activeRoomId: string | null;
  connectionStatus: ConnectionStatus;
  setupIdentity: (name?: string) => NostrIdentity;
  restoreIdentityFromMnemonic: (mnemonic: string) => void;
  exportIdentity: () => { mnemonic: string; nsec: string } | null;
  clearUserIdentity: () => void;
  createRoom: (name: string, mode: "open" | "closed") => string;
  joinRoom: (roomId: string, inviteCode?: string) => void;
  leaveRoom: (roomId: string) => void;
  createInvite: (roomId: string) => string;
  setActiveRoom: (roomId: string | null) => void;
}

const NostrContext = createContext<NostrContextValue | null>(null);

export function NostrProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<NostrIdentity | null>(() => loadIdentity());
  const [rooms, setRooms] = useState<RoomMembership[]>(() => loadRooms());
  const [activeRoomId, setActiveRoom] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("offline");
  const manifestsRef = useRef<Map<string, RoomManifest>>(new Map());

  // Persist rooms on change
  useEffect(() => {
    persistRooms(rooms);
  }, [rooms]);

  // Manage connection status based on rooms
  useEffect(() => {
    if (rooms.length === 0 || !identity) {
      setConnectionStatus("offline");
      closePool();
      return;
    }
    setConnectionStatus("connecting");
    // Flush any queued events
    flushOutbox(identity).then(() => {
      setConnectionStatus("connected");
    }).catch(() => {
      setConnectionStatus("offline");
    });
  }, [rooms.length, identity]);

  const setupIdentity = useCallback((_name?: string) => {
    const id = generateIdentity();
    persistIdentity(id);
    setIdentity(id);
    return id;
  }, []);

  const restoreIdentityFromMnemonic = useCallback((mnemonic: string) => {
    const id = restoreFromMnemonic(mnemonic);
    persistIdentity(id);
    setIdentity(id);
  }, []);

  const exportIdentity = useCallback(() => {
    if (!identity) return null;
    return { mnemonic: identity.mnemonic, nsec: encodeNsec(identity) };
  }, [identity]);

  const clearUserIdentity = useCallback(() => {
    clearIdentity();
    setIdentity(null);
  }, []);

  const createRoom = useCallback((name: string, mode: "open" | "closed") => {
    if (!identity) throw new Error("No identity");
    const roomId = createRoomId();
    const membership: RoomMembership = {
      roomId,
      name,
      joinedAt: Date.now(),
      role: "creator",
    };
    setRooms((prev) => addRoom(prev, membership));

    const manifest: RoomManifest = {
      roomId,
      mode,
      creator: identity.pubkey,
      validInvites: [],
    };
    manifestsRef.current.set(roomId, manifest);

    const event = buildManifestEvent(manifest);
    publishEvent(event, identity).catch(() => {
      enqueueEvent({ eventTemplate: event, createdAt: Date.now() });
    });

    return roomId;
  }, [identity]);

  const joinRoom = useCallback((roomId: string, inviteCode?: string) => {
    if (!identity) throw new Error("No identity");
    const membership: RoomMembership = {
      roomId,
      name: roomId,
      joinedAt: Date.now(),
      inviteCode,
      role: "member",
    };
    setRooms((prev) => addRoom(prev, membership));

    if (inviteCode) {
      const event = buildClaimEvent(roomId, inviteCode);
      publishEvent(event, identity).catch(() => {
        enqueueEvent({ eventTemplate: event, createdAt: Date.now() });
      });
    }
  }, [identity]);

  const leaveRoom = useCallback((roomId: string) => {
    setRooms((prev) => removeRoom(prev, roomId));
    if (activeRoomId === roomId) setActiveRoom(null);
  }, [activeRoomId]);

  const createInvite = useCallback((roomId: string) => {
    if (!identity) throw new Error("No identity");
    const code = generateInviteCode();
    const manifest = manifestsRef.current.get(roomId);
    if (manifest && manifest.creator === identity.pubkey) {
      manifest.validInvites = [...manifest.validInvites, code];
      const event = buildManifestEvent(manifest);
      publishEvent(event, identity).catch(() => {
        enqueueEvent({ eventTemplate: event, createdAt: Date.now() });
      });
    }
    return code;
  }, [identity]);

  const value: NostrContextValue = {
    identity,
    rooms,
    activeRoomId,
    connectionStatus,
    setupIdentity,
    restoreIdentityFromMnemonic,
    exportIdentity,
    clearUserIdentity,
    createRoom,
    joinRoom,
    leaveRoom,
    createInvite,
    setActiveRoom,
  };

  return <NostrContext.Provider value={value}>{children}</NostrContext.Provider>;
}

export function useNostr(): NostrContextValue {
  const ctx = useContext(NostrContext);
  if (!ctx) throw new Error("useNostr must be used within NostrProvider");
  return ctx;
}
