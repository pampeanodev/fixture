// src/data/__tests__/thirdPlaceMapping.test.ts
import { describe, it, expect } from "vitest";
import {
  assignThirdPlaceSlots,
  OFFICIAL_THIRD_PLACE_TABLE,
} from "../thirdPlaceMapping";

// Eligibility per R32 best-third slot (must match knockoutStructure.ts).
const ELIGIBILITY: Record<string, string[]> = {
  "R32-2": ["A", "B", "C", "D", "F"],
  "R32-5": ["C", "D", "F", "G", "H"],
  "R32-7": ["C", "E", "F", "H", "I"],
  "R32-8": ["E", "H", "I", "J", "K"],
  "R32-9": ["B", "E", "F", "I", "J"],
  "R32-10": ["A", "E", "H", "I", "J"],
  "R32-13": ["E", "F", "G", "I", "J"],
  "R32-15": ["D", "E", "I", "J", "L"],
};

function combos(letters: string[], k: number): string[] {
  const out: string[] = [];
  const rec = (start: number, acc: string[]) => {
    if (acc.length === k) {
      out.push(acc.join(""));
      return;
    }
    for (let i = start; i < letters.length; i++) {
      acc.push(letters[i]);
      rec(i + 1, acc);
      acc.pop();
    }
  };
  rec(0, []);
  return out;
}

describe("assignThirdPlaceSlots — official FIFA Annexe C table", () => {
  it("covers all 495 combinations of qualifying third-placed groups", () => {
    const all = "ABCDEFGHIJKL".split("");
    for (const combo of combos(all, 8)) {
      expect(OFFICIAL_THIRD_PLACE_TABLE[combo]).toBeDefined();
    }
    expect(Object.keys(OFFICIAL_THIRD_PLACE_TABLE)).toHaveLength(495);
  });

  it("matches the published assignment for a known combination (Annexe C row 67)", () => {
    // Groups B,D,E,F,I,J,K,L qualify → official: 3E→1A, 3J→1B, 3B→1D, 3D→1E,
    // 3I→1G, 3F→1I, 3L→1K, 3K→1L  (1X = group winner's R32 match).
    expect(assignThirdPlaceSlots(["B", "D", "E", "F", "I", "J", "K", "L"])).toEqual({
      E: "R32-7", // 1A
      J: "R32-13", // 1B
      B: "R32-9", // 1D
      D: "R32-2", // 1E
      I: "R32-10", // 1G
      F: "R32-5", // 1I
      L: "R32-15", // 1K
      K: "R32-8", // 1L
    });
  });

  it("only ever assigns a third to an eligible, distinct slot", () => {
    const all = "ABCDEFGHIJKL".split("");
    for (const combo of combos(all, 8)) {
      const assignment = assignThirdPlaceSlots(combo.split(""));
      const usedSlots = new Set<string>();
      for (const group of combo.split("")) {
        const matchId = assignment[group];
        expect(matchId, `group ${group} unassigned in ${combo}`).toBeDefined();
        expect(ELIGIBILITY[matchId]).toContain(group);
        expect(usedSlots.has(matchId), `slot ${matchId} reused in ${combo}`).toBe(false);
        usedSlots.add(matchId);
      }
    }
  });

  it("returns an empty assignment when fewer than 8 groups qualify (group stage in progress)", () => {
    expect(assignThirdPlaceSlots([])).toEqual({});
    expect(assignThirdPlaceSlots(["A", "B", "C"])).toEqual({});
  });
});
