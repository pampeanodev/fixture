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
  // Span the whole tournament-to-date (not just today ± 3) so matches played
  // while auto-sync was down — breaker tripped, app closed — get back-filled
  // instead of ageing out of a narrow window. The upper bound keeps +3 days of
  // upcoming fixtures. ESPN serves the full ~40-day range in one small response.
  const start = TOURNAMENT_START_MS;
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
