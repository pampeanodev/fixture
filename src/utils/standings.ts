// src/utils/standings.ts
import type { GroupMatch, StandingRow, ScoreSource } from "../types";
import { effectiveScore } from "./effectiveScore";

// Accumulate per-team stats from the matches played *between the given teams*.
// With the full group team list this is the overall table; with a tied subset
// it's the head-to-head mini-table FIFA uses as a tie-breaker.
function accumulate(
  teamIds: string[],
  matches: GroupMatch[],
  scoreField: ScoreSource,
): Map<string, StandingRow> {
  const map = new Map<string, StandingRow>();
  for (const id of teamIds) {
    map.set(id, {
      teamId: id, played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
    });
  }
  const set = new Set(teamIds);
  for (const match of matches) {
    if (!set.has(match.homeTeamId) || !set.has(match.awayTeamId)) continue;
    const score = effectiveScore(match, scoreField);
    if (!score) continue;
    const home = map.get(match.homeTeamId)!;
    const away = map.get(match.awayTeamId)!;
    home.played++; away.played++;
    home.goalsFor += score.home; home.goalsAgainst += score.away;
    away.goalsFor += score.away; away.goalsAgainst += score.home;
    if (score.home > score.away) { home.won++; home.points += 3; away.lost++; }
    else if (score.home < score.away) { away.won++; away.points += 3; home.lost++; }
    else { home.drawn++; away.drawn++; home.points += 1; away.points += 1; }
  }
  for (const row of map.values()) row.goalDifference = row.goalsFor - row.goalsAgainst;
  return map;
}

// FIFA 2026 step 2 / 3: overall goal difference, then overall goals scored, then
// a deterministic fallback (fair-play conduct and FIFA ranking aren't available
// to the app — teamId keeps the order stable so simulator and UI agree).
function byOverall(tied: StandingRow[]): StandingRow[] {
  return [...tied].sort((a, b) =>
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    a.teamId.localeCompare(b.teamId),
  );
}

// Break a set of teams level on overall points, per FIFA 2026: first the
// head-to-head mini-table (points, GD, goals among only the tied teams), then
// — for any teams still level — overall GD/goals. Head-to-head is re-applied to
// the matches between teams that remain level after a partial split (recursion).
function breakTie(
  tied: StandingRow[],
  matches: GroupMatch[],
  scoreField: ScoreSource,
): StandingRow[] {
  const h2h = accumulate(tied.map((r) => r.teamId), matches, scoreField);
  const sorted = [...tied].sort((a, b) => {
    const ha = h2h.get(a.teamId)!;
    const hb = h2h.get(b.teamId)!;
    return hb.points - ha.points || hb.goalDifference - ha.goalDifference || hb.goalsFor - ha.goalsFor;
  });

  const out: StandingRow[] = [];
  let i = 0;
  while (i < sorted.length) {
    const hi = h2h.get(sorted[i].teamId)!;
    let j = i + 1;
    while (j < sorted.length) {
      const hj = h2h.get(sorted[j].teamId)!;
      if (hj.points === hi.points && hj.goalDifference === hi.goalDifference && hj.goalsFor === hi.goalsFor) j++;
      else break;
    }
    const sub = sorted.slice(i, j);
    if (sub.length === 1) out.push(sub[0]);
    else if (sub.length === tied.length) out.push(...byOverall(sub)); // h2h split nobody → overall
    else out.push(...breakTie(sub, matches, scoreField));             // partial → re-apply h2h to the subset
    i = j;
  }
  return out;
}

export function calculateStandings(
  matches: GroupMatch[],
  teamIds: string[],
  scoreField: ScoreSource = "result",
): StandingRow[] {
  const table = accumulate(teamIds, matches, scoreField);
  const rows = teamIds.map((id) => table.get(id)!);

  // Rank by overall points; teams level on points are settled by FIFA tie-breakers.
  const byPoints = [...rows].sort((a, b) => b.points - a.points);
  const result: StandingRow[] = [];
  let i = 0;
  while (i < byPoints.length) {
    let j = i + 1;
    while (j < byPoints.length && byPoints[j].points === byPoints[i].points) j++;
    const tier = byPoints.slice(i, j);
    if (tier.length === 1) result.push(tier[0]);
    else result.push(...breakTie(tier, matches, scoreField));
    i = j;
  }
  return result;
}
