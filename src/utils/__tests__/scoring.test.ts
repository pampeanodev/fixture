import { describe, it, expect } from "vitest";
import { scoreMatch, getPenBonus, calculatePlayerScore, indicatorFor, indicatorForPoints } from "../scoring";
import type { Score, GroupMatch, KnockoutMatch } from "../../types";

describe("indicatorFor", () => {
  it("returns +3 exact for an exact score", () => {
    expect(indicatorFor({ home: 2, away: 1 }, { home: 2, away: 1 })).toEqual({
      kind: "exact",
      label: "+3",
    });
  });

  it("returns +1 winner for correct outcome with wrong score", () => {
    expect(indicatorFor({ home: 3, away: 1 }, { home: 2, away: 0 })).toEqual({
      kind: "winner",
      label: "+1",
    });
  });

  it("returns 0 wrong for a missed outcome", () => {
    expect(indicatorFor({ home: 1, away: 2 }, { home: 2, away: 1 })).toEqual({
      kind: "wrong",
      label: "0",
    });
  });

  it("includes the pen bonus in the label: exact draw + correct pen winner = +4", () => {
    const result: Score = { home: 1, away: 1, penalties: { home: 4, away: 3 } };
    const prediction: Score = { home: 1, away: 1, penalties: { home: 1, away: 0 } };
    expect(indicatorFor(result, prediction)).toEqual({ kind: "exact", label: "+4" });
  });

  it("includes the pen bonus in the label: outcome draw + correct pen winner = +2", () => {
    const result: Score = { home: 1, away: 1, penalties: { home: 4, away: 3 } };
    const prediction: Score = { home: 2, away: 2, penalties: { home: 1, away: 0 } };
    expect(indicatorFor(result, prediction)).toEqual({ kind: "winner", label: "+2" });
  });

  it("returns null when result or prediction is missing", () => {
    expect(indicatorFor(null, { home: 1, away: 1 })).toBeNull();
    expect(indicatorFor({ home: 1, away: 1 }, null)).toBeNull();
  });
});

describe("indicatorForPoints", () => {
  it("maps every possible point total to kind + label", () => {
    expect(indicatorForPoints(4)).toEqual({ kind: "exact", label: "+4" });
    expect(indicatorForPoints(3)).toEqual({ kind: "exact", label: "+3" });
    expect(indicatorForPoints(2)).toEqual({ kind: "winner", label: "+2" });
    expect(indicatorForPoints(1)).toEqual({ kind: "winner", label: "+1" });
    expect(indicatorForPoints(0)).toEqual({ kind: "wrong", label: "0" });
  });
});

describe("scoreMatch", () => {
  it("returns 3 for exact match", () => {
    expect(scoreMatch({ home: 2, away: 1 }, { home: 2, away: 1 })).toBe(3);
  });

  it("returns 1 for correct outcome but wrong score", () => {
    expect(scoreMatch({ home: 3, away: 1 }, { home: 2, away: 0 })).toBe(1);
  });

  it("returns 1 for correct draw outcome but wrong score", () => {
    expect(scoreMatch({ home: 1, away: 1 }, { home: 2, away: 2 })).toBe(1);
  });

  it("returns 0 for wrong outcome", () => {
    expect(scoreMatch({ home: 1, away: 2 }, { home: 2, away: 1 })).toBe(0);
  });

  it("returns 0 when result is missing", () => {
    expect(scoreMatch(null, { home: 1, away: 1 })).toBe(0);
  });

  it("returns 0 when prediction is missing", () => {
    expect(scoreMatch({ home: 1, away: 1 }, null)).toBe(0);
  });

  it("adds +1 pen bonus to exact draw when pen winner matches", () => {
    const result: Score = { home: 1, away: 1, penalties: { home: 4, away: 3 } };
    const prediction: Score = { home: 1, away: 1, penalties: { home: 1, away: 0 } };
    expect(scoreMatch(result, prediction)).toBe(4);
  });

  it("adds +1 pen bonus to outcome-only draw when pen winner matches", () => {
    const result: Score = { home: 1, away: 1, penalties: { home: 4, away: 3 } };
    const prediction: Score = { home: 2, away: 2, penalties: { home: 1, away: 0 } };
    expect(scoreMatch(result, prediction)).toBe(2);
  });

  it("no pen bonus when pen winner does not match", () => {
    const result: Score = { home: 1, away: 1, penalties: { home: 4, away: 3 } };
    const prediction: Score = { home: 1, away: 1, penalties: { home: 0, away: 1 } };
    expect(scoreMatch(result, prediction)).toBe(3);
  });

  it("no pen bonus when prediction did not pick a pen winner", () => {
    const result: Score = { home: 1, away: 1, penalties: { home: 4, away: 3 } };
    const prediction: Score = { home: 1, away: 1 };
    expect(scoreMatch(result, prediction)).toBe(3);
  });

  it("no pen bonus when real match did not go to pens", () => {
    const result: Score = { home: 2, away: 1 };
    const prediction: Score = { home: 1, away: 1, penalties: { home: 1, away: 0 } };
    expect(scoreMatch(result, prediction)).toBe(0);
  });

  it("no pen bonus when prediction was not a draw", () => {
    const result: Score = { home: 1, away: 1, penalties: { home: 4, away: 3 } };
    const prediction: Score = { home: 2, away: 1, penalties: { home: 1, away: 0 } };
    expect(scoreMatch(result, prediction)).toBe(0);
  });
});

