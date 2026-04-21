import { describe, it, expect } from "vitest";
import { fixtureReducer } from "../FixtureContext";
import type { FixtureState, GroupMatch, KnockoutMatch } from "../../types";

function makeState(overrides: Partial<FixtureState> = {}): FixtureState {
  const groupMatch: GroupMatch = {
    id: "G-A-1", group: "A", homeTeamId: "ARG", awayTeamId: "MAR",
    dateUtc: "2026-06-11T18:00:00Z", venue: "Test",
    result: null, prediction: { home: 2, away: 1 },
  };
  const knockoutMatch: KnockoutMatch = {
    id: "R32-1", round: "R32",
    homeSlot: { type: "group", group: "A", position: 1 },
    awaySlot: { type: "group", group: "B", position: 2 },
    homeTeamId: null, awayTeamId: null,
    dateUtc: "2026-07-01T18:00:00Z", venue: "Test",
    result: null, prediction: null,
  };
  return {
    mode: "predictions",
    teams: [],
    groupMatches: [groupMatch],
    knockoutMatches: [knockoutMatch],
    activeView: { type: "ranking" },
    playerName: "test",
    rivals: [],
    members: [],
    syncedResultIds: [],
    simulationActive: false,
    simulationSnapshot: null,
    ...overrides,
  };
}

describe("ENTER_SIMULATION", () => {
  it("sets simulationActive and snapshots match arrays", () => {
    const state = makeState();
    const next = fixtureReducer(state, { type: "ENTER_SIMULATION" });
    expect(next.simulationActive).toBe(true);
    expect(next.simulationSnapshot).not.toBeNull();
    expect(next.simulationSnapshot!.groupMatches).toBe(state.groupMatches);
    expect(next.simulationSnapshot!.knockoutMatches).toBe(state.knockoutMatches);
  });

  it("forces mode to results", () => {
    const state = makeState({ mode: "predictions" });
    const next = fixtureReducer(state, { type: "ENTER_SIMULATION" });
    expect(next.mode).toBe("results");
  });
});

describe("EXIT_SIMULATION", () => {
  it("restores matches from snapshot and clears simulationActive", () => {
    const entered = fixtureReducer(makeState(), { type: "ENTER_SIMULATION" });
    const withResult = fixtureReducer(entered, {
      type: "SET_GROUP_SCORE", matchId: "G-A-1", score: { home: 3, away: 0 },
    });
    expect(withResult.groupMatches[0].result).toEqual({ home: 3, away: 0 });

    const exited = fixtureReducer(withResult, { type: "EXIT_SIMULATION" });
    expect(exited.simulationActive).toBe(false);
    expect(exited.simulationSnapshot).toBeNull();
    expect(exited.groupMatches[0].result).toBeNull();
    expect(exited.groupMatches[0].prediction).toEqual({ home: 2, away: 1 });
  });

  it("is a no-op when no snapshot exists", () => {
    const state = makeState();
    const next = fixtureReducer(state, { type: "EXIT_SIMULATION" });
    expect(next).toBe(state);
  });
});

describe("RESET_SIMULATION", () => {
  it("restores matches but keeps simulationActive and the snapshot", () => {
    const entered = fixtureReducer(makeState(), { type: "ENTER_SIMULATION" });
    const withResult = fixtureReducer(entered, {
      type: "SET_GROUP_SCORE", matchId: "G-A-1", score: { home: 3, away: 0 },
    });
    const reset = fixtureReducer(withResult, { type: "RESET_SIMULATION" });
    expect(reset.simulationActive).toBe(true);
    expect(reset.simulationSnapshot).not.toBeNull();
    expect(reset.groupMatches[0].result).toBeNull();
  });

  it("is a no-op when no snapshot exists", () => {
    const state = makeState();
    const next = fixtureReducer(state, { type: "RESET_SIMULATION" });
    expect(next).toBe(state);
  });
});
