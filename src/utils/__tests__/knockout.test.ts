// src/utils/__tests__/knockout.test.ts
import { describe, it, expect } from "vitest";
import { resolveKnockoutTeams } from "../knockout";
import type { KnockoutMatch, StandingRow } from "../../types";

function makeStandings(teamIds: string[]): StandingRow[] {
  return teamIds.map((id, i) => ({
    teamId: id, played: 3, won: 3 - i, drawn: 0, lost: i,
    goalsFor: 6 - i, goalsAgainst: i, goalDifference: 6 - 2 * i, points: (3 - i) * 3,
  }));
}

describe("resolveKnockoutTeams", () => {
  it("resolves group position slots from standings", () => {
    const match: KnockoutMatch = {
      id: "R32-1", round: "R32",
      homeSlot: { type: "group", group: "A", position: 1 },
      awaySlot: { type: "group", group: "A", position: 2 },
      homeTeamId: null, awayTeamId: null,
      dateUtc: "", venue: "", result: null, prediction: null,
    };
    const standingsByGroup = { A: makeStandings(["MEX", "RSA", "KOR", "CZE"]) };
    const resolved = resolveKnockoutTeams([match], standingsByGroup, {}, []);
    expect(resolved[0].homeTeamId).toBe("MEX");
    expect(resolved[0].awayTeamId).toBe("RSA");
  });

  it("resolves winner slots from previous match results", () => {
    const r32: KnockoutMatch = {
      id: "R32-1", round: "R32",
      homeSlot: { type: "group", group: "A", position: 1 },
      awaySlot: { type: "group", group: "A", position: 2 },
      homeTeamId: "MEX", awayTeamId: "RSA",
      dateUtc: "", venue: "",
      result: { home: 2, away: 1 }, prediction: null,
    };
    const r16: KnockoutMatch = {
      id: "R16-1", round: "R16",
      homeSlot: { type: "winner", matchId: "R32-1" },
      awaySlot: { type: "winner", matchId: "R32-1" },
      homeTeamId: null, awayTeamId: null,
      dateUtc: "", venue: "", result: null, prediction: null,
    };
    const resolved = resolveKnockoutTeams([r32, r16], {}, {}, []);
    expect(resolved.find((m) => m.id === "R16-1")!.homeTeamId).toBe("MEX");
  });

  it("resolves loser slots for third-place match", () => {
    const sf: KnockoutMatch = {
      id: "SF-1", round: "SF",
      homeSlot: { type: "winner", matchId: "QF-1" },
      awaySlot: { type: "winner", matchId: "QF-2" },
      homeTeamId: "ARG", awayTeamId: "BRA",
      dateUtc: "", venue: "",
      result: { home: 3, away: 1 }, prediction: null,
    };
    const tp: KnockoutMatch = {
      id: "3P", round: "3P",
      homeSlot: { type: "loser", matchId: "SF-1" },
      awaySlot: { type: "loser", matchId: "SF-1" },
      homeTeamId: null, awayTeamId: null,
      dateUtc: "", venue: "", result: null, prediction: null,
    };
    const resolved = resolveKnockoutTeams([sf, tp], {}, {}, []);
    expect(resolved.find((m) => m.id === "3P")!.homeTeamId).toBe("BRA");
  });

  it("clears results when resolved team changes", () => {
    const r32: KnockoutMatch = {
      id: "R32-1", round: "R32",
      homeSlot: { type: "group", group: "A", position: 1 },
      awaySlot: { type: "group", group: "B", position: 1 },
      homeTeamId: "MEX", awayTeamId: "CAN",
      dateUtc: "", venue: "",
      result: { home: 1, away: 0 }, prediction: null,
    };
    const standingsByGroup = {
      A: makeStandings(["RSA", "MEX", "KOR", "CZE"]),
      B: makeStandings(["CAN", "SUI", "QAT", "BIH"]),
    };
    const resolved = resolveKnockoutTeams([r32], standingsByGroup, {}, []);
    expect(resolved[0].homeTeamId).toBe("RSA");
    expect(resolved[0].result).toBeNull();
  });
});
