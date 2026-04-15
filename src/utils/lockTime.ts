const LOCK_OFFSET_MS = 60 * 60 * 1000; // 1 hour

export function getMatchLockTime(dateUtc: string): number {
  return new Date(dateUtc).getTime() - LOCK_OFFSET_MS;
}

export function isMatchLocked(dateUtc: string): boolean {
  return Date.now() >= getMatchLockTime(dateUtc);
}
