// src/espn/tournamentWindow.ts
import type { GroupMatch, KnockoutMatch } from "../types";

// Closed interval. End-day inclusive. Values are UTC midnight.
export const TOURNAMENT_START_MS = Date.UTC(2026, 5, 10, 0, 0, 0); // 2026-06-10
export const TOURNAMENT_END_MS = Date.UTC(2026, 6, 20, 23, 59, 59); // 2026-07-20

export function isWithinTournamentWindow(nowMs: number): boolean {
  return nowMs >= TOURNAMENT_START_MS && nowMs <= TOURNAMENT_END_MS;
}

function yyyymmdd(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export function buildFetchDates(nowMs: number): string {
  const dayMs = 24 * 60 * 60 * 1000;
  const start = nowMs - 3 * dayMs;
  const end = nowMs + 3 * dayMs;
  return `${yyyymmdd(start)}-${yyyymmdd(end)}`;
}

export function expectedMatchesOnDate(
  dateMs: number,
  allMatches: ReadonlyArray<GroupMatch | KnockoutMatch>,
): number {
  const target = new Date(dateMs);
  const y = target.getUTCFullYear();
  const m = target.getUTCMonth();
  const d = target.getUTCDate();
  return allMatches.filter((match) => {
    const md = new Date(match.dateUtc);
    return (
      md.getUTCFullYear() === y &&
      md.getUTCMonth() === m &&
      md.getUTCDate() === d
    );
  }).length;
}
