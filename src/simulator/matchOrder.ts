import type { GroupMatch, KnockoutMatch } from "../types";
import type { PendingMatch } from "./types";

/**
 * Returns the chronologically earliest unplayed match, respecting a set of skipped match IDs.
 * Knockout matches are only considered pending if both team IDs are resolved.
 */
export function nextPendingMatch(
  groupMatches: GroupMatch[],
  resolvedKnockoutMatches: KnockoutMatch[],
  skipped: Set<string>,
): PendingMatch | null {
  const pending: PendingMatch[] = [];

  for (const m of groupMatches) {
    if (m.result) continue;
    if (skipped.has(m.id)) continue;
    pending.push({ kind: "group", match: m });
  }

  for (const m of resolvedKnockoutMatches) {
    if (m.result) continue;
    if (skipped.has(m.id)) continue;
    if (!m.homeTeamId || !m.awayTeamId) continue;
    pending.push({ kind: "knockout", match: m });
  }

  if (pending.length === 0) return null;

  pending.sort((a, b) => a.match.dateUtc.localeCompare(b.match.dateUtc));
  return pending[0];
}
