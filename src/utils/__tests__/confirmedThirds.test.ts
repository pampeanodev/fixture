// src/utils/__tests__/confirmedThirds.test.ts
import { describe, it, expect } from "vitest";
import { confirmedThirds, type GroupThirdInput } from "../confirmedThirds";
import type { GroupMatch } from "../../types";

// Compact fixture: group → [home, away, homeGoals|null, awayGoals|null].
type Row = [string, string, number | null, number | null];

function buildGroup(group: string, rows: Row[]): GroupThirdInput {
  const teamIds = [...new Set(rows.flatMap(([h, a]) => [h, a]))];
  const matches: GroupMatch[] = rows.map(([home, away, h, a], i) => ({
    id: `G-${group}-${i + 1}`,
    group,
    homeTeamId: home,
    awayTeamId: away,
    dateUtc: "2026-06-15T19:00:00Z",
    venue: "Test",
    result: h !== null && a !== null ? { home: h, away: a } : null,
    prediction: null,
  }));
  return { group, matches, teamIds };
}

// Real scenario captured from the app: groups A–I complete, J/K/L have their
// last two matches unplayed. This is the bug report — Paraguay (3rd of D) is a
// confirmed best third (slot R32-2) yet showed no ✓ because the old code waited
// for all 12 groups to finish.
const SCENARIO: Record<string, Row[]> = {
  A: [["MEX","RSA",2,0],["KOR","CZE",2,1],["CZE","RSA",1,1],["MEX","KOR",1,0],["CZE","MEX",0,3],["RSA","KOR",1,0]],
  B: [["CAN","BIH",1,1],["QAT","SUI",1,1],["SUI","BIH",4,1],["CAN","QAT",6,0],["SUI","CAN",2,1],["BIH","QAT",3,1]],
  C: [["BRA","MAR",1,1],["HAI","SCO",0,1],["SCO","MAR",0,1],["BRA","HAI",3,0],["SCO","BRA",0,3],["MAR","HAI",4,2]],
  D: [["USA","PAR",4,1],["AUS","TUR",2,0],["USA","AUS",2,0],["TUR","PAR",0,1],["TUR","USA",3,2],["PAR","AUS",0,0]],
  E: [["GER","CUW",7,1],["CIV","ECU",1,0],["GER","CIV",2,1],["ECU","CUW",0,0],["CUW","CIV",0,2],["ECU","GER",2,1]],
  F: [["NED","JPN",2,2],["SWE","TUN",5,1],["NED","SWE",5,1],["TUN","JPN",0,4],["JPN","SWE",1,1],["TUN","NED",1,3]],
  G: [["BEL","EGY",1,1],["IRN","NZL",2,2],["BEL","IRN",0,0],["NZL","EGY",1,3],["EGY","IRN",1,1],["NZL","BEL",1,5]],
  H: [["ESP","CPV",0,0],["KSA","URU",1,1],["ESP","KSA",4,0],["URU","CPV",2,2],["CPV","KSA",0,0],["URU","ESP",0,1]],
  I: [["FRA","SEN",3,1],["IRQ","NOR",1,4],["FRA","IRQ",3,0],["NOR","SEN",3,2],["NOR","FRA",1,4],["SEN","IRQ",5,0]],
  J: [["ARG","ALG",3,0],["AUT","JOR",3,1],["ARG","AUT",2,0],["JOR","ALG",1,2],["JOR","ARG",null,null],["ALG","AUT",null,null]],
  K: [["POR","COD",1,1],["UZB","COL",1,3],["POR","UZB",5,0],["COL","COD",1,0],["COL","POR",null,null],["COD","UZB",null,null]],
  L: [["ENG","CRO",4,2],["GHA","PAN",1,0],["ENG","GHA",0,0],["PAN","CRO",0,1],["PAN","ENG",null,null],["CRO","GHA",null,null]],
};

function scenarioInputs(): GroupThirdInput[] {
  return Object.entries(SCENARIO).map(([g, rows]) => buildGroup(g, rows));
}

describe("confirmedThirds — locks a third's slot before all groups finish", () => {
  it("confirms Paraguay (3rd of D) into R32-2 with groups J/K/L still unplayed", () => {
    const { assignment } = confirmedThirds(scenarioInputs());
    expect(assignment["D"]).toBe("R32-2");
  });

  it("confirms exactly the thirds whose slot is invariant across all still-possible outcomes", () => {
    const { assignment, qualifyingGroups } = confirmedThirds(scenarioInputs());
    // B (BIH)→R32-9, D (PAR)→R32-2, F (SWE)→R32-5 are locked; E and I always
    // qualify but their slot still depends on J/K/L, so they stay projected.
    expect(assignment).toEqual({ B: "R32-9", D: "R32-2", F: "R32-5" });
    expect([...qualifyingGroups].sort()).toEqual(["B", "D", "F"]);
  });

  it("never confirms a third from an unfinished group (team not settled yet)", () => {
    const { qualifyingGroups } = confirmedThirds(scenarioInputs());
    expect(qualifyingGroups).not.toContain("J");
    expect(qualifyingGroups).not.toContain("K");
    expect(qualifyingGroups).not.toContain("L");
  });

  it("with every group complete, confirms all 8 best thirds (matches the final bracket)", () => {
    // Finish J/K/L so the qualifying set is unique.
    const finished = structuredClone(SCENARIO);
    finished.J[4][2] = 0; finished.J[4][3] = 0; finished.J[5][2] = 0; finished.J[5][3] = 0;
    finished.K[4][2] = 0; finished.K[4][3] = 0; finished.K[5][2] = 0; finished.K[5][3] = 0;
    finished.L[4][2] = 0; finished.L[4][3] = 0; finished.L[5][2] = 0; finished.L[5][3] = 0;
    const inputs = Object.entries(finished).map(([g, rows]) => buildGroup(g, rows));
    const { qualifyingGroups } = confirmedThirds(inputs);
    expect(qualifyingGroups).toHaveLength(8);
  });
});
