import { describe, it, expect } from "vitest";
import { generateGroupResult, generateKnockoutResult } from "../resultGenerator";

describe("generateGroupResult", () => {
  it("returns non-negative integer scores", () => {
    for (let i = 0; i < 100; i++) {
      const { home, away } = generateGroupResult("ARG", "MAR");
      expect(Number.isInteger(home)).toBe(true);
      expect(Number.isInteger(away)).toBe(true);
      expect(home).toBeGreaterThanOrEqual(0);
      expect(away).toBeGreaterThanOrEqual(0);
    }
  });

  it("favors the stronger team over many samples (Brazil vs Cape Verde)", () => {
    const N = 500;
    let braWins = 0;
    for (let i = 0; i < N; i++) {
      const { home, away } = generateGroupResult("BRA", "CPV");
      if (home > away) braWins++;
    }
    expect(braWins / N).toBeGreaterThan(0.55);
  });

  it("produces roughly balanced results for similar-strength teams", () => {
    const N = 500;
    let argWins = 0;
    let fraWins = 0;
    for (let i = 0; i < N; i++) {
      const { home, away } = generateGroupResult("ARG", "FRA");
      if (home > away) argWins++;
      else if (away > home) fraWins++;
    }
    expect(argWins).toBeGreaterThan(N * 0.25);
    expect(fraWins).toBeGreaterThan(N * 0.25);
  });

  it("never includes penalties for a group match", () => {
    for (let i = 0; i < 100; i++) {
      const score = generateGroupResult("ARG", "MAR");
      expect(score.penalties).toBeUndefined();
    }
  });
});

describe("generateKnockoutResult", () => {
  it("includes penalties exactly when the score is a draw", () => {
    for (let i = 0; i < 500; i++) {
      const score = generateKnockoutResult("ARG", "FRA");
      if (score.home === score.away) {
        expect(score.penalties).toBeDefined();
        expect(score.penalties!.home).not.toBe(score.penalties!.away);
      } else {
        expect(score.penalties).toBeUndefined();
      }
    }
  });
});
