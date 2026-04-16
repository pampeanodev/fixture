import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  persistManifests,
  loadManifests,
} from "../nostr/rooms";
import { buildManifestEvent, buildClaimEvent } from "../nostr/events";
import { publishEvent, flushOutbox, closePool } from "../nostr/relayPool";
import { enqueueEvent } from "../nostr/outbox";

interface NostrContextValue {
  identity: NostrIdentity | null;
  rooms: RoomMembership[];
  activeRoomId: string | null;
  connectionStatus: ConnectionStatus;
  setupIdentity: () => NostrIdentity;
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
  const [relayConnected, setRelayConnected] = useState(false);
  const manifestsRef = useRef<Map<string, RoomManifest>>(
    new Map(Object.entries(loadManifests()))
  );

  const hasRooms = rooms.length > 0;
  const connectionStatus: ConnectionStatus = useMemo(() => {
    if (!hasRooms || !identity) return "offline";
    return relayConnected ? "connected" : "connecting";
  }, [hasRooms, identity, relayConnected]);

  useEffect(() => {
    persistRooms(rooms);
  }, [rooms]);

  useEffect(() => {
    if (!hasRooms || !identity) {
      closePool();
      return;
    }
    let cancelled = false;
    flushOutbox(identity).then(() => {
      if (!cancelled) setRelayConnected(true);
    }).catch(() => {
      if (!cancelled) setRelayConnected(false);
    });
    return () => {
      cancelled = true;
      setRelayConnected(false);
    };
  }, [hasRooms, identity]);

  const setupIdentity = useCallback(() => {
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
    persistManifests(Object.fromEntries(manifestsRef.current));

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
      persistManifests(Object.fromEntries(manifestsRef.current));
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
