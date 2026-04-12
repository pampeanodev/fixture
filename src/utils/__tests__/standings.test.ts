// src/utils/__tests__/standings.test.ts
import { describe, it, expect } from "vitest";
import { calculateStandings } from "../standings";
import type { GroupMatch } from "../../types";

function makeMatch(
  id: string,
  group: string,
  home: string,
  away: string,
  homeGoals: number | null,
  awayGoals: number | null
): GroupMatch {
  return {
    id, group, homeTeamId: home, awayTeamId: away,
    dateUtc: "2026-06-11T19:00:00Z", venue: "Test Stadium",
    result: homeGoals !== null && awayGoals !== null ? { home: homeGoals, away: awayGoals } : null,
    prediction: null,
  };
}

describe("calculateStandings", () => {
  it("returns empty standings for teams with no results", () => {
    const matches = [makeMatch("1", "A", "T1", "T2", null, null)];
    const standings = calculateStandings(matches, ["T1", "T2"]);
    expect(standings).toHaveLength(2);
    expect(standings[0].points).toBe(0);
    expect(standings[0].played).toBe(0);
  });

  it("awards 3 points for a win, 0 for a loss", () => {
    const matches = [makeMatch("1", "A", "T1", "T2", 2, 0)];
    const standings = calculateStandings(matches, ["T1", "T2"]);
    const t1 = standings.find((s) => s.teamId === "T1")!;
    const t2 = standings.find((s) => s.teamId === "T2")!;
    expect(t1.points).toBe(3);
    expect(t1.won).toBe(1);
    expect(t1.goalsFor).toBe(2);
    expect(t1.goalDifference).toBe(2);
    expect(t2.points).toBe(0);
    expect(t2.lost).toBe(1);
  });

  it("awards 1 point each for a draw", () => {
    const matches = [makeMatch("1", "A", "T1", "T2", 1, 1)];
    const standings = calculateStandings(matches, ["T1", "T2"]);
    expect(standings.find((s) => s.teamId === "T1")!.points).toBe(1);
    expect(standings.find((s) => s.teamId === "T2")!.points).toBe(1);
  });

  it("sorts by points, then goal difference, then goals scored", () => {
    const matches = [
      makeMatch("1", "A", "T1", "T2", 3, 0),
      makeMatch("2", "A", "T3", "T4", 2, 0),
      makeMatch("3", "A", "T1", "T3", 1, 1),
      makeMatch("4", "A", "T2", "T4", 0, 0),
    ];
    const standings = calculateStandings(matches, ["T1", "T2", "T3", "T4"]);
    expect(standings[0].teamId).toBe("T1");
    expect(standings[1].teamId).toBe("T3");
    expect(standings[2].teamId).toBe("T4");
    expect(standings[3].teamId).toBe("T2");
  });

  it("uses prediction scores when scoreField is prediction", () => {
    const matches: GroupMatch[] = [{
      id: "1", group: "A", homeTeamId: "T1", awayTeamId: "T2",
      dateUtc: "2026-06-11T19:00:00Z", venue: "Test",
      result: null,
      prediction: { home: 1, away: 0 },
    }];
    const standings = calculateStandings(matches, ["T1", "T2"], "prediction");
    expect(standings.find((s) => s.teamId === "T1")!.points).toBe(3);
  });
});
