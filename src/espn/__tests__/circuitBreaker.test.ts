import { beforeEach, describe, expect, it } from "vitest";
import {
  evaluateTick,
  loadBreakerState,
  saveBreakerState,
  resetBreaker,
  BREAKER_STORAGE_KEY,
} from "../circuitBreaker";

beforeEach(() => {
  localStorage.clear();
});

describe("evaluateTick", () => {
  it("does not trip on a successful tick", () => {
    const next = evaluateTick(
      { tripped: false, trippedAt: null, reason: null, consecutiveFailures: 0 },
      { applied: 5, skipped: 0, networkFailed: false },
      Date.now(),
    );
    expect(next.tripped).toBe(false);
    expect(next.consecutiveFailures).toBe(0);
  });

  it("does not trip with mild skips", () => {
    const next = evaluateTick(
      { tripped: false, trippedAt: null, reason: null, consecutiveFailures: 0 },
      { applied: 5, skipped: 1, networkFailed: false },
      Date.now(),
    );
    expect(next.tripped).toBe(false);
  });

  it("trips when skips outweigh applies by 2x (>= 3 skips)", () => {
    const next = evaluateTick(
      { tripped: false, trippedAt: null, reason: null, consecutiveFailures: 0 },
      { applied: 1, skipped: 4, networkFailed: false },
      1_000,
    );
    expect(next.tripped).toBe(true);
    expect(next.reason).toBe("many_skips");
    expect(next.trippedAt).toBe(1_000);
  });

  it("increments consecutive failures on network fail without tripping immediately", () => {
    const s1 = evaluateTick(
      { tripped: false, trippedAt: null, reason: null, consecutiveFailures: 0 },
      { applied: 0, skipped: 0, networkFailed: true },
      1_000,
    );
    expect(s1.tripped).toBe(false);
    expect(s1.consecutiveFailures).toBe(1);
  });

  it("trips after 5 consecutive network failures", () => {
    let state = {
      tripped: false,
      trippedAt: null as number | null,
      reason: null as "many_skips" | "repeated_network_failures" | null,
      consecutiveFailures: 0,
    };
    for (let i = 0; i < 5; i++) {
      state = evaluateTick(state, { applied: 0, skipped: 0, networkFailed: true }, 1_000 + i);
    }
    expect(state.tripped).toBe(true);
    expect(state.reason).toBe("repeated_network_failures");
  });

  it("resets consecutive failures on a successful tick", () => {
    const s1 = evaluateTick(
      { tripped: false, trippedAt: null, reason: null, consecutiveFailures: 3 },
      { applied: 1, skipped: 0, networkFailed: false },
      Date.now(),
    );
    expect(s1.consecutiveFailures).toBe(0);
  });
});

describe("persistence", () => {
  it("round-trips breaker state through localStorage", () => {
    saveBreakerState({
      tripped: true,
      trippedAt: 1234,
      reason: "many_skips",
      consecutiveFailures: 0,
    });
    expect(loadBreakerState()).toEqual({
      tripped: true,
      trippedAt: 1234,
      reason: "many_skips",
      consecutiveFailures: 0,
    });
  });

  it("returns a fresh state when storage is empty", () => {
    expect(loadBreakerState()).toEqual({
      tripped: false,
      trippedAt: null,
      reason: null,
      consecutiveFailures: 0,
    });
  });

  it("resetBreaker clears the storage key", () => {
    saveBreakerState({ tripped: true, trippedAt: 1, reason: "many_skips", consecutiveFailures: 0 });
    resetBreaker();
    expect(localStorage.getItem(BREAKER_STORAGE_KEY)).toBeNull();
  });
});
