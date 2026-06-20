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

  it("ranks the head-to-head winner above a team with better overall GD (FIFA 2026)", () => {
    // T1 and T2 both finish on 6 pts. T2 has the better OVERALL goal difference
    // (+3 vs +1), but T1 won the direct match — so FIFA 2026 ranks T1 first.
    const matches = [
      makeMatch("1", "A", "T1", "T2", 1, 0), // T1 beats T2 head-to-head
      makeMatch("2", "A", "T3", "T1", 1, 0), // T1 loses to T3
      makeMatch("3", "A", "T1", "T4", 1, 0), // T1 beats T4
      makeMatch("4", "A", "T2", "T3", 3, 0), // T2 thumps T3 (pads GD)
      makeMatch("5", "A", "T2", "T4", 1, 0), // T2 beats T4
      makeMatch("6", "A", "T4", "T3", 1, 0), // T4 beats T3
    ];
    const standings = calculateStandings(matches, ["T1", "T2", "T3", "T4"]);
    expect(standings[0].teamId).toBe("T1"); // head-to-head winner first
    expect(standings[1].teamId).toBe("T2");
  });

  it("breaks a 3-way tie via the head-to-head mini-table", () => {
    // T1, T2, T3 all finish on 6 pts (each beat T4, results among them form a
    // cycle broken by mini-table goal difference). T4 loses everything.
    const matches = [
      makeMatch("1", "A", "T1", "T2", 1, 0), // T1>T2
      makeMatch("2", "A", "T2", "T3", 1, 0), // T2>T3
      makeMatch("3", "A", "T3", "T1", 1, 0), // T3>T1  (cycle, all 1-0)
      makeMatch("4", "A", "T1", "T4", 5, 0),
      makeMatch("5", "A", "T2", "T4", 1, 0),
      makeMatch("6", "A", "T3", "T4", 1, 0),
    ];
    const standings = calculateStandings(matches, ["T1", "T2", "T3", "T4"]);
    // Among T1/T2/T3 the mini-table is all 3 pts / GD 0 / 1 GF — a perfect tie,
    // so it falls to OVERALL GD: T1 (+4 from the 5-0) leads, then T2/T3, T4 last.
    expect(standings[0].teamId).toBe("T1");
    expect(standings[3].teamId).toBe("T4");
  });

  it("hybrid uses real results where they exist and predictions where they don't", () => {
    const matches: GroupMatch[] = [
      // Played: real result T1 beats T2.
      { id: "1", group: "A", homeTeamId: "T1", awayTeamId: "T2",
        dateUtc: "2026-06-11T19:00:00Z", venue: "Test",
        result: { home: 2, away: 0 }, prediction: { home: 0, away: 3 } },
      // Not played yet: only a prediction (T1 beats T3).
      { id: "2", group: "A", homeTeamId: "T1", awayTeamId: "T3",
        dateUtc: "2026-06-15T19:00:00Z", venue: "Test",
        result: null, prediction: { home: 1, away: 0 } },
    ];
    const standings = calculateStandings(matches, ["T1", "T2", "T3"], "hybrid");
    const t1 = standings.find((s) => s.teamId === "T1")!;
    // Real win (match 1) + projected win (match 2) = 6 points, ignoring the
    // overridden prediction on the already-played match.
    expect(t1.points).toBe(6);
    expect(t1.played).toBe(2);
    expect(standings.find((s) => s.teamId === "T2")!.points).toBe(0);
  });
});
