import { describe, expect, it } from "vitest";
import { clinchedGroupPositions } from "../clinch";
import type { GroupMatch } from "../../types";

function m(id: string, home: string, away: string, h: number | null, a: number | null): GroupMatch {
  return {
    id, group: "A", homeTeamId: home, awayTeamId: away,
    dateUtc: "2026-06-11T19:00:00Z", venue: "Test",
    result: h !== null && a !== null ? { home: h, away: a } : null,
    prediction: null,
  };
}

describe("clinchedGroupPositions", () => {
  it("clinches 1st via head-to-head before the group is over (the México case)", () => {
    // A=MEX, B=KOR, C=CZE, D=RSA. A has 6 pts with one game left vs weak C.
    // Only B can reach 6 — but A already beat B, so A wins any points tie → 1st locked.
    const matches = [
      m("m1", "A", "D", 2, 0), // A beat D
      m("m2", "B", "C", 2, 1), // B beat C
      m("m3", "C", "D", 1, 1), // draw
      m("m4", "A", "B", 3, 2), // A beat B head-to-head
      m("m5", "C", "A", null, null), // remaining
      m("m6", "D", "B", null, null), // remaining
    ];
    const clinched = clinchedGroupPositions(matches, ["A", "B", "C", "D"]);
    expect(clinched[0]).toBe("A"); // 1st place locked
  });

  it("does not clinch a position that depends on goal difference", () => {
    // Two teams can tie on points with no head-to-head decider and only GD between
    // them — must stay unclinched (GD can swing with future scores).
    const matches = [
      m("m1", "A", "B", 1, 1), // A vs B drew (no h2h separation)
      m("m2", "A", "C", 5, 0),
      m("m3", "B", "C", 5, 0),
      m("m4", "A", "D", null, null),
      m("m5", "B", "D", null, null),
      m("m6", "C", "D", null, null),
    ];
    const clinched = clinchedGroupPositions(matches, ["A", "B", "C", "D"]);
    expect(clinched[0]).toBeNull(); // 1st could be A or B depending on GD
  });

  it("fills every position once results separate teams by points", () => {
    const matches = [
      m("m1", "A", "B", 1, 0),
      m("m2", "A", "C", 1, 0),
      m("m3", "A", "D", 1, 0),
      m("m4", "B", "C", 1, 0),
      m("m5", "B", "D", 1, 0),
      m("m6", "C", "D", 1, 0),
    ];
    // A 9, B 6, C 3, D 0 — fully separated by points.
    const clinched = clinchedGroupPositions(matches, ["A", "B", "C", "D"]);
    expect(clinched).toEqual(["A", "B", "C", "D"]);
  });
});
