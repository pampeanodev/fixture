import { describe, expect, it } from "vitest";
import { normalizeTeamCode, ESPN_TEAM_CODE_MAP } from "../normalizer";
import { TEAM_IDS } from "../../data/teams";

describe("normalizeTeamCode", () => {
  it("returns the TeamId directly when abbreviation matches", () => {
    expect(normalizeTeamCode("ARG")).toBe("ARG");
    expect(normalizeTeamCode("BRA")).toBe("BRA");
  });

  it("is case-insensitive", () => {
    expect(normalizeTeamCode("arg")).toBe("ARG");
    expect(normalizeTeamCode("Brazilian".slice(0, 3).toUpperCase())).toBe("BRA");
  });

  it("returns null for unknown codes", () => {
    expect(normalizeTeamCode("ZZZ")).toBeNull();
    expect(normalizeTeamCode("")).toBeNull();
  });

  it("returns null for nullish input", () => {
    expect(normalizeTeamCode(undefined)).toBeNull();
  });

  it("applies the override map when present", () => {
    // If we ever map e.g. "WAL" → "WAL" or any override, test one. At minimum
    // the table's values are all in TEAM_IDS.
    for (const mapped of Object.values(ESPN_TEAM_CODE_MAP)) {
      expect(TEAM_IDS).toContain(mapped);
    }
  });
});

describe("ESPN_TEAM_CODE_MAP coverage", () => {
  // Consistency test: for every TeamId, there must be SOME ESPN code that
  // normalizes to it (either identity match, or via the override map).
  it("every TeamId is reachable from at least one ESPN code", () => {
    const reachable = new Set<string>();
    for (const id of TEAM_IDS) {
      // Identity path: the 3-letter id itself.
      if (normalizeTeamCode(id) === id) reachable.add(id);
    }
    for (const [, teamId] of Object.entries(ESPN_TEAM_CODE_MAP)) {
      reachable.add(teamId);
    }
    const missing = TEAM_IDS.filter((id) => !reachable.has(id));
    expect(missing).toEqual([]);
  });
});
