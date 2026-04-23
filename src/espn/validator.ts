// src/espn/validator.ts
import type { EspnEvent } from "./types";
import { TERMINAL_STATUSES } from "./types";

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: ValidationReason };

export type ValidationReason =
  | "non_terminal_status"
  | "invalid_score"
  | "missing_shootout"
  | "invalid_shootout"
  | "invalid_date";

const MAX_SCORE = 20;
const MAX_SHOOTOUT = 30;

function isValidScore(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MAX_SCORE;
}

function isValidShootoutScore(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MAX_SHOOTOUT;
}

export function validateEvent(ev: EspnEvent): ValidationResult {
  if (!Number.isFinite(new Date(ev.dateUtc).getTime())) {
    return { ok: false, reason: "invalid_date" };
  }
  if (!TERMINAL_STATUSES.has(ev.statusName)) {
    return { ok: false, reason: "non_terminal_status" };
  }
  if (!isValidScore(ev.home.score) || !isValidScore(ev.away.score)) {
    return { ok: false, reason: "invalid_score" };
  }
  if (ev.statusName === "STATUS_FINAL_PEN") {
    if (!ev.shootout) return { ok: false, reason: "missing_shootout" };
    if (!isValidShootoutScore(ev.shootout.home) || !isValidShootoutScore(ev.shootout.away)) {
      return { ok: false, reason: "invalid_shootout" };
    }
  }
  return { ok: true };
}
