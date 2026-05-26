import { describe, it, expect } from "vitest";
import { computeAutoCollapsedRounds } from "../bracketAutoCollapse";
import type { KnockoutMatch } from "../../types";

function mkMatch(id: string, round: KnockoutMatch["round"], result: { home: number; away: number } | null, prediction: { home: number; away: number } | null): KnockoutMatch {
  return {
    id, round,
    homeTeamId: null, awayTeamId: null,
    homeSlot: { type: "group", group: "A", position: 1 },
    awaySlot: { type: "group", group: "A", position: 2 },
    dateUtc: "2026-06-12T19:00:00.000Z", venue: "X",
    result, prediction,
  };
}

describe("computeAutoCollapsedRounds", () => {
  it("returns empty set when no matches have a score", () => {
    const matches = [mkMatch("R32-1", "R32", null, null), mkMatch("R16-1", "R16", null, null)];
    const collapsed = computeAutoCollapsedRounds(matches, "actual");
    expect(collapsed).toEqual(new Set());
  });

  it("collapses a round when all its matches have results (actual mode)", () => {
    const matches = [
      mkMatch("R32-1", "R32", { home: 1, away: 0 }, null),
      mkMatch("R32-2", "R32", { home: 2, away: 1 }, null),
      mkMatch("R16-1", "R16", null, null),
    ];
    const collapsed = computeAutoCollapsedRounds(matches, "actual");
    expect(collapsed.has("R32")).toBe(true);
    expect(collapsed.has("R16")).toBe(false);
  });

  it("uses prediction field in predictions mode", () => {
    const matches = [
      mkMatch("R32-1", "R32", null, { home: 1, away: 0 }),
      mkMatch("R32-2", "R32", null, { home: 2, away: 1 }),
    ];
    const collapsedActual = computeAutoCollapsedRounds(matches, "actual");
    const collapsedPred = computeAutoCollapsedRounds(matches, "predictions");
    expect(collapsedActual.has("R32")).toBe(false);
    expect(collapsedPred.has("R32")).toBe(true);
  });

  it("treats F+3P as one column: F collapses only when both have scores", () => {
    const matches = [
      mkMatch("F-1", "F", { home: 2, away: 1 }, null),
      mkMatch("3P-1", "3P", null, null),
    ];
    const collapsed = computeAutoCollapsedRounds(matches, "actual");
    expect(collapsed.has("F")).toBe(false);
    expect(collapsed.has("3P")).toBe(false);

    const matchesBoth = [
      mkMatch("F-1", "F", { home: 2, away: 1 }, null),
      mkMatch("3P-1", "3P", { home: 0, away: 0 }, null),
    ];
    const collapsedBoth = computeAutoCollapsedRounds(matchesBoth, "actual");
    expect(collapsedBoth.has("F")).toBe(true);
    expect(collapsedBoth.has("3P")).toBe(true);
  });

  it("returns empty set when a round has no matches", () => {
    const collapsed = computeAutoCollapsedRounds([], "actual");
    expect(collapsed).toEqual(new Set());
  });
});
