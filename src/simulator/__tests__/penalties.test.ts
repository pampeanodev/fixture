import { describe, it, expect } from "vitest";
import { simulatePenalties } from "../penalties";

describe("simulatePenalties", () => {
  it("never returns a tie", () => {
    for (let i = 0; i < 1000; i++) {
      const { home, away } = simulatePenalties();
      expect(home).not.toBe(away);
    }
  });

  it("returns non-negative integers", () => {
    for (let i = 0; i < 100; i++) {
      const { home, away } = simulatePenalties();
      expect(Number.isInteger(home)).toBe(true);
      expect(Number.isInteger(away)).toBe(true);
      expect(home).toBeGreaterThanOrEqual(0);
      expect(away).toBeGreaterThanOrEqual(0);
    }
  });

  it("winner scored at least one", () => {
    for (let i = 0; i < 1000; i++) {
      const { home, away } = simulatePenalties();
      const winner = Math.max(home, away);
      expect(winner).toBeGreaterThanOrEqual(1);
    }
  });
});
