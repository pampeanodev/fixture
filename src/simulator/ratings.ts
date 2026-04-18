/** Tier-based team strength ratings for result simulation. Values in [0, 1]. */

const TIER_S = ["ARG", "BRA", "FRA", "ESP", "ENG"];
const TIER_A = ["GER", "POR", "NED", "BEL", "URU", "CRO"];
const TIER_B = [
  "COL", "MEX", "USA", "MAR", "SUI", "JPN", "SEN",
  "KOR", "AUT", "ECU", "AUS",
];
const TIER_C = [
  "CZE", "TUR", "PAR", "CAN", "SCO", "NOR", "EGY",
  "GHA",
];
const TIER_D = [
  "HAI", "BIH", "CUW", "QAT", "RSA", "PAN", "NZL",
  "UZB",
];
const TIER_E = ["CPV"];

export function getRating(teamId: string): number {
  if (TIER_S.includes(teamId)) return 0.92;
  if (TIER_A.includes(teamId)) return 0.82;
  if (TIER_B.includes(teamId)) return 0.70;
  if (TIER_C.includes(teamId)) return 0.58;
  if (TIER_D.includes(teamId)) return 0.46;
  if (TIER_E.includes(teamId)) return 0.34;
  return 0.55;
}
