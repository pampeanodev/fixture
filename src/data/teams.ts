// src/data/teams.ts
import type { Team } from "../types";

export const TEAM_IDS = [
  "MEX", "RSA", "KOR", "CZE",
  "CAN", "SUI", "QAT", "BIH",
  "BRA", "MAR", "HAI", "SCO",
  "USA", "PAR", "AUS", "TUR",
  "GER", "CUW", "CIV", "ECU",
  "NED", "JPN", "TUN", "SWE",
  "BEL", "EGY", "IRN", "NZL",
  "ESP", "CPV", "KSA", "URU",
  "FRA", "SEN", "NOR", "IRQ",
  "ARG", "ALG", "AUT", "JOR",
  "POR", "UZB", "COL", "COD",
  "ENG", "CRO", "GHA", "PAN",
] as const;

export const TEAMS: readonly Team[] = [
  // Group A
  { id: "MEX", flag: "🇲🇽", group: "A" },
  { id: "RSA", flag: "🇿🇦", group: "A" },
  { id: "KOR", flag: "🇰🇷", group: "A" },
  { id: "CZE", flag: "🇨🇿", group: "A" },
  // Group B
  { id: "CAN", flag: "🇨🇦", group: "B" },
  { id: "SUI", flag: "🇨🇭", group: "B" },
  { id: "QAT", flag: "🇶🇦", group: "B" },
  { id: "BIH", flag: "🇧🇦", group: "B" },
  // Group C
  { id: "BRA", flag: "🇧🇷", group: "C" },
  { id: "MAR", flag: "🇲🇦", group: "C" },
  { id: "HAI", flag: "🇭🇹", group: "C" },
  { id: "SCO", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", group: "C" },
  // Group D
  { id: "USA", flag: "🇺🇸", group: "D" },
  { id: "PAR", flag: "🇵🇾", group: "D" },
  { id: "AUS", flag: "🇦🇺", group: "D" },
  { id: "TUR", flag: "🇹🇷", group: "D" },
  // Group E
  { id: "GER", flag: "🇩🇪", group: "E" },
  { id: "CUW", flag: "🇨🇼", group: "E" },
  { id: "CIV", flag: "🇨🇮", group: "E" },
  { id: "ECU", flag: "🇪🇨", group: "E" },
  // Group F
  { id: "NED", flag: "🇳🇱", group: "F" },
  { id: "JPN", flag: "🇯🇵", group: "F" },
  { id: "TUN", flag: "🇹🇳", group: "F" },
  { id: "SWE", flag: "🇸🇪", group: "F" },
  // Group G
  { id: "BEL", flag: "🇧🇪", group: "G" },
  { id: "EGY", flag: "🇪🇬", group: "G" },
  { id: "IRN", flag: "🇮🇷", group: "G" },
  { id: "NZL", flag: "🇳🇿", group: "G" },
  // Group H
  { id: "ESP", flag: "🇪🇸", group: "H" },
  { id: "CPV", flag: "🇨🇻", group: "H" },
  { id: "KSA", flag: "🇸🇦", group: "H" },
  { id: "URU", flag: "🇺🇾", group: "H" },
  // Group I
  { id: "FRA", flag: "🇫🇷", group: "I" },
  { id: "SEN", flag: "🇸🇳", group: "I" },
  { id: "NOR", flag: "🇳🇴", group: "I" },
  { id: "IRQ", flag: "🇮🇶", group: "I" },
  // Group J
  { id: "ARG", flag: "🇦🇷", group: "J" },
  { id: "ALG", flag: "🇩🇿", group: "J" },
  { id: "AUT", flag: "🇦🇹", group: "J" },
  { id: "JOR", flag: "🇯🇴", group: "J" },
  // Group K
  { id: "POR", flag: "🇵🇹", group: "K" },
  { id: "UZB", flag: "🇺🇿", group: "K" },
  { id: "COL", flag: "🇨🇴", group: "K" },
  { id: "COD", flag: "🇨🇩", group: "K" },
  // Group L
  { id: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", group: "L" },
  { id: "CRO", flag: "🇭🇷", group: "L" },
  { id: "GHA", flag: "🇬🇭", group: "L" },
  { id: "PAN", flag: "🇵🇦", group: "L" },
];

export function getTeam(id: string): Team | undefined {
  return TEAMS.find((t) => t.id === id);
}

export const GROUPS = ["A","B","C","D","E","F","G","H","I","J","K","L"] as const;
