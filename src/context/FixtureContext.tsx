import { createContext, useContext, useReducer, useEffect, useRef, useMemo } from "react";
import type { ReactNode } from "react";
import type { FixtureState, FixtureAction, GroupMatch, KnockoutMatch, Score, StandingRow, ScoreSource } from "../types";
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
  saveToLocalStorage, loadFromLocalStorage, reconcileMatches,
  savePlayerName, loadPlayerName,
  saveRivals, loadRivals,
  saveMembers, loadMembers,
  saveSyncedResultIds, loadSyncedResultIds,
} from "../utils/persistence";

export function fixtureReducer(state: FixtureState, action: FixtureAction): FixtureState {
  switch (action.type) {
    case "SET_GROUP_SCORE": {
      const match = state.groupMatches.find((m) => m.id === action.matchId);
      const field = action.field ?? (state.mode === "predictions" ? "prediction" : "result");
      if (field === "prediction" && match && isMatchLocked(match.dateUtc)) {
        return state;
      }
      // Manual edit of a result = local override; drop synced flag for this match.
      const syncedResultIds =
        field === "result"
          ? state.syncedResultIds.filter((id) => id !== action.matchId)
          : state.syncedResultIds;
      return { ...state, groupMatches: state.groupMatches.map((m) =>
        m.id === action.matchId ? { ...m, [field]: action.score } : m
      ), syncedResultIds };
    }
    case "SET_KNOCKOUT_SCORE": {
      const match = state.knockoutMatches.find((m) => m.id === action.matchId);
      const field = action.field ?? (state.mode === "predictions" ? "prediction" : "result");
      if (field === "prediction" && match && isMatchLocked(match.dateUtc)) {
        return state;
      }
      const syncedResultIds =
        field === "result"
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
      // Reconcile onto canonical so an imported prode keeps its predictions/
      // results but never reintroduces stale schedule metadata.
      return {
        ...state,
        groupMatches: reconcileMatches(INITIAL_GROUP_MATCHES, action.groupMatches),
        knockoutMatches: reconcileMatches(INITIAL_KNOCKOUT_MATCHES, action.knockoutMatches),
      };
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
      // Admin push is a fallback: it only fills voids — auto-sync (ESPN) is the
      // source of truth and overwrites freely. Matches previously synced from
      // admin but missing from the new payload are cleared.
      const previouslySynced = new Set(state.syncedResultIds);
      const syncedResultIds: string[] = [];
      function fillVoid<M extends GroupMatch | KnockoutMatch>(m: M, incoming: Score | undefined): M {
        if (incoming) {
          if (m.result === null) {
            syncedResultIds.push(m.id);
            return { ...m, result: incoming };
          }
          if (previouslySynced.has(m.id)) syncedResultIds.push(m.id);
          return m;
        }
        if (previouslySynced.has(m.id)) return { ...m, result: null };
        return m;
      }
      const groupMatches = state.groupMatches.map((m) => fillVoid(m, action.groupResults[m.id]));
      const knockoutMatches = state.knockoutMatches.map((m) => fillVoid(m, action.knockoutResults[m.id]));
      return { ...state, groupMatches, knockoutMatches, syncedResultIds };
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
    case "APPLY_AUTOSYNC_RESULTS": {
      // Auto-sync is the source of truth: overwrite whatever is there (manual
      // or admin-pushed entries included) so ESPN corrections propagate.
      // Never touch predictions. Matches it writes stop being admin-owned —
      // drop them from syncedResultIds so a later admin clear can't wipe them.
      const written = new Set([
        ...Object.keys(action.groupResults),
        ...Object.keys(action.knockoutResults),
      ]);
      const groupMatches = state.groupMatches.map((m) => {
        const incoming = action.groupResults[m.id];
        return incoming ? { ...m, result: incoming } : m;
      });
      const knockoutMatches = state.knockoutMatches.map((m) => {
        const incoming = action.knockoutResults[m.id];
        return incoming ? { ...m, result: incoming } : m;
      });
      const syncedResultIds = state.syncedResultIds.filter((id) => !written.has(id));
      return { ...state, groupMatches, knockoutMatches, syncedResultIds };
    }
    case "CLEAR_PREMATURE_RESULTS": {
      // A result for a match that hasn't kicked off is impossible — drop it.
      // Auto-sync overwrite can't fix these (ESPN has no final to impose) and
      // graceLock keeps the input disabled while a result exists, so without
      // this the garbage is permanently stuck.
      const ids = new Set(action.matchIds);
      const groupMatches = state.groupMatches.map((m) =>
        ids.has(m.id) ? { ...m, result: null } : m,
      );
      const knockoutMatches = state.knockoutMatches.map((m) =>
        ids.has(m.id) ? { ...m, result: null } : m,
      );
      const syncedResultIds = state.syncedResultIds.filter((id) => !ids.has(id));
      return { ...state, groupMatches, knockoutMatches, syncedResultIds };
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
    groupMatches: reconcileMatches(INITIAL_GROUP_MATCHES, saved?.groupMatches),
    knockoutMatches: reconcileMatches(INITIAL_KNOCKOUT_MATCHES, saved?.knockoutMatches),
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
  // Unified view (f5.2, no mode toggle): group standings and the knockout
  // bracket project the tournament forward — real results once a match is
  // played, the user's (locked) predictions for fixtures not yet played. This
  // keeps the bracket fillable ahead of time while completed rounds reflect
  // reality. During simulation we read real results only: the simulator writes
  // its generated outcomes into `result` and must not have the user's original
  // predictions leak into not-yet-simulated matches.
  const scoreField: ScoreSource = state.simulationActive ? "result" : "hybrid";

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
    return resolveKnockoutTeams(state.knockoutMatches, standingsByGroup, thirdAssignment, bestThirds.qualifying.map((t) => t.group), scoreField);
  }, [state.knockoutMatches, standingsByGroup, thirdAssignment, bestThirds, scoreField]);

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
