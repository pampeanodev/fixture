import { describe, expect, it } from "vitest";
import { fixtureReducer } from "../FixtureContext";
import type { FixtureState, GroupMatch, KnockoutMatch } from "../../types";
import { TEAMS } from "../../data/teams";

function state(
  groupMatches: GroupMatch[],
  mode: "results" | "predictions",
  overrides: Partial<FixtureState> = {},
): FixtureState {
  return {
    mode, teams: TEAMS, groupMatches, knockoutMatches: [],
    activeView: { type: "schedule" }, playerName: "", rivals: [], members: [],
    syncedResultIds: [], simulationActive: false, simulationSnapshot: null,
    ...overrides,
  };
}

function gm(id: string, overrides: Partial<GroupMatch> = {}): GroupMatch {
  return {
    id, group: "A", homeTeamId: "ARG", awayTeamId: "MEX",
    dateUtc: "2030-06-15T18:00:00Z", venue: "Test", result: null, prediction: null, ...overrides,
  };
}

function km(id: string, overrides: Partial<KnockoutMatch> = {}): KnockoutMatch {
  return {
    id, round: "R32",
    homeSlot: { type: "group", group: "A", position: 1 },
    awaySlot: { type: "group", group: "B", position: 2 },
    homeTeamId: "ARG", awayTeamId: "MEX",
    dateUtc: "2030-07-01T18:00:00Z", venue: "Test", result: null, prediction: null, ...overrides,
  };
}

describe("SET_GROUP_SCORE field selection", () => {
  it("explicit field:'result' writes result even in predictions mode", () => {
    const next = fixtureReducer(state([gm("G-A-1")], "predictions", { syncedResultIds: ["G-A-1"] }), {
      type: "SET_GROUP_SCORE", matchId: "G-A-1", score: { home: 2, away: 1 }, field: "result",
    });
    expect(next.groupMatches[0].result).toEqual({ home: 2, away: 1 });
    expect(next.groupMatches[0].prediction).toBeNull();
    // editing the result drops the synced flag for that match
    expect(next.syncedResultIds).not.toContain("G-A-1");
  });

  it("explicit field:'prediction' does NOT drop a seeded synced id", () => {
    const next = fixtureReducer(state([gm("G-A-1")], "predictions", { syncedResultIds: ["G-A-1"] }), {
      type: "SET_GROUP_SCORE", matchId: "G-A-1", score: { home: 3, away: 0 }, field: "prediction",
    });
    expect(next.syncedResultIds).toContain("G-A-1");
  });

  it("explicit field:'prediction' writes prediction even in results mode", () => {
    const next = fixtureReducer(state([gm("G-A-1")], "results"), {
      type: "SET_GROUP_SCORE", matchId: "G-A-1", score: { home: 3, away: 0 }, field: "prediction",
    });
    expect(next.groupMatches[0].prediction).toEqual({ home: 3, away: 0 });
    expect(next.groupMatches[0].result).toBeNull();
  });

  it("no field falls back to mode-derived field (results mode -> result)", () => {
    const next = fixtureReducer(state([gm("G-A-1")], "results"), {
      type: "SET_GROUP_SCORE", matchId: "G-A-1", score: { home: 1, away: 1 },
    });
    expect(next.groupMatches[0].result).toEqual({ home: 1, away: 1 });
  });

  it("explicit field:'prediction' on a locked match in predictions mode is ignored", () => {
    const past = "2000-01-01T00:00:00Z";
    const next = fixtureReducer(state([gm("G-A-1", { dateUtc: past })], "predictions"), {
      type: "SET_GROUP_SCORE", matchId: "G-A-1", score: { home: 1, away: 0 }, field: "prediction",
    });
    expect(next.groupMatches[0].prediction).toBeNull();
  });
});

describe("SET_KNOCKOUT_SCORE field selection", () => {
  it("explicit field:'result' writes result and leaves prediction null", () => {
    const next = fixtureReducer(state([], "predictions", { knockoutMatches: [km("K-1")] }), {
      type: "SET_KNOCKOUT_SCORE", matchId: "K-1", score: { home: 2, away: 0 }, field: "result",
    });
    expect(next.knockoutMatches[0].result).toEqual({ home: 2, away: 0 });
    expect(next.knockoutMatches[0].prediction).toBeNull();
  });
});
