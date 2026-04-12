// src/data/knockoutStructure.ts
import type { KnockoutMatch, KnockoutSlot } from "../types";

function km(
  id: string,
  round: KnockoutMatch["round"],
  homeSlot: KnockoutSlot,
  awaySlot: KnockoutSlot,
  dateUtc: string,
  venue: string
): KnockoutMatch {
  return { id, round, homeSlot, awaySlot, dateUtc, venue, result: null, prediction: null };
}

const g = (group: string, position: 1 | 2): KnockoutSlot => ({ type: "group", group, position });
const t = (possibleGroups: string[]): KnockoutSlot => ({ type: "best_third", possibleGroups });
const w = (matchId: string): KnockoutSlot => ({ type: "winner", matchId });
const l = (matchId: string): KnockoutSlot => ({ type: "loser", matchId });

export const INITIAL_KNOCKOUT_MATCHES: KnockoutMatch[] = [
  // Round of 32 (16 matches)
  km("R32-1", "R32", g("A", 2), g("B", 2), "2026-06-28T20:00:00Z", "SoFi Stadium, Inglewood"),
  km("R32-2", "R32", g("E", 1), t(["A","B","C","D","F"]), "2026-06-29T17:00:00Z", "Gillette Stadium, Foxborough"),
  km("R32-3", "R32", g("F", 1), g("C", 2), "2026-06-29T20:00:00Z", "Estadio BBVA, Monterrey"),
  km("R32-4", "R32", g("C", 1), g("F", 2), "2026-06-29T23:00:00Z", "NRG Stadium, Houston"),
  km("R32-5", "R32", g("I", 1), t(["C","D","F","G","H"]), "2026-06-30T17:00:00Z", "MetLife Stadium, East Rutherford"),
  km("R32-6", "R32", g("E", 2), g("I", 2), "2026-06-30T20:00:00Z", "AT&T Stadium, Arlington"),
  km("R32-7", "R32", g("A", 1), t(["C","E","F","H","I"]), "2026-06-30T23:00:00Z", "Estadio Azteca, Ciudad de México"),
  km("R32-8", "R32", g("L", 1), t(["E","H","I","J","K"]), "2026-07-01T17:00:00Z", "Mercedes-Benz Stadium, Atlanta"),
  km("R32-9", "R32", g("D", 1), t(["B","E","F","I","J"]), "2026-07-01T20:00:00Z", "Levi's Stadium, Santa Clara"),
  km("R32-10", "R32", g("G", 1), t(["A","E","H","I","J"]), "2026-07-01T23:00:00Z", "Lumen Field, Seattle"),
  km("R32-11", "R32", g("K", 2), g("L", 2), "2026-07-02T17:00:00Z", "BMO Field, Toronto"),
  km("R32-12", "R32", g("H", 1), g("J", 2), "2026-07-02T20:00:00Z", "SoFi Stadium, Inglewood"),
  km("R32-13", "R32", g("B", 1), t(["E","F","G","I","J"]), "2026-07-02T23:00:00Z", "BC Place, Vancouver"),
  km("R32-14", "R32", g("J", 1), g("H", 2), "2026-07-03T17:00:00Z", "Hard Rock Stadium, Miami"),
  km("R32-15", "R32", g("K", 1), t(["D","E","I","J","L"]), "2026-07-03T20:00:00Z", "Arrowhead Stadium, Kansas City"),
  km("R32-16", "R32", g("D", 2), g("G", 2), "2026-07-03T23:00:00Z", "AT&T Stadium, Arlington"),
  // Round of 16 (8 matches)
  km("R16-1", "R16", w("R32-1"), w("R32-3"), "2026-07-04T20:00:00Z", "NRG Stadium, Houston"),
  km("R16-2", "R16", w("R32-2"), w("R32-5"), "2026-07-04T23:00:00Z", "Lincoln Financial Field, Philadelphia"),
  km("R16-3", "R16", w("R32-4"), w("R32-6"), "2026-07-05T20:00:00Z", "MetLife Stadium, East Rutherford"),
  km("R16-4", "R16", w("R32-7"), w("R32-8"), "2026-07-05T23:00:00Z", "Estadio Azteca, Ciudad de México"),
  km("R16-5", "R16", w("R32-9"), w("R32-10"), "2026-07-06T20:00:00Z", "Lumen Field, Seattle"),
  km("R16-6", "R16", w("R32-11"), w("R32-12"), "2026-07-06T23:00:00Z", "AT&T Stadium, Arlington"),
  km("R16-7", "R16", w("R32-13"), w("R32-15"), "2026-07-07T20:00:00Z", "BC Place, Vancouver"),
  km("R16-8", "R16", w("R32-14"), w("R32-16"), "2026-07-07T23:00:00Z", "Mercedes-Benz Stadium, Atlanta"),
  // Quarterfinals (4 matches)
  km("QF-1", "QF", w("R16-1"), w("R16-2"), "2026-07-09T20:00:00Z", "Gillette Stadium, Foxborough"),
  km("QF-2", "QF", w("R16-5"), w("R16-6"), "2026-07-10T20:00:00Z", "SoFi Stadium, Inglewood"),
  km("QF-3", "QF", w("R16-3"), w("R16-4"), "2026-07-11T20:00:00Z", "Hard Rock Stadium, Miami"),
  km("QF-4", "QF", w("R16-7"), w("R16-8"), "2026-07-11T23:00:00Z", "Arrowhead Stadium, Kansas City"),
  // Semifinals (2 matches)
  km("SF-1", "SF", w("QF-1"), w("QF-2"), "2026-07-14T23:00:00Z", "AT&T Stadium, Arlington"),
  km("SF-2", "SF", w("QF-3"), w("QF-4"), "2026-07-15T23:00:00Z", "Mercedes-Benz Stadium, Atlanta"),
  // Third-place match
  km("3P", "3P", l("SF-1"), l("SF-2"), "2026-07-18T20:00:00Z", "Hard Rock Stadium, Miami"),
  // Final
  km("F", "F", w("SF-1"), w("SF-2"), "2026-07-19T20:00:00Z", "MetLife Stadium, East Rutherford"),
];
