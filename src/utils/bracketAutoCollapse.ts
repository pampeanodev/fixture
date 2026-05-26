import type { KnockoutMatch, KnockoutRound } from "../types";

export type ScoringMode = "predictions" | "actual";

const F_COLUMN_ROUNDS: readonly KnockoutRound[] = ["F", "3P"];

export function computeAutoCollapsedRounds(
  matches: readonly KnockoutMatch[],
  mode: ScoringMode,
): Set<KnockoutRound> {
  const field = mode === "predictions" ? "prediction" : "result";
  const byRound = new Map<KnockoutRound, KnockoutMatch[]>();
  for (const m of matches) {
    const list = byRound.get(m.round);
    if (list) list.push(m);
    else byRound.set(m.round, [m]);
  }

  const result = new Set<KnockoutRound>();

  for (const [round, list] of byRound) {
    if (F_COLUMN_ROUNDS.includes(round)) continue;
    if (list.length > 0 && list.every((m) => m[field] !== null)) {
      result.add(round);
    }
  }

  const fMatches = [...(byRound.get("F") ?? []), ...(byRound.get("3P") ?? [])];
  if (fMatches.length > 0 && fMatches.every((m) => m[field] !== null)) {
    result.add("F");
    result.add("3P");
  }

  return result;
}
