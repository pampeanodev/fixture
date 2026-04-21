import { createContext, useContext, useReducer, useEffect, useRef, useMemo } from "react";
import type { ReactNode } from "react";
import type { FixtureState, FixtureAction, KnockoutMatch, StandingRow } from "../types";
import { TEAMS, GROUPS } from "../data/teams";
import { INITIAL_GROUP_MATCHES } from "../data/groupMatches";
import { INITIAL_KNOCKOUT_MATCHES } from "../data/knockoutStructure";
import { calculateStandings } from "../utils/standings";
import { selectBestThirds } from "../utils/bestThirds";
import type { ThirdPlaceEntry } from "../utils/bestThirds";
import { assignThirdPlaceSlots } from "../data/thirdPlaceMapping";
import { resolveKnockoutTeams } from "../utils/knockout";
import { isMatchLocked } from "../utils/lockTime";
import {
  saveToLocalStorage, loadFromLocalStorage,
  savePlayerName, loadPlayerName,
  saveRivals, loadRivals,
  saveMembers, loadMembers,
  saveSyncedResultIds, loadSyncedResultIds,
} from "../utils/persistence";

export function fixtureReducer(state: FixtureState, action: FixtureAction): FixtureState {
  switch (action.type) {
    case "SET_GROUP_SCORE": {
      const match = state.groupMatches.find((m) => m.id === action.matchId);
      if (state.mode === "predictions" && match && isMatchLocked(match.dateUtc)) {
        return state;
      }
      const field = state.mode === "predictions" ? "prediction" : "result";
      // Manual edit in results mode = local override; drop synced flag for this match.
      const syncedResultIds =
        state.mode === "results"
          ? state.syncedResultIds.filter((id) => id !== action.matchId)
          : state.syncedResultIds;
      return { ...state, groupMatches: state.groupMatches.map((m) =>
        m.id === action.matchId ? { ...m, [field]: action.score } : m
      ), syncedResultIds };
    }
    case "SET_KNOCKOUT_SCORE": {
      const match = state.knockoutMatches.find((m) => m.id === action.matchId);
      if (state.mode === "predictions" && match && isMatchLocked(match.dateUtc)) {
        return state;
      }
      const field = state.mode === "predictions" ? "prediction" : "result";
      const syncedResultIds =
        state.mode === "results"
          ? state.syncedResultIds.filter((id) => id !== action.matchId)
          : state.syncedResultIds;
      return { ...state, knockoutMatches: state.knockoutMatches.map((m) =>
        m.id === action.matchId ? { ...m, [field]: action.score } : m
      ), syncedResultIds };
    }
    case "TOGGLE_MODE":
      return { ...state, mode: state.mode === "results" ? "predictions" : "results" };
    case "SET_VIEW":
      return { ...state, activeView: action.view };
    case "IMPORT_STATE":
      return { ...state, groupMatches: action.groupMatches, knockoutMatches: action.knockoutMatches };
    case "SET_PLAYER_NAME":
      return { ...state, playerName: action.name };
    case "ADD_RIVAL": {
      const filtered = state.rivals.filter((r) => r.name !== action.rival.name);
      return { ...state, rivals: [...filtered, action.rival] };
    }
    case "REMOVE_RIVAL":
      return { ...state, rivals: state.rivals.filter((r) => r.name !== action.name) };
    case "SET_MEMBERS":
      return { ...state, members: action.members };
    case "UPSERT_MEMBER": {
      const others = state.members.filter((m) => m.pubkey !== action.member.pubkey);
      return { ...state, members: [...others, action.member] };
    }
    case "CLEAR_MEMBERS":
      return { ...state, members: [] };
    case "APPLY_SYNCED_RESULTS": {
      const groupMatches = state.groupMatches.map((m) => {
        const incoming = action.groupResults[m.id];
        return incoming ? { ...m, result: incoming } : m;
      });
      const knockoutMatches = state.knockoutMatches.map((m) => {
        const incoming = action.knockoutResults[m.id];
        return incoming ? { ...m, result: incoming } : m;
      });
      const ids = new Set([
        ...state.syncedResultIds,
        ...Object.keys(action.groupResults),
        ...Object.keys(action.knockoutResults),
      ]);
      return { ...state, groupMatches, knockoutMatches, syncedResultIds: Array.from(ids) };
    }
    case "CLEAR_SYNCED_RESULTS":
      return { ...state, syncedResultIds: [] };
    case "ENTER_SIMULATION": {
      return {
        ...state,
        mode: "results",
        simulationActive: true,
        simulationSnapshot: {
          groupMatches: state.groupMatches,
          knockoutMatches: state.knockoutMatches,
        },
      };
    }
    case "EXIT_SIMULATION": {
      if (!state.simulationSnapshot) return state;
      return {
        ...state,
        groupMatches: state.simulationSnapshot.groupMatches,
        knockoutMatches: state.simulationSnapshot.knockoutMatches,
        simulationActive: false,
        simulationSnapshot: null,
      };
    }
    case "RESET_SIMULATION": {
      if (!state.simulationSnapshot) return state;
      return {
        ...state,
        groupMatches: state.simulationSnapshot.groupMatches,
        knockoutMatches: state.simulationSnapshot.knockoutMatches,
      };
    }
    default:
      return state;
  }
}

