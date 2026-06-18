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
  // unlocks as a fallback, and only once a match has kicked off — a match that
  // hasn't started has no result to enter, so the fallback must never turn
  // future matches into editable empty fields (even when the breaker is tripped).
  const kickoff = new Date(match.dateUtc).getTime();
  if (ctx.now < kickoff) return false;

  // API down (breaker) → manual entry for any kicked-off match.
  if (ctx.circuitBreakerTripped) return true;

  // API up but well past kickoff with still no result → grace elapsed, fall back.
  const grace = isKnockout(match) ? GRACE_PERIOD_KO_MS : GRACE_PERIOD_GROUP_MS;
  const stale = ctx.now > kickoff + grace && match.result === null;
  if (stale) return true;

  return false;
}
