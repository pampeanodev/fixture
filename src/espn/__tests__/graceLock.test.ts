import { describe, expect, it } from "vitest";
import { isMatchEditable, GRACE_PERIOD_GROUP_MS, GRACE_PERIOD_KO_MS } from "../graceLock";
import type { GroupMatch, KnockoutMatch } from "../../types";

function groupMatch(overrides: Partial<GroupMatch> = {}): GroupMatch {
  return {
    id: "G-A-1",
    group: "A",
    homeTeamId: "ARG",
    awayTeamId: "MEX",
    dateUtc: "2026-06-15T18:00:00Z",
    venue: "Test",
    result: null,
    prediction: null,
    ...overrides,
  };
}

function koMatch(overrides: Partial<KnockoutMatch> = {}): KnockoutMatch {
  return {
    id: "KO-R32-1",
    round: "R32",
    homeSlot: { type: "group", group: "A", position: 1 },
    awaySlot: { type: "group", group: "B", position: 2 },
    homeTeamId: "CRO",
    awayTeamId: "JPN",
    dateUtc: "2026-06-28T20:00:00Z",
    venue: "Test",
    result: null,
    prediction: null,
    ...overrides,
  };
}

const kickoff = new Date("2026-06-15T18:00:00Z").getTime();

describe("isMatchEditable", () => {
  it("is editable when auto-sync is disabled", () => {
    expect(
      isMatchEditable(groupMatch(), {
        autoSyncEnabled: false,
        circuitBreakerTripped: false,
        now: kickoff - 10_000,
      }),
    ).toBe(true);
  });

  it("is editable when circuit breaker is tripped", () => {
    expect(
      isMatchEditable(groupMatch(), {
        autoSyncEnabled: true,
        circuitBreakerTripped: true,
        now: kickoff - 10_000,
      }),
    ).toBe(true);
  });

  it("is locked when auto-sync enabled, breaker off, kickoff in future, no result", () => {
    expect(
      isMatchEditable(groupMatch(), {
        autoSyncEnabled: true,
        circuitBreakerTripped: false,
        now: kickoff - 10_000,
      }),
    ).toBe(false);
  });

  it("is locked within grace period after kickoff when no result", () => {
    expect(
      isMatchEditable(groupMatch(), {
        autoSyncEnabled: true,
        circuitBreakerTripped: false,
        now: kickoff + GRACE_PERIOD_GROUP_MS - 60_000,
      }),
    ).toBe(false);
  });

  it("is editable after grace period if still no result", () => {
    expect(
      isMatchEditable(groupMatch(), {
        autoSyncEnabled: true,
        circuitBreakerTripped: false,
        now: kickoff + GRACE_PERIOD_GROUP_MS + 60_000,
      }),
    ).toBe(true);
  });

  it("is locked after grace period when a result already exists", () => {
    expect(
      isMatchEditable(groupMatch({ result: { home: 2, away: 1 } }), {
        autoSyncEnabled: true,
        circuitBreakerTripped: false,
        now: kickoff + GRACE_PERIOD_GROUP_MS + 60_000,
      }),
    ).toBe(false);
  });

  it("uses the knockout grace period for knockout matches", () => {
    const koKickoff = new Date("2026-06-28T20:00:00Z").getTime();
    // Just before knockout grace expiry: still locked.
    expect(
      isMatchEditable(koMatch(), {
        autoSyncEnabled: true,
        circuitBreakerTripped: false,
        now: koKickoff + GRACE_PERIOD_KO_MS - 60_000,
      }),
    ).toBe(false);
    // Just after: editable.
    expect(
      isMatchEditable(koMatch(), {
        autoSyncEnabled: true,
        circuitBreakerTripped: false,
        now: koKickoff + GRACE_PERIOD_KO_MS + 60_000,
      }),
    ).toBe(true);
  });
});
