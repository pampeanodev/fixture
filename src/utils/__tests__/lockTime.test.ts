import { describe, it, expect, vi, afterEach } from "vitest";
import { getMatchLockTime, isMatchLocked } from "../lockTime";

describe("getMatchLockTime", () => {
  it("returns 1 hour before the match dateUtc", () => {
    const lockTime = getMatchLockTime("2026-06-11T18:00:00Z");
    expect(lockTime).toBe(new Date("2026-06-11T17:00:00Z").getTime());
  });
});

describe("isMatchLocked", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false when more than 1 hour before match", () => {
    vi.setSystemTime(new Date("2026-06-11T15:00:00Z"));
    expect(isMatchLocked("2026-06-11T18:00:00Z")).toBe(false);
  });

  it("returns true when exactly 1 hour before match", () => {
    vi.setSystemTime(new Date("2026-06-11T17:00:00Z"));
    expect(isMatchLocked("2026-06-11T18:00:00Z")).toBe(true);
  });

  it("returns true when less than 1 hour before match", () => {
    vi.setSystemTime(new Date("2026-06-11T17:30:00Z"));
    expect(isMatchLocked("2026-06-11T18:00:00Z")).toBe(true);
  });

  it("returns true after match has started", () => {
    vi.setSystemTime(new Date("2026-06-11T19:00:00Z"));
    expect(isMatchLocked("2026-06-11T18:00:00Z")).toBe(true);
  });
});
