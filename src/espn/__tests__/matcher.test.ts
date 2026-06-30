import { describe, expect, it } from "vitest";
import { matchEvent } from "../matcher";
import type { EspnEvent } from "../types";
import type { GroupMatch, KnockoutMatch } from "../../types";

function groupMatch(overrides: Partial<GroupMatch>): GroupMatch {
  return {
    id: "G-A-1",
    group: "A",
    homeTeamId: "ARG",
    awayTeamId: "MEX",
    dateUtc: "2026-06-15T18:00:00Z",
    venue: "Test",
    result: null,
    prediction: null,
    ...overrides,
  };
}

function koMatch(overrides: Partial<KnockoutMatch>): KnockoutMatch {
  return {
    id: "KO-R32-1",
    round: "R32",
    homeSlot: { type: "group", group: "A", position: 1 },
    awaySlot: { type: "group", group: "B", position: 2 },
    homeTeamId: "CRO",
    awayTeamId: "JPN",
    dateUtc: "2026-06-28T20:00:00Z",
    venue: "Test",
    result: null,
    prediction: null,
    ...overrides,
  };
}

function baseEvent(overrides: Partial<EspnEvent> = {}): EspnEvent {
  return {
    id: "e1",
    dateUtc: "2026-06-15T18:00:00Z",
    statusName: "STATUS_FULL_TIME",
    home: { abbreviation: "ARG", score: 2 },
    away: { abbreviation: "MEX", score: 1 },
    ...overrides,
  };
}

describe("matchEvent", () => {
  it("matches by team ids + date within ±2h", () => {
    const matches = [groupMatch({})];
    const result = matchEvent(baseEvent(), matches);
    expect(result).toEqual({ ok: true, matchId: "G-A-1" });
  });

  it("tolerates ±2h drift", () => {
    const matches = [groupMatch({ dateUtc: "2026-06-15T17:00:00Z" })];
    const result = matchEvent(baseEvent(), matches);
    expect(result).toEqual({ ok: true, matchId: "G-A-1" });
  });

  it("rejects drift > 2h", () => {
    const matches = [groupMatch({ dateUtc: "2026-06-15T14:00:00Z" })];
    const result = matchEvent(baseEvent(), matches);
    expect(result).toEqual({ ok: false, reason: "no_match" });
  });

  it("rejects when team ids don't match", () => {
    const matches = [groupMatch({ homeTeamId: "BRA" })];
    const result = matchEvent(baseEvent(), matches);
    expect(result).toEqual({ ok: false, reason: "no_match" });
  });

  it("rejects unknown ESPN team code", () => {
    const matches = [groupMatch({})];
    const ev = baseEvent({ home: { abbreviation: "ZZZ", score: 2 } });
    expect(matchEvent(ev, matches)).toEqual({ ok: false, reason: "unknown_team_code" });
  });

  it("rejects ambiguous matches (two candidates)", () => {
    const matches = [groupMatch({}), groupMatch({ id: "G-A-2" })];
    expect(matchEvent(baseEvent(), matches)).toEqual({
      ok: false,
      reason: "ambiguous",
    });
  });

  it("matches knockout by team ids when resolved", () => {
    const matches = [koMatch({})];
    const ev = baseEvent({
      dateUtc: "2026-06-28T20:00:00Z",
      home: { abbreviation: "CRO", score: 1 },
      away: { abbreviation: "JPN", score: 1 },
      statusName: "STATUS_FINAL_PEN",
      shootout: { home: 3, away: 1 },
    });
    expect(matchEvent(ev, matches)).toEqual({ ok: true, matchId: "KO-R32-1" });
  });

  it("skips knockout matches whose teams aren't resolved yet", () => {
    const matches = [koMatch({ homeTeamId: null, awayTeamId: null })];
    const ev = baseEvent({
      dateUtc: "2026-06-28T20:00:00Z",
      home: { abbreviation: "CRO", score: 1 },
      away: { abbreviation: "JPN", score: 1 },
    });
    expect(matchEvent(ev, matches)).toEqual({ ok: false, reason: "no_match" });
  });

  it("matches a knockout fixture despite a multi-hour kickoff drift (placeholder times)", () => {
    // Real ESPN bug: our hardcoded knockout kickoff is a placeholder. ESPN had
    // GER–PAR at 20:30Z while the fixture says 17:00Z (3.5h) — beyond the 2h
    // group tolerance, so it was wrongly skipped. Knockout gets a wide window.
    const matches = [koMatch({ homeTeamId: "GER", awayTeamId: "PAR", dateUtc: "2026-06-29T17:00:00Z" })];
    const ev = baseEvent({
      dateUtc: "2026-06-29T20:30:00Z",
      home: { abbreviation: "GER", score: 1 },
      away: { abbreviation: "PAR", score: 1 },
      statusName: "STATUS_FINAL_PEN",
      shootout: { home: 4, away: 2 },
    });
    expect(matchEvent(ev, matches)).toEqual({ ok: true, matchId: "KO-R32-1" });
  });

  it("matches a knockout fixture when the real kickoff slips past midnight", () => {
    // NED–MAR: fixture 29 Jun 20:00Z, ESPN 30 Jun 01:00Z — a calendar-day flip.
    const matches = [koMatch({ homeTeamId: "NED", awayTeamId: "MAR", dateUtc: "2026-06-29T20:00:00Z" })];
    const ev = baseEvent({
      dateUtc: "2026-06-30T01:00:00Z",
      home: { abbreviation: "NED", score: 1 },
      away: { abbreviation: "MAR", score: 1 },
      statusName: "STATUS_FINAL_PEN",
      shootout: { home: 4, away: 2 },
    });
    expect(matchEvent(ev, matches)).toEqual({ ok: true, matchId: "KO-R32-1" });
  });

  it("keeps the tight ±2h window for group fixtures", () => {
    // Groups still demand close agreement — only knockout times are placeholders.
    const matches = [groupMatch({ dateUtc: "2026-06-15T12:00:00Z" })]; // 6h from event
    expect(matchEvent(baseEvent(), matches)).toEqual({ ok: false, reason: "no_match" });
  });
});
