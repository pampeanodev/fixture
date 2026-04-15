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

const SALTS_PREFIX = "wc2026-salts-";

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
