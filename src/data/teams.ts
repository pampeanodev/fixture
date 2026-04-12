// src/data/teams.ts
import { Team } from "../types";

export const TEAMS: Team[] = [
  // Group A
  { id: "MEX", name: "México", flag: "🇲🇽", group: "A" },
  { id: "RSA", name: "Sudáfrica", flag: "🇿🇦", group: "A" },
  { id: "KOR", name: "Corea del Sur", flag: "🇰🇷", group: "A" },
  { id: "CZE", name: "Chequia", flag: "🇨🇿", group: "A" },
  // Group B
  { id: "CAN", name: "Canadá", flag: "🇨🇦", group: "B" },
  { id: "SUI", name: "Suiza", flag: "🇨🇭", group: "B" },
  { id: "QAT", name: "Qatar", flag: "🇶🇦", group: "B" },
  { id: "BIH", name: "Bosnia y Herzegovina", flag: "🇧🇦", group: "B" },
  // Group C
  { id: "BRA", name: "Brasil", flag: "🇧🇷", group: "C" },
  { id: "MAR", name: "Marruecos", flag: "🇲🇦", group: "C" },
  { id: "HAI", name: "Haití", flag: "🇭🇹", group: "C" },
  { id: "SCO", name: "Escocia", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", group: "C" },
  // Group D
  { id: "USA", name: "Estados Unidos", flag: "🇺🇸", group: "D" },
  { id: "PAR", name: "Paraguay", flag: "🇵🇾", group: "D" },
  { id: "AUS", name: "Australia", flag: "🇦🇺", group: "D" },
  { id: "TUR", name: "Turquía", flag: "🇹🇷", group: "D" },
  // Group E
  { id: "GER", name: "Alemania", flag: "🇩🇪", group: "E" },
  { id: "CUW", name: "Curazao", flag: "🇨🇼", group: "E" },
  { id: "CIV", name: "Costa de Marfil", flag: "🇨🇮", group: "E" },
  { id: "ECU", name: "Ecuador", flag: "🇪🇨", group: "E" },
  // Group F
  { id: "NED", name: "Países Bajos", flag: "🇳🇱", group: "F" },
  { id: "JPN", name: "Japón", flag: "🇯🇵", group: "F" },
  { id: "TUN", name: "Túnez", flag: "🇹🇳", group: "F" },
  { id: "SWE", name: "Suecia", flag: "🇸🇪", group: "F" },
  // Group G
  { id: "BEL", name: "Bélgica", flag: "🇧🇪", group: "G" },
  { id: "EGY", name: "Egipto", flag: "🇪🇬", group: "G" },
  { id: "IRN", name: "Irán", flag: "🇮🇷", group: "G" },
  { id: "NZL", name: "Nueva Zelanda", flag: "🇳🇿", group: "G" },
  // Group H
  { id: "ESP", name: "España", flag: "🇪🇸", group: "H" },
  { id: "CPV", name: "Cabo Verde", flag: "🇨🇻", group: "H" },
  { id: "KSA", name: "Arabia Saudita", flag: "🇸🇦", group: "H" },
  { id: "URU", name: "Uruguay", flag: "🇺🇾", group: "H" },
  // Group I
  { id: "FRA", name: "Francia", flag: "🇫🇷", group: "I" },
  { id: "SEN", name: "Senegal", flag: "🇸🇳", group: "I" },
  { id: "NOR", name: "Noruega", flag: "🇳🇴", group: "I" },
  { id: "IRQ", name: "Irak", flag: "🇮🇶", group: "I" },
  // Group J
  { id: "ARG", name: "Argentina", flag: "🇦🇷", group: "J" },
  { id: "ALG", name: "Argelia", flag: "🇩🇿", group: "J" },
  { id: "AUT", name: "Austria", flag: "🇦🇹", group: "J" },
  { id: "JOR", name: "Jordania", flag: "🇯🇴", group: "J" },
  // Group K
  { id: "POR", name: "Portugal", flag: "🇵🇹", group: "K" },
  { id: "UZB", name: "Uzbekistán", flag: "🇺🇿", group: "K" },
  { id: "COL", name: "Colombia", flag: "🇨🇴", group: "K" },
  { id: "COD", name: "RD Congo", flag: "🇨🇩", group: "K" },
  // Group L
  { id: "ENG", name: "Inglaterra", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", group: "L" },
  { id: "CRO", name: "Croacia", flag: "🇭🇷", group: "L" },
  { id: "GHA", name: "Ghana", flag: "🇬🇭", group: "L" },
  { id: "PAN", name: "Panamá", flag: "🇵🇦", group: "L" },
];

export function getTeam(id: string): Team | undefined {
  return TEAMS.find((t) => t.id === id);
}

export const GROUPS = ["A","B","C","D","E","F","G","H","I","J","K","L"] as const;
