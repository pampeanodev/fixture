import { NOSTR_KIND, TAG_PREFIX } from "./types";
import type {
  RoomManifest,
  InviteClaim,
  CommitmentPayload,
  RevealPayload,
  RevealEntry,
  ResultsPayload,
} from "./types";

interface UnsignedEventTemplate {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
}

export function getDTag(roomId: string, suffix: string): string {
  return `${TAG_PREFIX}:${roomId}:${suffix}`;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

export function buildManifestEvent(manifest: RoomManifest): UnsignedEventTemplate {
  return {
    kind: NOSTR_KIND,
    created_at: now(),
    tags: [["d", getDTag(manifest.roomId, "manifest")]],
    content: JSON.stringify(manifest),
  };
}

export function buildClaimEvent(roomId: string, inviteCode: string): UnsignedEventTemplate {
  const claim: InviteClaim = { roomId, inviteCode };
  return {
    kind: NOSTR_KIND,
    created_at: now(),
    tags: [["d", getDTag(roomId, "claim")]],
    content: JSON.stringify(claim),
  };
}

export function buildCommitmentEvent(
  roomId: string,
  commitments: Record<string, string>,
  playerName?: string,
): UnsignedEventTemplate {
  const payload: CommitmentPayload = { commitments, playerName };
  return {
    kind: NOSTR_KIND,
    created_at: now(),
    tags: [["d", getDTag(roomId, "commit")]],
    content: JSON.stringify(payload),
  };
}

export function buildRevealEvent(
  roomId: string,
  playerName: string,
  predictions: Record<string, RevealEntry>,
): UnsignedEventTemplate {
  const payload: RevealPayload = { playerName, predictions };
  return {
    kind: NOSTR_KIND,
    created_at: now(),
    tags: [["d", getDTag(roomId, "reveal")]],
    content: JSON.stringify(payload),
  };
}

export function buildResultsEvent(
  roomId: string,
  groupResults: ResultsPayload["groupResults"],
  knockoutResults: ResultsPayload["knockoutResults"],
): UnsignedEventTemplate {
  const payload: ResultsPayload = { groupResults, knockoutResults };
  return {
    kind: NOSTR_KIND,
    created_at: now(),
    tags: [["d", getDTag(roomId, "results")]],
    content: JSON.stringify(payload),
  };
}

export function parseEventContent<T>(content: string): T | null {
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}
