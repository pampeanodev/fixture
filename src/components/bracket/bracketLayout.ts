import type { KnockoutRound } from "../../types";

export type Half = "left" | "right";

const LEFT_HALF: Record<KnockoutRound, readonly string[]> = {
  R32: ["R32-1", "R32-3", "R32-2", "R32-5", "R32-9", "R32-10", "R32-11", "R32-12"],
  R16: ["R16-1", "R16-2", "R16-5", "R16-6"],
  QF: ["QF-1", "QF-2"],
  SF: ["SF-1"],
  F: [],
  "3P": [],
};

const RIGHT_HALF: Record<KnockoutRound, readonly string[]> = {
  R32: ["R32-4", "R32-6", "R32-7", "R32-8", "R32-13", "R32-15", "R32-14", "R32-16"],
  R16: ["R16-3", "R16-4", "R16-7", "R16-8"],
  QF: ["QF-3", "QF-4"],
  SF: ["SF-2"],
  F: [],
  "3P": [],
};

export function matchIdsForHalf(half: Half, round: KnockoutRound): readonly string[] {
  return half === "left" ? LEFT_HALF[round] : RIGHT_HALF[round];
}

export const BRACKET_ROUNDS_BY_DEPTH: readonly KnockoutRound[] = ["R32", "R16", "QF", "SF"];