function buildInitialState(): FixtureState {
  const saved = loadFromLocalStorage();
  return {
    mode: "predictions",
    teams: TEAMS,
    groupMatches: saved?.groupMatches ?? INITIAL_GROUP_MATCHES,
    knockoutMatches: saved?.knockoutMatches ?? INITIAL_KNOCKOUT_MATCHES,
    activeView: { type: "schedule" },
    playerName: loadPlayerName(),
    rivals: loadRivals(),
    members: loadMembers(),
    syncedResultIds: loadSyncedResultIds(),
    simulationActive: false,
    simulationSnapshot: null,
  };
}

interface FixtureContextValue {
  state: FixtureState;
  dispatch: React.Dispatch<FixtureAction>;
  standingsByGroup: Record<string, StandingRow[]>;
  resolvedKnockout: KnockoutMatch[];
  bestThirds: { qualifying: ThirdPlaceEntry[]; eliminated: ThirdPlaceEntry[] };
}

const FixtureContext = createContext<FixtureContextValue | null>(null);

export function FixtureProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(fixtureReducer, undefined, buildInitialState);
  const scoreField = state.mode === "predictions" ? "prediction" : "result";

  const standingsByGroup = useMemo(() => {
    const result: Record<string, StandingRow[]> = {};
    for (const group of GROUPS) {
      const groupMatches = state.groupMatches.filter((m) => m.group === group);
      const teamIds = TEAMS.filter((t) => t.group === group).map((t) => t.id);
      result[group] = calculateStandings(groupMatches, teamIds, scoreField);
    }
    return result;
  }, [state.groupMatches, scoreField]);

  const bestThirds = useMemo(() => {
    const thirds: ThirdPlaceEntry[] = [];
    for (const group of GROUPS) {
      const standings = standingsByGroup[group];
      if (standings && standings.length >= 3) thirds.push({ group, standing: standings[2] });
    }
    return selectBestThirds(thirds);
  }, [standingsByGroup]);

  const thirdAssignment = useMemo(() => {
    return assignThirdPlaceSlots(bestThirds.qualifying.map((t) => t.group));
  }, [bestThirds]);

  const resolvedKnockout = useMemo(() => {
    return resolveKnockoutTeams(state.knockoutMatches, standingsByGroup, thirdAssignment, bestThirds.qualifying.map((t) => t.group));
  }, [state.knockoutMatches, standingsByGroup, thirdAssignment, bestThirds]);

  // Persist match data
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (state.simulationActive) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveToLocalStorage({ groupMatches: state.groupMatches, knockoutMatches: state.knockoutMatches });
    }, 500);
    return () => clearTimeout(saveTimerRef.current);
  }, [state.groupMatches, state.knockoutMatches, state.simulationActive]);

  // Persist player name
  useEffect(() => { savePlayerName(state.playerName); }, [state.playerName]);

  // Persist rivals
  useEffect(() => { saveRivals(state.rivals); }, [state.rivals]);

  // Persist members
  useEffect(() => { saveMembers(state.members); }, [state.members]);

  // Persist synced result ids
  useEffect(() => { saveSyncedResultIds(state.syncedResultIds); }, [state.syncedResultIds]);

  const value = useMemo(
    () => ({ state, dispatch, standingsByGroup, resolvedKnockout, bestThirds }),
    [state, standingsByGroup, resolvedKnockout, bestThirds]
  );

  return <FixtureContext.Provider value={value}>{children}</FixtureContext.Provider>;
}

export function useFixture(): FixtureContextValue {
  const ctx = useContext(FixtureContext);
  if (!ctx) throw new Error("useFixture must be used within FixtureProvider");
  return ctx;
}
