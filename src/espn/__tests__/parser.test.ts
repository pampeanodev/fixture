import { describe, expect, it } from "vitest";
import { parseScoreboard } from "../parser";
import argMex from "../__fixtures__/wc2022-group-arg-mex.json";
import croJpnPen from "../__fixtures__/wc2022-ko-cro-jpn-pen.json";
import emptyDay from "../__fixtures__/wc2022-day-empty.json";
import malformed from "../__fixtures__/malformed-one-competitor.json";

describe("parseScoreboard", () => {
  it("parses a group-stage FT match", () => {
    const events = parseScoreboard(argMex);
    const match = events.find(
      (e) =>
        (e.home.abbreviation === "ARG" && e.away.abbreviation === "MEX") ||
        (e.home.abbreviation === "MEX" && e.away.abbreviation === "ARG"),
    );
    expect(match).toBeDefined();
    expect(match?.statusName).toMatch(/FULL_TIME|FINAL/);
    expect(Number.isInteger(match?.home.score)).toBe(true);
    expect(Number.isInteger(match?.away.score)).toBe(true);
  });

  it("parses a knockout match ending in penalties and extracts shootout", () => {
    const events = parseScoreboard(croJpnPen);
    const pen = events.find(
      (e) =>
        (e.home.abbreviation === "CRO" && e.away.abbreviation === "JPN") ||
        (e.home.abbreviation === "JPN" && e.away.abbreviation === "CRO"),
    );
    expect(pen).toBeDefined();
    expect(pen?.statusName).toBe("STATUS_FINAL_PEN");
    expect(pen?.shootout).toBeDefined();
    expect(Number.isInteger(pen?.shootout?.home)).toBe(true);
    expect(Number.isInteger(pen?.shootout?.away)).toBe(true);
  });

  it("returns empty array for a day with no events", () => {
    expect(parseScoreboard(emptyDay)).toEqual([]);
  });

  it("drops events with fewer than 2 competitors", () => {
    expect(parseScoreboard(malformed)).toEqual([]);
  });

  it("returns empty array for unrelated JSON", () => {
    expect(parseScoreboard({})).toEqual([]);
    expect(parseScoreboard(null)).toEqual([]);
    expect(parseScoreboard("not json" as unknown)).toEqual([]);
  });
});
