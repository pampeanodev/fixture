// src/espn/matcher.ts
import type { EspnEvent } from "./types";
import type { GroupMatch, KnockoutMatch } from "../types";
import { normalizeTeamCode } from "./normalizer";

export type MatchResult =
  | { ok: true; matchId: string }
  | { ok: false; reason: MatchFailure };

export type MatchFailure = "unknown_team_code" | "no_match" | "ambiguous";

const DATE_TOLERANCE_MS = 2 * 60 * 60 * 1000; // 2 hours

export function matchEvent(
  ev: EspnEvent,
  matches: ReadonlyArray<GroupMatch | KnockoutMatch>,
): MatchResult {
  const home = normalizeTeamCode(ev.home.abbreviation);
  const away = normalizeTeamCode(ev.away.abbreviation);
  if (!home || !away) return { ok: false, reason: "unknown_team_code" };

  const evMs = new Date(ev.dateUtc).getTime();

  const candidates = matches.filter((m) => {
    if (!m.homeTeamId || !m.awayTeamId) return false;
    const sameTeams =
      (m.homeTeamId === home && m.awayTeamId === away) ||
      (m.homeTeamId === away && m.awayTeamId === home);
    if (!sameTeams) return false;
    const matchMs = new Date(m.dateUtc).getTime();
    return Math.abs(matchMs - evMs) <= DATE_TOLERANCE_MS;
  });

  if (candidates.length === 0) return { ok: false, reason: "no_match" };
  if (candidates.length > 1) return { ok: false, reason: "ambiguous" };
  return { ok: true, matchId: candidates[0].id };
}
