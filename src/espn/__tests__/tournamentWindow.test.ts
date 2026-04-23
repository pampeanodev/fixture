import { describe, expect, it } from "vitest";
import {
  isWithinTournamentWindow,
  buildFetchDates,
  expectedMatchesOnDate,
  TOURNAMENT_START_MS,
  TOURNAMENT_END_MS,
} from "../tournamentWindow";
import { INITIAL_GROUP_MATCHES } from "../../data/groupMatches";
import { INITIAL_KNOCKOUT_MATCHES } from "../../data/knockoutStructure";

describe("isWithinTournamentWindow", () => {
  it("returns false the day before the start", () => {
    expect(isWithinTournamentWindow(TOURNAMENT_START_MS - 24 * 60 * 60 * 1000)).toBe(false);
  });

  it("returns true on start day", () => {
    expect(isWithinTournamentWindow(TOURNAMENT_START_MS)).toBe(true);
  });

  it("returns true on end day", () => {
    expect(isWithinTournamentWindow(TOURNAMENT_END_MS)).toBe(true);
  });

  it("returns false the day after the end", () => {
    expect(isWithinTournamentWindow(TOURNAMENT_END_MS + 24 * 60 * 60 * 1000)).toBe(false);
  });
});

describe("buildFetchDates", () => {
  it("returns an ESPN-formatted range spanning today ± 3 days", () => {
    // 2026-06-15T14:00:00Z → window 2026-06-12 to 2026-06-18
    const now = Date.UTC(2026, 5, 15, 14, 0, 0);
    expect(buildFetchDates(now)).toBe("20260612-20260618");
  });

  it("zero-pads days and months", () => {
    const now = Date.UTC(2026, 0, 5, 0, 0, 0);
    expect(buildFetchDates(now)).toBe("20260102-20260108");
  });
});

describe("expectedMatchesOnDate", () => {
  it("counts matches scheduled on a given UTC date across the fixture", () => {
    const allMatches = [...INITIAL_GROUP_MATCHES, ...INITIAL_KNOCKOUT_MATCHES];
    // Pick the date of the first group match and assert it returns ≥ 1
    const first = INITIAL_GROUP_MATCHES[0];
    const count = expectedMatchesOnDate(new Date(first.dateUtc).getTime(), allMatches);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("returns 0 for a date with no scheduled matches", () => {
    const allMatches = [...INITIAL_GROUP_MATCHES, ...INITIAL_KNOCKOUT_MATCHES];
    // A day before the tournament.
    const before = Date.UTC(2026, 0, 1);
    expect(expectedMatchesOnDate(before, allMatches)).toBe(0);
  });
});
