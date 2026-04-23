// src/espn/graceLock.ts
import type { GroupMatch, KnockoutMatch } from "../types";

export const GRACE_PERIOD_GROUP_MS = 3 * 60 * 60 * 1000; // 3h
export const GRACE_PERIOD_KO_MS = 4.5 * 60 * 60 * 1000; // 4.5h

export interface EditabilityContext {
  autoSyncEnabled: boolean;
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
  if (!ctx.autoSyncEnabled) return true;
  if (ctx.circuitBreakerTripped) return true;

  const kickoff = new Date(match.dateUtc).getTime();
  const grace = isKnockout(match) ? GRACE_PERIOD_KO_MS : GRACE_PERIOD_GROUP_MS;
  const stale = ctx.now > kickoff + grace && match.result === null;
  if (stale) return true;

  return false;
}
