// src/types.ts

export interface Team {
  id: string;       // FIFA 3-letter code: "ARG"
  name: string;     // "Argentina"
  flag: string;     // "🇦🇷"
  group: string;    // "A" through "L"
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

export type ViewTarget =
  | { type: "group"; group: string }
  | { type: "knockout"; round: KnockoutRound }
  | { type: "schedule" };

export type FixtureMode = "results" | "predictions";

export interface FixtureState {
  mode: FixtureMode;
  teams: Team[];
  groupMatches: GroupMatch[];
  knockoutMatches: KnockoutMatch[];
  activeView: ViewTarget;
}

export type FixtureAction =
  | { type: "SET_GROUP_SCORE"; matchId: string; score: Score | null }
  | { type: "SET_KNOCKOUT_SCORE"; matchId: string; score: Score | null }
  | { type: "TOGGLE_MODE" }
  | { type: "SET_VIEW"; view: ViewTarget }
  | { type: "IMPORT_STATE"; groupMatches: GroupMatch[]; knockoutMatches: KnockoutMatch[] };
