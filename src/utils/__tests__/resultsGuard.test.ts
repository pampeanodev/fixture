import { describe, it, expect } from "vitest";
import { hasKickedOff, stripPrematureResults } from "../resultsGuard";

// G-A-1 kicks off 2026-06-11T19:00:00Z per src/data/groupMatches.ts
const KICKOFF_GA1 = Date.UTC(2026, 5, 11, 19, 0, 0);

describe("hasKickedOff", () => {
  it("is false before kickoff", () => {
    expect(hasKickedOff("G-A-1", KICKOFF_GA1 - 1)).toBe(false);
  });

  it("is true from kickoff onward", () => {
    expect(hasKickedOff("G-A-1", KICKOFF_GA1)).toBe(true);
    expect(hasKickedOff("G-A-1", KICKOFF_GA1 + 1)).toBe(true);
  });

  it("is false for unknown match ids", () => {
    expect(hasKickedOff("G-Z-99", KICKOFF_GA1 + 1)).toBe(false);
  });
});

describe("stripPrematureResults", () => {
  it("drops results for matches that have not kicked off", () => {
    // G-A-2 kicks off 2026-06-12T02:00:00Z — later than G-A-1.
    const results = {
      "G-A-1": { home: 2, away: 0 },
      "G-A-2": { home: 0, away: 0 },
    };
    expect(stripPrematureResults(results, KICKOFF_GA1 + 1)).toEqual({
      "G-A-1": { home: 2, away: 0 },
    });
  });

  it("keeps everything once all matches started", () => {
    const results = { "G-A-1": { home: 2, away: 0 }, "G-A-2": { home: 2, away: 1 } };
    const lateNow = Date.UTC(2026, 6, 1);
    expect(stripPrematureResults(results, lateNow)).toEqual(results);
  });

  it("drops unknown match ids entirely", () => {
    const results = { "BOGUS-1": { home: 1, away: 1 } };
    expect(stripPrematureResults(results, Date.UTC(2026, 6, 1))).toEqual({});
  });
});
