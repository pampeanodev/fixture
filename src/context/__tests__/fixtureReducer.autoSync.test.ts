import { describe, expect, it } from "vitest";
import { fixtureReducer } from "../FixtureContext";
import type { FixtureState, GroupMatch, KnockoutMatch } from "../../types";
import { TEAMS } from "../../data/teams";

function state(groupMatches: GroupMatch[], knockoutMatches: KnockoutMatch[] = []): FixtureState {
  return {
    mode: "predictions",
    teams: TEAMS,
    groupMatches,
    knockoutMatches,
    activeView: { type: "schedule" },
    playerName: "",
    rivals: [],
    members: [],
    syncedResultIds: [],
    simulationActive: false,
    simulationSnapshot: null,
  };
}

function gm(id: string, overrides: Partial<GroupMatch> = {}): GroupMatch {
  return {
    id,
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

describe("APPLY_AUTOSYNC_RESULTS", () => {
  it("fills a null group result", () => {
    const s = state([gm("G-A-1")]);
    const next = fixtureReducer(s, {
      type: "APPLY_AUTOSYNC_RESULTS",
      groupResults: { "G-A-1": { home: 2, away: 1 } },
      knockoutResults: {},
    });
    expect(next.groupMatches[0].result).toEqual({ home: 2, away: 1 });
  });

  it("overwrites an existing result — ESPN is the source of truth", () => {
    const s = state([gm("G-A-1", { result: { home: 3, away: 3 } })]);
    const next = fixtureReducer(s, {
      type: "APPLY_AUTOSYNC_RESULTS",
      groupResults: { "G-A-1": { home: 2, away: 1 } },
      knockoutResults: {},
    });
    expect(next.groupMatches[0].result).toEqual({ home: 2, away: 1 });
  });

  it("leaves matches absent from the payload untouched", () => {
    const s = state([gm("G-A-1", { result: { home: 3, away: 3 } })]);
    const next = fixtureReducer(s, {
      type: "APPLY_AUTOSYNC_RESULTS",
      groupResults: {},
      knockoutResults: {},
    });
    expect(next.groupMatches[0].result).toEqual({ home: 3, away: 3 });
  });

  it("does not touch predictions even in predictions mode", () => {
    const s = state([gm("G-A-1", { prediction: { home: 1, away: 1 } })]);
    expect(s.mode).toBe("predictions");
    const next = fixtureReducer(s, {
      type: "APPLY_AUTOSYNC_RESULTS",
      groupResults: { "G-A-1": { home: 2, away: 1 } },
      knockoutResults: {},
    });
    expect(next.groupMatches[0].prediction).toEqual({ home: 1, away: 1 });
    expect(next.groupMatches[0].result).toEqual({ home: 2, away: 1 });
  });

  it("does not modify syncedResultIds of untouched matches", () => {
    const s = { ...state([gm("G-A-1")]), syncedResultIds: ["G-A-2"] };
    const next = fixtureReducer(s, {
      type: "APPLY_AUTOSYNC_RESULTS",
      groupResults: { "G-A-1": { home: 2, away: 1 } },
      knockoutResults: {},
    });
    expect(next.syncedResultIds).toEqual(["G-A-2"]);
  });

  it("untags an admin-synced match it overwrites — a later admin clear must not wipe ESPN data", () => {
    const s = {
      ...state([gm("G-A-1", { result: { home: 1, away: 0 } })]),
      syncedResultIds: ["G-A-1"],
    };
    const overwritten = fixtureReducer(s, {
      type: "APPLY_AUTOSYNC_RESULTS",
      groupResults: { "G-A-1": { home: 2, away: 0 } },
      knockoutResults: {},
    });
    expect(overwritten.syncedResultIds).toEqual([]);
    // Admin clears the match (payload without it): ESPN's value survives.
    const afterAdminClear = fixtureReducer(overwritten, {
      type: "APPLY_SYNCED_RESULTS",
      groupResults: {},
      knockoutResults: {},
    });
    expect(afterAdminClear.groupMatches[0].result).toEqual({ home: 2, away: 0 });
  });
});

describe("CLEAR_PREMATURE_RESULTS", () => {
  it("nulls the result of the given matches", () => {
    const s = state([
      gm("G-A-1", { result: { home: 2, away: 2 } }),
      gm("G-A-2", { result: { home: 1, away: 0 } }),
    ]);
    const next = fixtureReducer(s, {
      type: "CLEAR_PREMATURE_RESULTS",
      matchIds: ["G-A-1"],
    });
    expect(next.groupMatches[0].result).toBeNull();
    expect(next.groupMatches[1].result).toEqual({ home: 1, away: 0 });
  });

  it("drops cleared matches from syncedResultIds and never touches predictions", () => {
    const s = {
      ...state([gm("G-A-1", { result: { home: 2, away: 2 }, prediction: { home: 1, away: 0 } })]),
      syncedResultIds: ["G-A-1"],
    };
    const next = fixtureReducer(s, {
      type: "CLEAR_PREMATURE_RESULTS",
      matchIds: ["G-A-1"],
    });
    expect(next.groupMatches[0].result).toBeNull();
    expect(next.groupMatches[0].prediction).toEqual({ home: 1, away: 0 });
    expect(next.syncedResultIds).toEqual([]);
  });
});

describe("APPLY_SYNCED_RESULTS (admin push is a fallback: fill voids only)", () => {
  it("fills a null result and tags it as synced", () => {
    const s = state([gm("G-A-1")]);
    const next = fixtureReducer(s, {
      type: "APPLY_SYNCED_RESULTS",
      groupResults: { "G-A-1": { home: 1, away: 0 } },
      knockoutResults: {},
    });
    expect(next.groupMatches[0].result).toEqual({ home: 1, away: 0 });
    expect(next.syncedResultIds).toContain("G-A-1");
  });

  it("never overwrites an existing result (ESPN/auto-sync wins)", () => {
    const s = state([gm("G-A-1", { result: { home: 2, away: 0 } })]);
    const next = fixtureReducer(s, {
      type: "APPLY_SYNCED_RESULTS",
      groupResults: { "G-A-1": { home: 3, away: 1 } },
      knockoutResults: {},
    });
    expect(next.groupMatches[0].result).toEqual({ home: 2, away: 0 });
  });

  it("clears a previously synced result missing from the new payload", () => {
    const s = {
      ...state([gm("G-A-1", { result: { home: 1, away: 0 } })]),
      syncedResultIds: ["G-A-1"],
    };
    const next = fixtureReducer(s, {
      type: "APPLY_SYNCED_RESULTS",
      groupResults: {},
      knockoutResults: {},
    });
    expect(next.groupMatches[0].result).toBeNull();
    expect(next.syncedResultIds).toEqual([]);
  });

  it("does not clear results it never synced", () => {
    const s = state([gm("G-A-1", { result: { home: 2, away: 0 } })]);
    const next = fixtureReducer(s, {
      type: "APPLY_SYNCED_RESULTS",
      groupResults: {},
      knockoutResults: {},
    });
    expect(next.groupMatches[0].result).toEqual({ home: 2, away: 0 });
  });
});
