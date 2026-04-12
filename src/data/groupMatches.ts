// src/data/groupMatches.ts
import type { GroupMatch } from "../types";

function gm(
  id: string,
  group: string,
  home: string,
  away: string,
  dateUtc: string,
  venue: string
): GroupMatch {
  return { id, group, homeTeamId: home, awayTeamId: away, dateUtc, venue, result: null, prediction: null };
}

export const INITIAL_GROUP_MATCHES: GroupMatch[] = [
  // Group A
  gm("G-A-1", "A", "MEX", "RSA", "2026-06-11T19:00:00Z", "Estadio Azteca, Ciudad de México"),
  gm("G-A-2", "A", "KOR", "CZE", "2026-06-12T02:00:00Z", "Estadio Akron, Guadalajara"),
  gm("G-A-3", "A", "CZE", "RSA", "2026-06-18T16:00:00Z", "Mercedes-Benz Stadium, Atlanta"),
  gm("G-A-4", "A", "MEX", "KOR", "2026-06-19T01:00:00Z", "Estadio Akron, Guadalajara"),
  gm("G-A-5", "A", "CZE", "MEX", "2026-06-25T01:00:00Z", "Estadio Azteca, Ciudad de México"),
  gm("G-A-6", "A", "RSA", "KOR", "2026-06-25T01:00:00Z", "Estadio BBVA, Monterrey"),
  // Group B
  gm("G-B-1", "B", "CAN", "BIH", "2026-06-12T19:00:00Z", "BMO Field, Toronto"),
  gm("G-B-2", "B", "QAT", "SUI", "2026-06-13T19:00:00Z", "Levi's Stadium, Santa Clara"),
  gm("G-B-3", "B", "SUI", "BIH", "2026-06-18T19:00:00Z", "SoFi Stadium, Inglewood"),
  gm("G-B-4", "B", "CAN", "QAT", "2026-06-18T22:00:00Z", "BC Place, Vancouver"),
  gm("G-B-5", "B", "SUI", "CAN", "2026-06-24T19:00:00Z", "BC Place, Vancouver"),
  gm("G-B-6", "B", "BIH", "QAT", "2026-06-24T19:00:00Z", "Lumen Field, Seattle"),
  // Group C
  gm("G-C-1", "C", "BRA", "MAR", "2026-06-13T22:00:00Z", "MetLife Stadium, East Rutherford"),
  gm("G-C-2", "C", "HAI", "SCO", "2026-06-14T01:00:00Z", "Gillette Stadium, Foxborough"),
  gm("G-C-3", "C", "SCO", "MAR", "2026-06-19T22:00:00Z", "Gillette Stadium, Foxborough"),
  gm("G-C-4", "C", "BRA", "HAI", "2026-06-20T00:30:00Z", "Lincoln Financial Field, Philadelphia"),
  gm("G-C-5", "C", "SCO", "BRA", "2026-06-24T22:00:00Z", "Hard Rock Stadium, Miami"),
  gm("G-C-6", "C", "MAR", "HAI", "2026-06-24T22:00:00Z", "Mercedes-Benz Stadium, Atlanta"),
  // Group D
  gm("G-D-1", "D", "USA", "PAR", "2026-06-13T01:00:00Z", "SoFi Stadium, Inglewood"),
  gm("G-D-2", "D", "AUS", "TUR", "2026-06-13T04:00:00Z", "BC Place, Vancouver"),
  gm("G-D-3", "D", "USA", "AUS", "2026-06-19T19:00:00Z", "Lumen Field, Seattle"),
  gm("G-D-4", "D", "TUR", "PAR", "2026-06-20T03:00:00Z", "Levi's Stadium, Santa Clara"),
  gm("G-D-5", "D", "TUR", "USA", "2026-06-26T02:00:00Z", "SoFi Stadium, Inglewood"),
  gm("G-D-6", "D", "PAR", "AUS", "2026-06-26T02:00:00Z", "Levi's Stadium, Santa Clara"),
  // Group E
  gm("G-E-1", "E", "GER", "CUW", "2026-06-14T17:00:00Z", "NRG Stadium, Houston"),
  gm("G-E-2", "E", "CIV", "ECU", "2026-06-14T23:00:00Z", "Lincoln Financial Field, Philadelphia"),
  gm("G-E-3", "E", "GER", "CIV", "2026-06-20T20:00:00Z", "BMO Field, Toronto"),
  gm("G-E-4", "E", "ECU", "CUW", "2026-06-21T00:00:00Z", "Arrowhead Stadium, Kansas City"),
  gm("G-E-5", "E", "CUW", "CIV", "2026-06-25T20:00:00Z", "Lincoln Financial Field, Philadelphia"),
  gm("G-E-6", "E", "ECU", "GER", "2026-06-25T20:00:00Z", "MetLife Stadium, East Rutherford"),
  // Group F
  gm("G-F-1", "F", "NED", "JPN", "2026-06-14T20:00:00Z", "AT&T Stadium, Arlington"),
  gm("G-F-2", "F", "SWE", "TUN", "2026-06-15T02:00:00Z", "Estadio BBVA, Monterrey"),
  gm("G-F-3", "F", "NED", "SWE", "2026-06-20T17:00:00Z", "NRG Stadium, Houston"),
  gm("G-F-4", "F", "TUN", "JPN", "2026-06-21T04:00:00Z", "Estadio BBVA, Monterrey"),
  gm("G-F-5", "F", "JPN", "SWE", "2026-06-25T23:00:00Z", "AT&T Stadium, Arlington"),
  gm("G-F-6", "F", "TUN", "NED", "2026-06-25T23:00:00Z", "Arrowhead Stadium, Kansas City"),
  // Group G
  gm("G-G-1", "G", "BEL", "EGY", "2026-06-15T19:00:00Z", "Lumen Field, Seattle"),
  gm("G-G-2", "G", "IRN", "NZL", "2026-06-16T01:00:00Z", "SoFi Stadium, Inglewood"),
  gm("G-G-3", "G", "BEL", "IRN", "2026-06-21T19:00:00Z", "SoFi Stadium, Inglewood"),
  gm("G-G-4", "G", "NZL", "EGY", "2026-06-22T01:00:00Z", "BC Place, Vancouver"),
  gm("G-G-5", "G", "EGY", "IRN", "2026-06-27T03:00:00Z", "Lumen Field, Seattle"),
  gm("G-G-6", "G", "NZL", "BEL", "2026-06-27T03:00:00Z", "BC Place, Vancouver"),
  // Group H
  gm("G-H-1", "H", "ESP", "CPV", "2026-06-15T16:00:00Z", "Mercedes-Benz Stadium, Atlanta"),
  gm("G-H-2", "H", "KSA", "URU", "2026-06-15T22:00:00Z", "Hard Rock Stadium, Miami"),
  gm("G-H-3", "H", "ESP", "KSA", "2026-06-21T16:00:00Z", "Mercedes-Benz Stadium, Atlanta"),
  gm("G-H-4", "H", "URU", "CPV", "2026-06-21T22:00:00Z", "Hard Rock Stadium, Miami"),
  gm("G-H-5", "H", "CPV", "KSA", "2026-06-27T00:00:00Z", "NRG Stadium, Houston"),
  gm("G-H-6", "H", "URU", "ESP", "2026-06-27T00:00:00Z", "Estadio Akron, Guadalajara"),
  // Group I
  gm("G-I-1", "I", "FRA", "SEN", "2026-06-16T19:00:00Z", "MetLife Stadium, East Rutherford"),
  gm("G-I-2", "I", "IRQ", "NOR", "2026-06-16T22:00:00Z", "Gillette Stadium, Foxborough"),
  gm("G-I-3", "I", "FRA", "IRQ", "2026-06-22T21:00:00Z", "Lincoln Financial Field, Philadelphia"),
  gm("G-I-4", "I", "NOR", "SEN", "2026-06-23T00:00:00Z", "MetLife Stadium, East Rutherford"),
  gm("G-I-5", "I", "NOR", "FRA", "2026-06-26T19:00:00Z", "Gillette Stadium, Foxborough"),
  gm("G-I-6", "I", "SEN", "IRQ", "2026-06-26T19:00:00Z", "BMO Field, Toronto"),
  // Group J
  gm("G-J-1", "J", "ARG", "ALG", "2026-06-17T01:00:00Z", "Arrowhead Stadium, Kansas City"),
  gm("G-J-2", "J", "AUT", "JOR", "2026-06-17T04:00:00Z", "Levi's Stadium, Santa Clara"),
  gm("G-J-3", "J", "ARG", "AUT", "2026-06-22T17:00:00Z", "AT&T Stadium, Arlington"),
  gm("G-J-4", "J", "JOR", "ALG", "2026-06-23T03:00:00Z", "Levi's Stadium, Santa Clara"),
  gm("G-J-5", "J", "JOR", "ARG", "2026-06-28T02:00:00Z", "AT&T Stadium, Arlington"),
  gm("G-J-6", "J", "ALG", "AUT", "2026-06-28T02:00:00Z", "Arrowhead Stadium, Kansas City"),
  // Group K
  gm("G-K-1", "K", "POR", "COD", "2026-06-17T17:00:00Z", "NRG Stadium, Houston"),
  gm("G-K-2", "K", "UZB", "COL", "2026-06-18T02:00:00Z", "Estadio Azteca, Ciudad de México"),
  gm("G-K-3", "K", "POR", "UZB", "2026-06-23T17:00:00Z", "NRG Stadium, Houston"),
  gm("G-K-4", "K", "COL", "COD", "2026-06-24T02:00:00Z", "Estadio Akron, Guadalajara"),
  gm("G-K-5", "K", "COL", "POR", "2026-06-27T23:30:00Z", "Hard Rock Stadium, Miami"),
  gm("G-K-6", "K", "COD", "UZB", "2026-06-27T23:30:00Z", "Mercedes-Benz Stadium, Atlanta"),
  // Group L
  gm("G-L-1", "L", "ENG", "CRO", "2026-06-17T20:00:00Z", "AT&T Stadium, Arlington"),
  gm("G-L-2", "L", "GHA", "PAN", "2026-06-17T23:00:00Z", "BMO Field, Toronto"),
  gm("G-L-3", "L", "ENG", "GHA", "2026-06-23T20:00:00Z", "Gillette Stadium, Foxborough"),
  gm("G-L-4", "L", "PAN", "CRO", "2026-06-23T23:00:00Z", "BMO Field, Toronto"),
  gm("G-L-5", "L", "PAN", "ENG", "2026-06-27T21:00:00Z", "MetLife Stadium, East Rutherford"),
  gm("G-L-6", "L", "CRO", "GHA", "2026-06-27T21:00:00Z", "Lincoln Financial Field, Philadelphia"),
];
