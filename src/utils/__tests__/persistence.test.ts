import { describe, it, expect, beforeEach } from "vitest";
import { reconcileMatches, importFromJson } from "../persistence";
import { loadSalts } from "../../nostr/commitReveal";
import type { GroupMatch } from "../../types";

function gm(id: string, overrides: Partial<GroupMatch> = {}): GroupMatch {
  return {
    id,
    group: "D",
    homeTeamId: "AUS",
    awayTeamId: "TUR",
    dateUtc: "2026-06-14T04:00:00Z",
    venue: "BC Place, Vancouver",
    result: null,
    prediction: null,
    ...overrides,
  };
}

describe("reconcileMatches", () => {
  it("takes schedule metadata from code, not from saved state", () => {
    // Saved state has the OLD wrong date; code has the corrected one.
    const saved = [gm("G-D-2", { dateUtc: "2026-06-13T04:00:00Z" })];
    const canonical = [gm("G-D-2", { dateUtc: "2026-06-14T04:00:00Z" })];
    const merged = reconcileMatches(canonical, saved);
    expect(merged[0].dateUtc).toBe("2026-06-14T04:00:00Z");
  });

  it("preserves the user's prediction and result by match id", () => {
    const saved = [
      gm("G-D-2", {
        dateUtc: "2026-06-13T04:00:00Z",
        prediction: { home: 2, away: 1 },
        result: { home: 1, away: 1 },
      }),
    ];
    const canonical = [gm("G-D-2")];
    const merged = reconcileMatches(canonical, saved);
    expect(merged[0].prediction).toEqual({ home: 2, away: 1 });
    expect(merged[0].result).toEqual({ home: 1, away: 1 });
    expect(merged[0].dateUtc).toBe("2026-06-14T04:00:00Z");
  });

  it("returns canonical untouched when there is no saved state", () => {
    const canonical = [gm("G-D-2")];
    expect(reconcileMatches(canonical, undefined)).toEqual(canonical);
  });

  it("drops saved matches whose id no longer exists in code", () => {
    const saved = [gm("G-OLD-99", { prediction: { home: 5, away: 5 } })];
    const canonical = [gm("G-D-2")];
    const merged = reconcileMatches(canonical, saved);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("G-D-2");
    expect(merged[0].prediction).toBeNull();
  });

  it("adds new code matches absent from saved state", () => {
    const saved = [gm("G-D-2", { prediction: { home: 1, away: 0 } })];
    const canonical = [gm("G-D-2"), gm("G-D-3", { homeTeamId: "USA", awayTeamId: "AUS" })];
    const merged = reconcileMatches(canonical, saved);
    expect(merged).toHaveLength(2);
    expect(merged[1].id).toBe("G-D-3");
    expect(merged[1].prediction).toBeNull();
  });
});

describe("importFromJson salt restore", () => {
  beforeEach(() => localStorage.clear());

  function fileOf(obj: unknown): File {
    return new File([JSON.stringify(obj)], "backup.json", { type: "application/json" });
  }

  it("restores bundled salts so a migrated device can reveal", async () => {
    const data = await importFromJson(
      fileOf({ groupMatches: [], knockoutMatches: [], salts: { room1: { "G-A-1": "aabb" } } }),
    );
    expect(data.groupMatches).toEqual([]);
    expect(loadSalts("room1")).toEqual({ "G-A-1": "aabb" });
  });

  it("imports an older backup without salts unchanged", async () => {
    const data = await importFromJson(fileOf({ groupMatches: [], knockoutMatches: [] }));
    expect(data.knockoutMatches).toEqual([]);
    expect(loadSalts("room1")).toEqual({});
  });

  it("rejects an invalid backup", async () => {
    await expect(importFromJson(fileOf({ nope: true }))).rejects.toThrow();
  });
});
