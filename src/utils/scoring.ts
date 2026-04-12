import type { Score, GroupMatch, KnockoutMatch, Rival } from "../types";

/**
 * Score a single prediction against the real result.
 * 3 = exact score, 1 = correct outcome, 0 = wrong or missing.
 */
export function scoreMatch(result: Score | null, prediction: Score | null): number {
  if (!result || !prediction) return 0;
  if (result.home === prediction.home && result.away === prediction.away) return 3;
  if (Math.sign(result.home - result.away) === Math.sign(prediction.home - prediction.away)) return 1;
  return 0;
}

/**
 * Calculate total score for a player's predictions against real results.
 */
export function calculatePlayerScore(
  groupMatches: GroupMatch[],
  knockoutMatches: KnockoutMatch[],
  predictions: { group: Record<string, Score>; knockout: Record<string, Score> }
): { total: number; exact: number; winner: number; wrong: number; pending: number } {
  let total = 0;
  let exact = 0;
  let winner = 0;
  let wrong = 0;
  let pending = 0;

  for (const match of groupMatches) {
    const prediction = predictions.group[match.id] ?? null;
    const result = match.result;
    if (!result) { pending++; continue; }
    if (!prediction) { wrong++; continue; }

    const points = scoreMatch(result, prediction);
    total += points;
    if (points === 3) exact++;
    else if (points === 1) winner++;
    else wrong++;
  }

  for (const match of knockoutMatches) {
    const prediction = predictions.knockout[match.id] ?? null;
    const result = match.result;
    if (!result) { pending++; continue; }
    if (!prediction) { wrong++; continue; }

    const points = scoreMatch(result, prediction);
    total += points;
    if (points === 3) exact++;
    else if (points === 1) winner++;
    else wrong++;
  }

  return { total, exact, winner, wrong, pending };
}

/**
 * Build the predictions map for the local player (from their GroupMatch/KnockoutMatch prediction fields).
 */
export function extractLocalPredictions(
  groupMatches: GroupMatch[],
  knockoutMatches: KnockoutMatch[]
): { group: Record<string, Score>; knockout: Record<string, Score> } {
  const group: Record<string, Score> = {};
  const knockout: Record<string, Score> = {};

  for (const m of groupMatches) {
    if (m.prediction) group[m.id] = m.prediction;
  }
  for (const m of knockoutMatches) {
    if (m.prediction) knockout[m.id] = m.prediction;
  }

  return { group, knockout };
}

/**
 * Build the predictions map for a rival (from their imported Rival data).
 */
export function extractRivalPredictions(
  rival: Rival
): { group: Record<string, Score>; knockout: Record<string, Score> } {
  return {
    group: rival.groupPredictions,
    knockout: rival.knockoutPredictions,
  };
}