describe("getPenBonus", () => {
  it("returns 1 only when both draws and pen winners match", () => {
    const result: Score = { home: 1, away: 1, penalties: { home: 4, away: 3 } };
    const prediction: Score = { home: 2, away: 2, penalties: { home: 1, away: 0 } };
    expect(getPenBonus(result, prediction)).toBe(1);
  });

  it("returns 0 when prediction has tied pen scores", () => {
    const result: Score = { home: 1, away: 1, penalties: { home: 4, away: 3 } };
    const prediction: Score = { home: 1, away: 1, penalties: { home: 1, away: 1 } };
    expect(getPenBonus(result, prediction)).toBe(0);
  });
});

function makeGroupMatch(id: string, result: Score | null): GroupMatch {
  return {
    id, group: "A", homeTeamId: "MEX", awayTeamId: "RSA",
    dateUtc: "", venue: "", result, prediction: null,
  };
}

function makeKnockoutMatch(id: string, result: Score | null): KnockoutMatch {
  return {
    id, round: "R32",
    homeSlot: { type: "group", group: "A", position: 1 },
    awaySlot: { type: "group", group: "B", position: 2 },
    homeTeamId: "MEX", awayTeamId: "RSA",
    dateUtc: "", venue: "", result, prediction: null,
  };
}

describe("calculatePlayerScore", () => {
  it("aggregates exact, winner, wrong, penBonus and pending", () => {
    const groupMatches = [
      makeGroupMatch("G1", { home: 2, away: 1 }),
      makeGroupMatch("G2", { home: 1, away: 0 }),
      makeGroupMatch("G3", null),
    ];
    const knockoutMatches = [
      makeKnockoutMatch("K1", { home: 1, away: 1, penalties: { home: 4, away: 3 } }),
      makeKnockoutMatch("K2", { home: 2, away: 0 }),
    ];
    const predictions = {
      group: {
        G1: { home: 2, away: 1 },
        G2: { home: 3, away: 1 },
      },
      knockout: {
        K1: { home: 1, away: 1, penalties: { home: 1, away: 0 } },
        K2: { home: 0, away: 2 },
      },
    };
    const stats = calculatePlayerScore(groupMatches, knockoutMatches, predictions);
    expect(stats).toEqual({ total: 3 + 1 + 4 + 0, exact: 2, winner: 1, wrong: 1, penBonus: 1, pending: 1 });
  });

  it("invariant: total === 3*exact + winner + penBonus", () => {
    const groupMatches = [
      makeGroupMatch("G1", { home: 1, away: 0 }),
      makeGroupMatch("G2", { home: 2, away: 2 }),
    ];
    const knockoutMatches = [
      makeKnockoutMatch("K1", { home: 0, away: 0, penalties: { home: 5, away: 4 } }),
    ];
    const predictions = {
      group: {
        G1: { home: 1, away: 0 },
        G2: { home: 1, away: 1 },
      },
      knockout: {
        K1: { home: 0, away: 0, penalties: { home: 1, away: 0 } },
      },
    };
    const s = calculatePlayerScore(groupMatches, knockoutMatches, predictions);
    expect(s.total).toBe(3 * s.exact + s.winner + s.penBonus);
  });
});
