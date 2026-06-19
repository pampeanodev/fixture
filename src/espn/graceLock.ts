// src/espn/graceLock.ts
import type { GroupMatch, KnockoutMatch } from "../types";

export const GRACE_PERIOD_GROUP_MS = 3 * 60 * 60 * 1000; // 3h
export const GRACE_PERIOD_KO_MS = 4.5 * 60 * 60 * 1000; // 4.5h

export interface EditabilityContext {
  circuitBreakerTripped: boolean;
  now: number;
}

function isKnockout(m: GroupMatch | KnockoutMatch): m is KnockoutMatch {
  return "round" in m;
}

export function isMatchEditable(
  match: GroupMatch | KnockoutMatch,
  ctx: EditabilityContext,
): boolean {
  // Auto-sync is always on (ESPN is the source of truth). Manual entry only
  // unlocks as a fallback, and only once a match should already be OVER — never
  // while it is in progress. A match still being played has no final result to
  // enter, so showing empty manual-entry fields then is premature; it shows the
  // lock indicator instead. The grace window doubles as "the match should be
  // finished by now", so we gate manual entry behind it in every case —
  // including when the breaker is tripped.
  const kickoff = new Date(match.dateUtc).getTime();
  const grace = isKnockout(match) ? GRACE_PERIOD_KO_MS : GRACE_PERIOD_GROUP_MS;
  if (ctx.now <= kickoff + grace) return false;

  // The match should be over by now. API down (breaker) → allow manual entry or
  // correction. API up but it still never delivered a result → stale fallback.
  if (ctx.circuitBreakerTripped) return true;
  return match.result === null;
}
