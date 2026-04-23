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

  it("does not overwrite an existing result", () => {
    const s = state([gm("G-A-1", { result: { home: 3, away: 3 } })]);
    const next = fixtureReducer(s, {
      type: "APPLY_AUTOSYNC_RESULTS",
      groupResults: { "G-A-1": { home: 2, away: 1 } },
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

  it("does not modify syncedResultIds", () => {
    const s = { ...state([gm("G-A-1")]), syncedResultIds: ["G-A-2"] };
    const next = fixtureReducer(s, {
      type: "APPLY_AUTOSYNC_RESULTS",
      groupResults: { "G-A-1": { home: 2, away: 1 } },
      knockoutResults: {},
    });
    expect(next.syncedResultIds).toEqual(["G-A-2"]);
  });
});
