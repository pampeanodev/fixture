import { describe, it, expect } from "vitest";
import { nextPendingMatch } from "../matchOrder";
import type { GroupMatch, KnockoutMatch } from "../../types";

function makeGroupMatch(id: string, dateUtc: string, result: GroupMatch["result"] = null): GroupMatch {
  return {
    id, group: "A", homeTeamId: "ARG", awayTeamId: "MAR",
    dateUtc, venue: "Test", result, prediction: null,
  };
}

function makeKnockoutMatch(
  id: string, dateUtc: string,
  opts: Partial<Pick<KnockoutMatch, "homeTeamId" | "awayTeamId" | "result">> = {},
): KnockoutMatch {
  return {
    id, round: "R32",
    homeSlot: { type: "group", group: "A", position: 1 },
    awaySlot: { type: "group", group: "B", position: 2 },
    homeTeamId: "homeTeamId" in opts ? opts.homeTeamId ?? null : "ARG",
    awayTeamId: "awayTeamId" in opts ? opts.awayTeamId ?? null : "FRA",
    dateUtc, venue: "Test",
    result: opts.result ?? null,
    prediction: null,
  };
}

describe("nextPendingMatch", () => {
  it("returns the chronologically earliest pending group match", () => {
    const groups = [
      makeGroupMatch("G2", "2026-06-12T18:00:00Z"),
      makeGroupMatch("G1", "2026-06-11T18:00:00Z"),
      makeGroupMatch("G3", "2026-06-13T18:00:00Z"),
    ];
    const result = nextPendingMatch(groups, [], new Set());
    expect(result?.kind).toBe("group");
    expect(result?.match.id).toBe("G1");
  });

  it("skips matches that already have a result", () => {
    const groups = [
      makeGroupMatch("G1", "2026-06-11T18:00:00Z", { home: 2, away: 1 }),
      makeGroupMatch("G2", "2026-06-12T18:00:00Z"),
    ];
    const result = nextPendingMatch(groups, [], new Set());
    expect(result?.match.id).toBe("G2");
  });

  it("returns null when nothing is pending", () => {
    const groups = [
      makeGroupMatch("G1", "2026-06-11T18:00:00Z", { home: 2, away: 1 }),
    ];
    expect(nextPendingMatch(groups, [], new Set())).toBeNull();
  });

  it("includes knockout matches only when both team IDs are resolved", () => {
    const groups: GroupMatch[] = [];
    const knockouts = [
      makeKnockoutMatch("K1", "2026-07-01T18:00:00Z", { homeTeamId: null }),
      makeKnockoutMatch("K2", "2026-07-02T18:00:00Z"),
    ];
    const result = nextPendingMatch(groups, knockouts, new Set());
    expect(result?.kind).toBe("knockout");
    expect(result?.match.id).toBe("K2");
  });

  it("interleaves group and knockout matches by date", () => {
    const groups = [makeGroupMatch("G1", "2026-07-05T18:00:00Z")];
    const knockouts = [makeKnockoutMatch("K1", "2026-07-01T18:00:00Z")];
    const result = nextPendingMatch(groups, knockouts, new Set());
    expect(result?.match.id).toBe("K1");
  });

  it("respects the skippedMatches set", () => {
    const groups = [
      makeGroupMatch("G1", "2026-06-11T18:00:00Z"),
      makeGroupMatch("G2", "2026-06-12T18:00:00Z"),
    ];
    const result = nextPendingMatch(groups, [], new Set(["G1"]));
    expect(result?.match.id).toBe("G2");
  });
});
