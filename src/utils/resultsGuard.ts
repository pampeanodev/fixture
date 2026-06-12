// src/utils/resultsGuard.ts
// Defense-in-depth for incoming results (ESPN auto-sync, room admin push):
// a real result cannot exist for a match that hasn't kicked off. ESPN lists
// scheduled events with a placeholder 0-0 score, so a transient bad status
// would otherwise write phantom results — and the admin push would then
// propagate them to every room member.
import { INITIAL_GROUP_MATCHES } from "../data/groupMatches";
import { INITIAL_KNOCKOUT_MATCHES } from "../data/knockoutStructure";

const KICKOFF_BY_ID: ReadonlyMap<string, number> = new Map(
  [...INITIAL_GROUP_MATCHES, ...INITIAL_KNOCKOUT_MATCHES].map((m) => [
    m.id,
    new Date(m.dateUtc).getTime(),
  ]),
);

/** True once the match's scheduled kickoff has passed. Unknown ids are never accepted. */
export function hasKickedOff(matchId: string, now: number): boolean {
  const kickoff = KICKOFF_BY_ID.get(matchId);
  if (kickoff === undefined) return false;
  return now >= kickoff;
}

/** Drop entries whose match hasn't kicked off yet (or isn't a known match). */
export function stripPrematureResults<T>(
  results: Record<string, T>,
  now: number,
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [matchId, score] of Object.entries(results)) {
    if (hasKickedOff(matchId, now)) out[matchId] = score;
  }
  return out;
}
