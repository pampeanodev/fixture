// src/types.ts
import { TEAM_IDS } from "./data/teams";

export type TeamId = (typeof TEAM_IDS)[number];

export interface Team {
  id: TeamId;      // FIFA 3-letter code, union literal
  flag: string;    // "🇦🇷"
  group: string;   // "A" through "L"
}

export interface Score {
  home: number;
  away: number;
  penalties?: { home: number; away: number };
}

export interface GroupMatch {
  id: string;              // "G-A-1"
  group: string;           // "A"
  homeTeamId: string;
  awayTeamId: string;
  dateUtc: string;         // ISO 8601
  venue: string;
  result: Score | null;
  prediction: Score | null;
}

export type KnockoutRound = "R32" | "R16" | "QF" | "SF" | "3P" | "F";

export type KnockoutSlot =
  | { type: "group"; group: string; position: 1 | 2 }
  | { type: "best_third"; possibleGroups: string[] }
  | { type: "winner"; matchId: string }
  | { type: "loser"; matchId: string };

export interface KnockoutMatch {
  id: string;
  round: KnockoutRound;
  homeSlot: KnockoutSlot;
  awaySlot: KnockoutSlot;
  homeTeamId: string | null;
  awayTeamId: string | null;
  dateUtc: string;
  venue: string;
  result: Score | null;
  prediction: Score | null;
}

export interface StandingRow {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface Rival {
  name: string;
  groupPredictions: Record<string, Score>;   // matchId -> Score
  knockoutPredictions: Record<string, Score>; // matchId -> Score
}

export interface Member {
  pubkey: string;  // hex
  name: string;    // display name; fallback to pubkey.slice(0, 8) if unknown
}

export type ViewTarget =
  | { type: "groups"; group: string }
  | { type: "knockout"; round: KnockoutRound }
  | { type: "schedule" }
  | { type: "ranking" }
  | { type: "rooms" }
  | { type: "room"; roomId: string }
  | { type: "simulator" };

export type FixtureMode = "results" | "predictions";

export interface FixtureState {
  mode: FixtureMode;
  teams: readonly Team[];
  groupMatches: GroupMatch[];
  knockoutMatches: KnockoutMatch[];
  activeView: ViewTarget;
  playerName: string;
  rivals: Rival[];
  members: Member[];
  syncedResultIds: string[];  // match IDs whose result came from admin broadcast
  simulationActive: boolean;
  simulationSnapshot: SimulationSnapshot | null;
}

export interface SimulationSnapshot {
  groupMatches: GroupMatch[];
  knockoutMatches: KnockoutMatch[];
}

export type FixtureAction =
  | { type: "SET_GROUP_SCORE"; matchId: string; score: Score | null }
  | { type: "SET_KNOCKOUT_SCORE"; matchId: string; score: Score | null }
  | { type: "TOGGLE_MODE" }
  | { type: "SET_VIEW"; view: ViewTarget }
  | { type: "IMPORT_STATE"; groupMatches: GroupMatch[]; knockoutMatches: KnockoutMatch[] }
  | { type: "SET_PLAYER_NAME"; name: string }
  | { type: "ADD_RIVAL"; rival: Rival }
  | { type: "REMOVE_RIVAL"; name: string }
  | { type: "SET_MEMBERS"; members: Member[] }
  | { type: "UPSERT_MEMBER"; member: Member }
  | { type: "CLEAR_MEMBERS" }
  | { type: "APPLY_SYNCED_RESULTS"; groupResults: Record<string, Score>; knockoutResults: Record<string, Score> }
  | { type: "CLEAR_SYNCED_RESULTS" }
  | { type: "ENTER_SIMULATION" }
  | { type: "EXIT_SIMULATION" }
  | { type: "RESET_SIMULATION" };
