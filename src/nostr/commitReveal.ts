import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

export function generateSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return bytesToHex(bytes);
}

export function computeCommitment(
  matchId: string,
  home: number,
  away: number,
  salt: string,
): string {
  const input = `${matchId}:${home}-${away}:${salt}`;
  return bytesToHex(sha256(new TextEncoder().encode(input)));
}

export function verifyReveal(
  matchId: string,
  home: number,
  away: number,
  salt: string,
  commitment: string,
): boolean {
  return computeCommitment(matchId, home, away, salt) === commitment;
}

export interface CommittableMatch {
  id: string;
  dateUtc: string;
  prediction: { home: number; away: number } | null;
}

/**
 * Build the full commitment map to publish. The commitment event is
 * REPLACEABLE (kind 30078): every publish overwrites the previous map, so it
 * must stay cumulative — locked matches keep their previously committed hash,
 * otherwise peers can no longer verify reveals for played matches.
 *
 * For locked matches the STORED hash wins over recomputing: a prediction that
 * mutated after lock (bug, import, tampering) must not rewrite the published
 * commitment. Recomputing from the salt is only a fallback for states saved
 * before hashes were persisted. New commitments are only minted while open.
 */
export function buildCommitmentMap(
  matches: ReadonlyArray<CommittableMatch>,
  existingSalts: Record<string, string>,
  isLocked: (dateUtc: string) => boolean,
  storedCommitments: Record<string, string> = {},
): { commitments: Record<string, string>; salts: Record<string, string> } {
  const salts = { ...existingSalts };
  const commitments: Record<string, string> = {};

  for (const match of matches) {
    if (!match.prediction) continue;
    if (isLocked(match.dateUtc)) {
      const stored = storedCommitments[match.id];
      if (stored) {
        commitments[match.id] = stored;
        continue;
      }
      if (!salts[match.id]) continue; // never mint a commitment after lock
    } else if (!salts[match.id]) {
      salts[match.id] = generateSalt();
    }
    commitments[match.id] = computeCommitment(
      match.id,
      match.prediction.home,
      match.prediction.away,
      salts[match.id],
    );
  }

  return { commitments, salts };
}

const SALTS_PREFIX = "wc2026-salts-";
const COMMITS_PREFIX = "wc2026-commits-";

export function persistCommitments(roomId: string, commitments: Record<string, string>): void {
  try {
    localStorage.setItem(COMMITS_PREFIX + roomId, JSON.stringify(commitments));
  } catch {
    /* storage full */
  }
}

export function loadCommitments(roomId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(COMMITS_PREFIX + roomId);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

export function persistSalts(roomId: string, salts: Record<string, string>): void {
  try {
    localStorage.setItem(SALTS_PREFIX + roomId, JSON.stringify(salts));
  } catch {
    /* storage full */
  }
}

export function loadSalts(roomId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(SALTS_PREFIX + roomId);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * Gather every room's salts, keyed by room id, for inclusion in a full backup.
 * Salts are the only piece needed to re-publish reveals from a new device —
 * without them a migrated user can never reveal their committed predictions.
 */
export function collectAllSalts(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(SALTS_PREFIX)) continue;
      const roomId = key.slice(SALTS_PREFIX.length);
      out[roomId] = loadSalts(roomId);
    }
  } catch {
    /* storage unavailable */
  }
  return out;
}

/**
 * Restore salts from a backup, merging per room so locally-present salts win
 * over imported ones (imported only fills gaps). Idempotent and non-destructive.
 */
export function restoreSalts(byRoom: Record<string, Record<string, string>>): void {
  for (const [roomId, imported] of Object.entries(byRoom)) {
    persistSalts(roomId, { ...imported, ...loadSalts(roomId) });
  }
}
