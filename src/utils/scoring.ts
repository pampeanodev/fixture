import type { Score, GroupMatch, KnockoutMatch, Rival, FixtureState } from "../types";

function getPenWinner(score: Score): "home" | "away" | null {
  if (!score.penalties) return null;
  if (score.penalties.home > score.penalties.away) return "home";
  if (score.penalties.away > score.penalties.home) return "away";
  return null;
}

/**
 * Knockout pen-shootout bonus: +1 if BOTH real and prediction ended in a draw
 * AND both have a pen winner AND those winners match. Used only for knockouts
 * (group matches never have penalties).
 */
export function getPenBonus(result: Score | null, prediction: Score | null): 0 | 1 {
  if (!result || !prediction) return 0;
  if (result.home !== result.away) return 0;
  if (prediction.home !== prediction.away) return 0;
  const realWinner = getPenWinner(result);
  const predWinner = getPenWinner(prediction);
  if (!realWinner || !predWinner) return 0;
  return realWinner === predWinner ? 1 : 0;
}

/**
 * Score a single prediction against the real result.
 * Base: 3 = exact score, 1 = correct outcome, 0 = wrong or missing.
 * Plus +1 pen bonus when getPenBonus applies (knockout draw with correct pen winner).
 */
export function scoreMatch(result: Score | null, prediction: Score | null): number {
  if (!result || !prediction) return 0;
  let points = 0;
  if (result.home === prediction.home && result.away === prediction.away) points = 3;
  else if (Math.sign(result.home - result.away) === Math.sign(prediction.home - prediction.away)) points = 1;
  return points + getPenBonus(result, prediction);
}

/**
 * Calculate total score for a player's predictions against real results.
 * Invariant: total = 3*exact + 1*winner + penBonus,
 *            exact + winner + wrong + pending = matches.length.
 */
export function calculatePlayerScore(
  groupMatches: GroupMatch[],
  knockoutMatches: KnockoutMatch[],
  predictions: { group: Record<string, Score>; knockout: Record<string, Score> }
): { total: number; exact: number; winner: number; wrong: number; penBonus: number; pending: number } {
  let total = 0;
  let exact = 0;
  let winner = 0;
  let wrong = 0;
  let penBonus = 0;
  let pending = 0;

  function tally(result: Score | null, prediction: Score | null): void {
    if (!result) { pending++; return; }
    if (!prediction) { wrong++; return; }
    const points = scoreMatch(result, prediction);
    const bonus = getPenBonus(result, prediction);
    const base = points - bonus;
    total += points;
    penBonus += bonus;
    if (base === 3) exact++;
    else if (base === 1) winner++;
    else wrong++;
  }

  for (const match of groupMatches) {
    tally(match.result, predictions.group[match.id] ?? null);
  }
  for (const match of knockoutMatches) {
    tally(match.result, predictions.knockout[match.id] ?? null);
  }

  return { total, exact, winner, wrong, penBonus, pending };
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

export interface RankedPlayer {
  name: string;
  isLocal: boolean;
  total: number;
  exact: number;
  winner: number;
  wrong: number;
  penBonus: number;
  pending: number;
}

export function computeRanking(state: FixtureState, localNameFallback = "Yo"): RankedPlayer[] {
  const players: RankedPlayer[] = [];

  const localName = state.playerName.trim() || localNameFallback;
  const localPreds = extractLocalPredictions(state.groupMatches, state.knockoutMatches);
  const localScore = calculatePlayerScore(state.groupMatches, state.knockoutMatches, localPreds);
  players.push({ name: localName, isLocal: true, ...localScore });

  for (const rival of state.rivals) {
    const rivalPreds = extractRivalPredictions(rival);
    const rivalScore = calculatePlayerScore(state.groupMatches, state.knockoutMatches, rivalPreds);
    players.push({ name: rival.name, isLocal: false, ...rivalScore });
  }

  players.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.exact !== a.exact) return b.exact - a.exact;
    return b.winner - a.winner;
  });

  return players;
}
