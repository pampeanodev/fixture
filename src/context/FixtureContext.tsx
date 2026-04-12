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
import { saveToLocalStorage, loadFromLocalStorage } from "../utils/persistence";

function fixtureReducer(state: FixtureState, action: FixtureAction): FixtureState {
  switch (action.type) {
    case "SET_GROUP_SCORE": {
      const field = state.mode === "predictions" ? "prediction" : "result";
      return { ...state, groupMatches: state.groupMatches.map((m) =>
        m.id === action.matchId ? { ...m, [field]: action.score } : m
      )};
    }
    case "SET_KNOCKOUT_SCORE": {
      const field = state.mode === "predictions" ? "prediction" : "result";
      return { ...state, knockoutMatches: state.knockoutMatches.map((m) =>
        m.id === action.matchId ? { ...m, [field]: action.score } : m
      )};
    }
    case "TOGGLE_MODE":
      return { ...state, mode: state.mode === "results" ? "predictions" : "results" };
    case "SET_VIEW":
      return { ...state, activeView: action.view };
    case "IMPORT_STATE":
      return { ...state, groupMatches: action.groupMatches, knockoutMatches: action.knockoutMatches };
    default:
      return state;
  }
}

function buildInitialState(): FixtureState {
  const saved = loadFromLocalStorage();
  return {
    mode: "results",
    teams: TEAMS,
    groupMatches: saved?.groupMatches ?? INITIAL_GROUP_MATCHES,
    knockoutMatches: saved?.knockoutMatches ?? INITIAL_KNOCKOUT_MATCHES,
    activeView: { type: "group", group: "A" },
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

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveToLocalStorage({ groupMatches: state.groupMatches, knockoutMatches: state.knockoutMatches });
    }, 500);
    return () => clearTimeout(saveTimerRef.current);
  }, [state.groupMatches, state.knockoutMatches]);

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
