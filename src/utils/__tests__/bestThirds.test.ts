// src/utils/__tests__/bestThirds.test.ts
import { describe, it, expect } from "vitest";
import { rankThirdPlacedTeams, selectBestThirds } from "../bestThirds";
import type { StandingRow } from "../../types";

function makeThird(teamId: string, points: number, gd: number, gf: number): StandingRow {
  return {
    teamId, played: 3, won: points === 3 ? 1 : 0, drawn: points === 1 ? 1 : 0,
    lost: 0, goalsFor: gf, goalsAgainst: gf - gd, goalDifference: gd, points,
  };
}

describe("rankThirdPlacedTeams", () => {
  it("ranks thirds by points, then GD, then GF", () => {
    const thirds = [
      { group: "A", standing: makeThird("T1", 3, 1, 2) },
      { group: "B", standing: makeThird("T2", 4, 2, 3) },
      { group: "C", standing: makeThird("T3", 3, 1, 3) },
    ];
    const ranked = rankThirdPlacedTeams(thirds);
    expect(ranked[0].group).toBe("B");
    expect(ranked[1].group).toBe("C");
    expect(ranked[2].group).toBe("A");
  });
});

describe("selectBestThirds", () => {
  it("selects top 8 out of 12 thirds", () => {
    const thirds = "ABCDEFGHIJKL".split("").map((g, i) => ({
      group: g,
      standing: makeThird(`T${i}`, 6 - Math.floor(i / 2), i % 3, 5 - (i % 4)),
    }));
    const result = selectBestThirds(thirds);
    expect(result.qualifying).toHaveLength(8);
    expect(result.eliminated).toHaveLength(4);
  });
});
