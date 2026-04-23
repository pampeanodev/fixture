// src/espn/normalizer.ts
import { TEAM_IDS } from "../data/teams";
import type { TeamId } from "../types";

// Overrides for ESPN codes that don't match our FIFA 3-letter TeamIds.
// This table is populated during dev-inspector rehearsal. Start empty;
// the normalizer test fails if a team becomes unreachable, prompting an
// entry here.
//
// KEY = raw ESPN abbreviation (upper-cased, as the normalizer upper-cases
// its input before lookup). VALUE = our TeamId.
export const ESPN_TEAM_CODE_MAP: Readonly<Record<string, TeamId>> = Object.freeze({
  // Example shape (no known overrides at planning time):
  // "USA": "USA",
  // "KOR": "KOR",
});

const TEAM_ID_SET: ReadonlySet<string> = new Set(TEAM_IDS);

export function normalizeTeamCode(raw: string | undefined | null): TeamId | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase();
  if (upper.length === 0) return null;

  const mapped = ESPN_TEAM_CODE_MAP[upper];
  if (mapped) return mapped;

  if (TEAM_ID_SET.has(upper)) return upper as TeamId;

  return null;
}
