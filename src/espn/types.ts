// src/espn/types.ts

// Our normalized, pipeline-internal representation of one ESPN event.
// The parser (parser.ts) turns raw ESPN JSON into this shape; every module
// downstream (validator, matcher) consumes only this.
export interface EspnEvent {
  id: string;                 // ESPN event id (opaque; used for logging only)
  dateUtc: string;            // ISO 8601
  statusName: EspnStatusName; // narrowed from status.type.name; see below
  home: EspnCompetitor;
  away: EspnCompetitor;
  shootout?: { home: number; away: number }; // present only when statusName === "STATUS_FINAL_PEN"
}

export interface EspnCompetitor {
  abbreviation: string; // ESPN's team code, e.g. "ARG"; normalized to TeamId downstream
  score: number;        // regulation or final score depending on status
}

// Closed set we recognize. Anything else is treated as non-terminal and skipped
// by the validator. Exact values are sourced from ESPN via the dev inspector;
// the list below is the best-known set as of planning.
export type EspnStatusName =
  | "STATUS_FULL_TIME"
  | "STATUS_FINAL"
  | "STATUS_FINAL_AET"
  | "STATUS_FINAL_PEN"
  | "STATUS_SCHEDULED"
  | "STATUS_IN_PROGRESS"
  | "STATUS_HALFTIME"
  | "STATUS_POSTPONED"
  | "STATUS_FORFEIT"
  | "STATUS_CANCELED"
  | "STATUS_UNKNOWN";

// Raw ESPN scoreboard shape, subset we rely on. Source: ESPN Site API v3.
// We keep this loose (many fields unknown, not our concern) — the parser's job
// is to project it into EspnEvent.
export interface EspnRawScoreboard {
  events?: EspnRawEvent[];
}

export interface EspnRawEvent {
  id?: string;
  date?: string;
  status?: {
    type?: {
      name?: string;
      completed?: boolean;
      state?: string;
    };
  };
  competitions?: Array<{
    competitors?: EspnRawCompetitor[];
    status?: {
      type?: {
        name?: string;
      };
    };
    details?: unknown; // shootout info lives here or in a sibling — parser figures it out
  }>;
}

export interface EspnRawCompetitor {
  homeAway?: string;
  score?: string | number;
  team?: {
    abbreviation?: string;
  };
  shootoutScore?: number; // some ESPN payloads put shootout here
}

// Terminal statuses that indicate a final, recordable result.
export const TERMINAL_STATUSES: ReadonlySet<EspnStatusName> = new Set([
  "STATUS_FULL_TIME",
  "STATUS_FINAL",
  "STATUS_FINAL_AET",
  "STATUS_FINAL_PEN",
]);
