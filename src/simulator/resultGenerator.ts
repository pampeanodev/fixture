import type { Score } from "../types";
import { getRating } from "./ratings";
import { samplePoisson } from "./poisson";
import { simulatePenalties } from "./penalties";

/** Baseline expected goals per team in an evenly-matched World Cup game. */
const BASE_GOALS = 1.3;

function expectedGoals(attackRating: number, defenseRating: number): number {
  const delta = attackRating - defenseRating;
  return Math.max(0.1, BASE_GOALS * (1 + delta));
}

export function generateGroupResult(homeTeamId: string, awayTeamId: string): Score {
  const homeR = getRating(homeTeamId);
  const awayR = getRating(awayTeamId);
  return {
    home: samplePoisson(expectedGoals(homeR, awayR)),
    away: samplePoisson(expectedGoals(awayR, homeR)),
  };
}

export function generateKnockoutResult(homeTeamId: string, awayTeamId: string): Score {
  const base = generateGroupResult(homeTeamId, awayTeamId);
  if (base.home !== base.away) return base;
  return { ...base, penalties: simulatePenalties() };
}
