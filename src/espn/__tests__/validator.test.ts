import { describe, expect, it } from "vitest";
import { validateEvent } from "../validator";
import type { EspnEvent } from "../types";

function baseEvent(): EspnEvent {
  return {
    id: "e1",
    dateUtc: "2026-06-15T18:00:00Z",
    statusName: "STATUS_FULL_TIME",
    home: { abbreviation: "ARG", score: 2 },
    away: { abbreviation: "MEX", score: 1 },
  };
}

describe("validateEvent", () => {
  it("accepts a well-formed FT event", () => {
    expect(validateEvent(baseEvent())).toEqual({ ok: true });
  });

  it("rejects non-terminal status", () => {
    const ev = { ...baseEvent(), statusName: "STATUS_IN_PROGRESS" as const };
    expect(validateEvent(ev)).toEqual({ ok: false, reason: "non_terminal_status" });
  });

  it("rejects postponed", () => {
    const ev = { ...baseEvent(), statusName: "STATUS_POSTPONED" as const };
    expect(validateEvent(ev)).toEqual({ ok: false, reason: "non_terminal_status" });
  });

  it("rejects non-integer scores", () => {
    const ev = { ...baseEvent(), home: { abbreviation: "ARG", score: 2.5 } };
    expect(validateEvent(ev)).toEqual({ ok: false, reason: "invalid_score" });
  });

  it("rejects negative scores", () => {
    const ev = { ...baseEvent(), away: { abbreviation: "MEX", score: -1 } };
    expect(validateEvent(ev)).toEqual({ ok: false, reason: "invalid_score" });
  });

  it("rejects implausibly high scores", () => {
    const ev = { ...baseEvent(), home: { abbreviation: "ARG", score: 99 } };
    expect(validateEvent(ev)).toEqual({ ok: false, reason: "invalid_score" });
  });

  it("rejects PEN status without shootout", () => {
    const ev = { ...baseEvent(), statusName: "STATUS_FINAL_PEN" as const };
    expect(validateEvent(ev)).toEqual({ ok: false, reason: "missing_shootout" });
  });

  it("accepts PEN with valid shootout", () => {
    const ev: EspnEvent = {
      ...baseEvent(),
      statusName: "STATUS_FINAL_PEN",
      shootout: { home: 4, away: 3 },
    };
    expect(validateEvent(ev)).toEqual({ ok: true });
  });

  it("rejects invalid shootout values", () => {
    const ev: EspnEvent = {
      ...baseEvent(),
      statusName: "STATUS_FINAL_PEN",
      shootout: { home: 4, away: -1 },
    };
    expect(validateEvent(ev)).toEqual({ ok: false, reason: "invalid_shootout" });
  });

  it("rejects non-finite dateUtc", () => {
    const ev = { ...baseEvent(), dateUtc: "not-a-date" };
    expect(validateEvent(ev)).toEqual({ ok: false, reason: "invalid_date" });
  });
});
