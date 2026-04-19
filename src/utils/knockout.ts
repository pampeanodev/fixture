// src/utils/knockout.ts
import type { KnockoutMatch, KnockoutSlot, Score, StandingRow } from "../types";
import type { ThirdPlaceAssignment } from "../data/thirdPlaceMapping";

function getWinner(homeTeamId: string | null, awayTeamId: string | null, score: Score | null): string | null {
  if (!homeTeamId || !awayTeamId || !score) return null;
  if (score.home > score.away) return homeTeamId;
  if (score.away > score.home) return awayTeamId;
  if (score.penalties) {
    return score.penalties.home > score.penalties.away ? homeTeamId : awayTeamId;
  }
  return null;
}

function getLoser(homeTeamId: string | null, awayTeamId: string | null, score: Score | null): string | null {
  const winner = getWinner(homeTeamId, awayTeamId, score);
  if (!winner || !homeTeamId || !awayTeamId) return null;
  return winner === homeTeamId ? awayTeamId : homeTeamId;
}

function resolveSlot(
  slot: KnockoutSlot,
  matchId: string,
  standingsByGroup: Record<string, StandingRow[]>,
  thirdAssignment: ThirdPlaceAssignment,
  matchMap: Map<string, KnockoutMatch>,
  qualifyingThirdGroups: string[]
): string | null {
  switch (slot.type) {
    case "group": {
      const standings = standingsByGroup[slot.group];
      if (!standings || standings.length < slot.position) return null;
      return standings[slot.position - 1].teamId;
    }
    case "best_third": {
      for (const group of slot.possibleGroups) {
        if (thirdAssignment[group] !== matchId) continue;
        if (!qualifyingThirdGroups.includes(group)) continue;
        const groupStandings = standingsByGroup[group];
        if (groupStandings && groupStandings.length >= 3) {
          return groupStandings[2].teamId;
        }
      }
      return null;
    }
    case "winner": {
      const prev = matchMap.get(slot.matchId);
      if (!prev) return null;
      return getWinner(prev.homeTeamId, prev.awayTeamId, prev.result);
    }
    case "loser": {
      const prev = matchMap.get(slot.matchId);
      if (!prev) return null;
      return getLoser(prev.homeTeamId, prev.awayTeamId, prev.result);
    }
  }
}

export function resolveKnockoutTeams(
  matches: KnockoutMatch[],
  standingsByGroup: Record<string, StandingRow[]>,
  thirdAssignment: ThirdPlaceAssignment,
  qualifyingThirdGroups: string[]
): KnockoutMatch[] {
  const matchMap = new Map<string, KnockoutMatch>();
  const resolved = matches.map((m) => ({ ...m }));
  for (const m of resolved) { matchMap.set(m.id, m); }

  const roundOrder: KnockoutMatch["round"][] = ["R32", "R16", "QF", "SF", "3P", "F"];

  for (const round of roundOrder) {
    for (const match of resolved.filter((m) => m.round === round)) {
      const newHome = resolveSlot(match.homeSlot, match.id, standingsByGroup, thirdAssignment, matchMap, qualifyingThirdGroups);
      const newAway = resolveSlot(match.awaySlot, match.id, standingsByGroup, thirdAssignment, matchMap, qualifyingThirdGroups);

      const resolvedHome = newHome ?? match.homeTeamId;
      const resolvedAway = newAway ?? match.awayTeamId;

      const homeChanged = match.homeTeamId !== null && match.homeTeamId !== resolvedHome;
      const awayChanged = match.awayTeamId !== null && match.awayTeamId !== resolvedAway;

      match.homeTeamId = resolvedHome;
      match.awayTeamId = resolvedAway;

      if (homeChanged || awayChanged) {
        match.result = null;
        match.prediction = null;
      }

      matchMap.set(match.id, match);
    }
  }

  return resolved;
}
