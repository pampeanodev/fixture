import type {
  GroupMatch,
  KnockoutMatch,
  KnockoutRound,
  StandingRow,
  Team,
} from "../types";
import { generateGroupResult, generateKnockoutResult } from "./resultGenerator";
import { calculateStandings } from "../utils/standings";
import { selectBestThirds } from "../utils/bestThirds";
import type { ThirdPlaceEntry } from "../utils/bestThirds";
import { resolveKnockoutTeams } from "../utils/knockout";
import { assignThirdPlaceSlots } from "../data/thirdPlaceMapping";

const GROUPS = ["A","B","C","D","E","F","G","H","I","J","K","L"];
const ROUNDS: KnockoutRound[] = ["R32", "R16", "QF", "SF", "3P", "F"];

/**
 * Generate random predictions for every match in the fixture, cascading through
 * the knockout bracket so later rounds' teams resolve from earlier rounds'
 * predicted winners. Existing predictions are overwritten; `result` fields are
 * preserved as-is.
 */
export function randomizePredictions(
  groupMatches: GroupMatch[],
  knockoutMatches: KnockoutMatch[],
  teams: readonly Team[],
): { groupMatches: GroupMatch[]; knockoutMatches: KnockoutMatch[] } {
  // Phase 1: randomize all group predictions.
  const newGroupMatches: GroupMatch[] = groupMatches.map((m) => ({
    ...m,
    prediction: generateGroupResult(m.homeTeamId, m.awayTeamId),
  }));

  // Phase 2: compute standings based on these predictions.
  const standingsByGroup: Record<string, StandingRow[]> = {};
  for (const group of GROUPS) {
    const grpMatches = newGroupMatches.filter((m) => m.group === group);
    const teamIds = teams.filter((t) => t.group === group).map((t) => t.id);
    standingsByGroup[group] = calculateStandings(grpMatches, teamIds, "prediction");
  }

  const thirds: ThirdPlaceEntry[] = [];
  for (const group of GROUPS) {
    const rows = standingsByGroup[group];
    if (rows && rows.length >= 3) thirds.push({ group, standing: rows[2] });
  }
  const best = selectBestThirds(thirds);
  const qualifyingThirds = best.qualifying.map((t) => t.group);
  const thirdAssignment = assignThirdPlaceSlots(qualifyingThirds);

  // Phase 3: iteratively simulate each knockout round. We temporarily write
  // predictions into `result` so `resolveKnockoutTeams` (which uses `result`
  // for winner/loser slot resolution) can cascade through rounds.
  let tempMatches: KnockoutMatch[] = knockoutMatches.map((m) => ({
    ...m,
    result: m.prediction,
  }));

  for (const round of ROUNDS) {
    const resolved = resolveKnockoutTeams(
      tempMatches,
      standingsByGroup,
      thirdAssignment,
      qualifyingThirds,
    );
    tempMatches = resolved.map((m) => {
      if (m.round !== round) return m;
      if (!m.homeTeamId || !m.awayTeamId) return m;
      const pred = generateKnockoutResult(m.homeTeamId, m.awayTeamId);
      return { ...m, prediction: pred, result: pred };
    });
  }

  // Phase 4: restore original `result` values (we only wanted to mutate
  // `prediction` — results are a separate concern).
  const originalResultsById = new Map(knockoutMatches.map((m) => [m.id, m.result]));
  const newKnockoutMatches: KnockoutMatch[] = tempMatches.map((m) => ({
    ...m,
    result: originalResultsById.get(m.id) ?? null,
  }));

  return { groupMatches: newGroupMatches, knockoutMatches: newKnockoutMatches };
}
