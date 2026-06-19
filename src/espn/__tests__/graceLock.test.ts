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
  it("is NOT editable while the match is in progress, even when the breaker is tripped", () => {
    // A match that has kicked off but is still inside the grace window is "in
    // progress": there is no final result to enter yet, so it shows the lock
    // indicator rather than empty manual-entry fields.
    expect(
      isMatchEditable(groupMatch(), {
        circuitBreakerTripped: true,
        now: kickoff + 10_000,
      }),
    ).toBe(false);
  });

  it("is editable once the match should be over and the breaker is tripped", () => {
    expect(
      isMatchEditable(groupMatch(), {
        circuitBreakerTripped: true,
        now: kickoff + GRACE_PERIOD_GROUP_MS + 60_000,
      }),
    ).toBe(true);
  });

  it("allows manual correction after grace when the breaker is tripped even if a result exists", () => {
    // ESPN is unreachable (breaker tripped); the stored result may be stale, so
    // the admin can still overwrite it manually once the match is over.
    expect(
      isMatchEditable(groupMatch({ result: { home: 2, away: 1 } }), {
        circuitBreakerTripped: true,
        now: kickoff + GRACE_PERIOD_GROUP_MS + 60_000,
      }),
    ).toBe(true);
  });

  it("is locked before kickoff even when the breaker is tripped", () => {
    // A match that hasn't started has no result to enter manually; the fallback
    // must not turn future matches into editable empty fields.
    expect(
      isMatchEditable(groupMatch(), {
        circuitBreakerTripped: true,
        now: kickoff - 10_000,
      }),
    ).toBe(false);
  });

  it("is locked when breaker off, kickoff in future, no result", () => {
    expect(
      isMatchEditable(groupMatch(), {
        circuitBreakerTripped: false,
        now: kickoff - 10_000,
      }),
    ).toBe(false);
  });

  it("is locked within grace period after kickoff when no result", () => {
    expect(
      isMatchEditable(groupMatch(), {
        circuitBreakerTripped: false,
        now: kickoff + GRACE_PERIOD_GROUP_MS - 60_000,
      }),
    ).toBe(false);
  });

  it("is editable after grace period if still no result", () => {
    expect(
      isMatchEditable(groupMatch(), {
        circuitBreakerTripped: false,
        now: kickoff + GRACE_PERIOD_GROUP_MS + 60_000,
      }),
    ).toBe(true);
  });

  it("is locked after grace period when a result already exists", () => {
    expect(
      isMatchEditable(groupMatch({ result: { home: 2, away: 1 } }), {
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
        circuitBreakerTripped: false,
        now: koKickoff + GRACE_PERIOD_KO_MS - 60_000,
      }),
    ).toBe(false);
    // Just after: editable.
    expect(
      isMatchEditable(koMatch(), {
        circuitBreakerTripped: false,
        now: koKickoff + GRACE_PERIOD_KO_MS + 60_000,
      }),
    ).toBe(true);
  });
});
