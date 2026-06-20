// src/utils/clinch.ts
import type { GroupMatch, ScoreSource } from "../types";
import { effectiveScore } from "./effectiveScore";

type Outcome = "H" | "D" | "A";

interface PlayedOutcome {
  home: string;
  away: string;
  outcome: Outcome;
}

/**
 * Which finishing positions in a group are already mathematically locked, given
 * the real results so far. Returns an array indexed by position (0 = 1st place):
 * the locked team id, or null if that position can still change.
 *
 * Sound — never over-claims. It enumerates every win/draw/loss combination of the
 * remaining matches and only treats a team as separated from a rival when the gap
 * is decided by points or by *already-determined* head-to-head points — both
 * invariant to the unknown scores of the games left to play. Anything that would
 * come down to goal difference stays ambiguous (so a position decided only on GD
 * reads as not-yet-clinched, which is safe).
 *
 * For a fully-played group prefer `calculateStandings`: GD tie-breaks are real
 * there, whereas this function leaves GD-only ties unresolved by design.
 */
export function clinchedGroupPositions(
  matches: GroupMatch[],
  teamIds: string[],
  scoreField: ScoreSource = "result",
): (string | null)[] {
  const inGroup = new Set(teamIds);
  const basePts: Record<string, number> = {};
  teamIds.forEach((id) => (basePts[id] = 0));

  const played: PlayedOutcome[] = [];
  const remaining: { home: string; away: string }[] = [];
  for (const match of matches) {
    if (!inGroup.has(match.homeTeamId) || !inGroup.has(match.awayTeamId)) continue;
    const score = effectiveScore(match, scoreField);
    if (!score) {
      remaining.push({ home: match.homeTeamId, away: match.awayTeamId });
      continue;
    }
    const outcome: Outcome = score.home > score.away ? "H" : score.home < score.away ? "A" : "D";
    played.push({ home: match.homeTeamId, away: match.awayTeamId, outcome });
    addPoints(basePts, match.homeTeamId, match.awayTeamId, outcome);
  }

  const possible: Record<string, Set<number>> = {};
  teamIds.forEach((id) => (possible[id] = new Set()));

  const combos = 3 ** remaining.length;
  for (let mask = 0; mask < combos; mask++) {
    const pts = { ...basePts };
    const outcomes = [...played];
    let n = mask;
    for (const rm of remaining) {
      const outcome = (["H", "D", "A"] as Outcome[])[n % 3];
      n = Math.floor(n / 3);
      outcomes.push({ home: rm.home, away: rm.away, outcome });
      addPoints(pts, rm.home, rm.away, outcome);
    }
    recordPositions(teamIds, pts, outcomes, possible);
  }

  return buildResult(teamIds, possible);
}

function buildResult(teamIds: string[], possible: Record<string, Set<number>>): (string | null)[] {
  const result: (string | null)[] = teamIds.map(() => null);
  for (const id of teamIds) {
    const set = possible[id];
    if (set.size === 1) result[[...set][0] - 1] = id;
  }
  return result;
}

function addPoints(pts: Record<string, number>, home: string, away: string, outcome: Outcome): void {
  if (outcome === "H") pts[home] += 3;
  else if (outcome === "A") pts[away] += 3;
  else { pts[home] += 1; pts[away] += 1; }
}

// For one win/draw/loss scenario, record each team's possible finishing
// position(s): a fixed position when separated by points or head-to-head points,
// or a range when only goal difference would break the tie.
function recordPositions(
  teamIds: string[],
  pts: Record<string, number>,
  outcomes: PlayedOutcome[],
  possible: Record<string, Set<number>>,
): void {
  const byPoints = [...teamIds].sort((a, b) => pts[b] - pts[a]);
  let cursor = 1;
  let i = 0;
  while (i < byPoints.length) {
    let j = i + 1;
    while (j < byPoints.length && pts[byPoints[j]] === pts[byPoints[i]]) j++;
    const tier = byPoints.slice(i, j);
    if (tier.length === 1) {
      possible[tier[0]].add(cursor);
    } else {
      const h2h = headToHeadPoints(tier, outcomes);
      const sub = [...tier].sort((a, b) => h2h[b] - h2h[a]);
      let subCursor = cursor;
      let a = 0;
      while (a < sub.length) {
        let b = a + 1;
        while (b < sub.length && h2h[sub[b]] === h2h[sub[a]]) b++;
        const block = sub.slice(a, b);
        // Block still level on head-to-head points → only GD could separate → ambiguous.
        for (const t of block) {
          for (let p = subCursor; p < subCursor + block.length; p++) possible[t].add(p);
        }
        subCursor += block.length;
        a = b;
      }
    }
    cursor += tier.length;
    i = j;
  }
}

function headToHeadPoints(tier: string[], outcomes: PlayedOutcome[]): Record<string, number> {
  const set = new Set(tier);
  const pts: Record<string, number> = {};
  tier.forEach((t) => (pts[t] = 0));
  for (const o of outcomes) {
    if (!set.has(o.home) || !set.has(o.away)) continue;
    addPoints(pts, o.home, o.away, o.outcome);
  }
  return pts;
}
