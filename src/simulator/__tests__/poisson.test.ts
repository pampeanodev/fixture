import { describe, it, expect } from "vitest";
import { samplePoisson } from "../poisson";

describe("samplePoisson", () => {
  it("returns a non-negative integer", () => {
    for (let i = 0; i < 100; i++) {
      const v = samplePoisson(1.3);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns 0 when lambda is 0", () => {
    expect(samplePoisson(0)).toBe(0);
  });

  it("empirical mean converges to lambda (N=10000, lambda=1.3)", () => {
    const N = 10000;
    const lambda = 1.3;
    let sum = 0;
    for (let i = 0; i < N; i++) sum += samplePoisson(lambda);
    const mean = sum / N;
    expect(Math.abs(mean - lambda)).toBeLessThan(0.1);
  });

  it("empirical mean converges to lambda (N=10000, lambda=2.5)", () => {
    const N = 10000;
    const lambda = 2.5;
    let sum = 0;
    for (let i = 0; i < N; i++) sum += samplePoisson(lambda);
    const mean = sum / N;
    expect(Math.abs(mean - lambda)).toBeLessThan(0.15);
  });
});
