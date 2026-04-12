// src/utils/bestThirds.ts
import type { StandingRow } from "../types";

export interface ThirdPlaceEntry {
  group: string;
  standing: StandingRow;
}

export function rankThirdPlacedTeams(thirds: ThirdPlaceEntry[]): ThirdPlaceEntry[] {
  return [...thirds].sort((a, b) => {
    const sa = a.standing; const sb = b.standing;
    if (sb.points !== sa.points) return sb.points - sa.points;
    if (sb.goalDifference !== sa.goalDifference) return sb.goalDifference - sa.goalDifference;
    if (sb.goalsFor !== sa.goalsFor) return sb.goalsFor - sa.goalsFor;
    return a.group.localeCompare(b.group);
  });
}

export function selectBestThirds(thirds: ThirdPlaceEntry[]): {
  qualifying: ThirdPlaceEntry[];
  eliminated: ThirdPlaceEntry[];
} {
  const ranked = rankThirdPlacedTeams(thirds);
  return { qualifying: ranked.slice(0, 8), eliminated: ranked.slice(8) };
}
