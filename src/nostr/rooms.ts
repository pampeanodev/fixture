import type { RoomManifest, RoomMembership } from "./types";

const ROOMS_KEY = "wc2026-rooms";
const MANIFESTS_KEY = "wc2026-manifests";

export function persistManifests(manifests: Record<string, RoomManifest>): void {
  try {
    localStorage.setItem(MANIFESTS_KEY, JSON.stringify(manifests));
  } catch {
    /* storage full */
  }
}

export function loadManifests(): Record<string, RoomManifest> {
  try {
    const raw = localStorage.getItem(MANIFESTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, RoomManifest>;
  } catch {
    return {};
  }
}

export function createRoom(): string {
  return randomAlphanumeric(8);
}

export function generateInviteCode(): string {
  return randomAlphanumeric(4);
}

function randomAlphanumeric(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function persistRooms(rooms: RoomMembership[]): void {
  try {
    localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
  } catch {
    /* storage full */
  }
}

export function loadRooms(): RoomMembership[] {
  try {
    const raw = localStorage.getItem(ROOMS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RoomMembership[];
  } catch {
    return [];
  }
}

export function addRoom(
  rooms: RoomMembership[],
  room: RoomMembership,
): RoomMembership[] {
  return [...rooms.filter((r) => r.roomId !== room.roomId), room];
}

export function removeRoom(
  rooms: RoomMembership[],
  roomId: string,
): RoomMembership[] {
  return rooms.filter((r) => r.roomId !== roomId);
}

interface ClaimRecord {
  pubkey: string;
  inviteCode: string;
  claimedAt: number;
}

export function isValidMember(
  manifest: RoomManifest,
  pubkey: string,
  inviteCode: string | undefined,
  claims: ClaimRecord[],
): boolean {
  if (manifest.mode === "open") return true;
  if (pubkey === manifest.creator) return true;
  if (!inviteCode) return false;
  if (!manifest.validInvites.includes(inviteCode)) return false;
  const claim = claims.find((c) => c.inviteCode === inviteCode);
  return claim !== undefined && claim.pubkey === pubkey;
}
