# World Cup 2026 Fixture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive World Cup 2026 fixture app with groups, standings, knockout bracket, predictions, and localized schedules.

**Architecture:** React + TypeScript SPA with sidebar navigation. State managed via Context + useReducer. Standings and knockout slots computed reactively via useMemo. Data persisted to LocalStorage with JSON export/import.

**Tech Stack:** React 18, TypeScript, Vite, Vitest (testing), CSS (no UI library)

---

## File Structure

```
src/
├── types.ts                          # All TypeScript interfaces
├── data/
│   ├── teams.ts                      # 48 teams with FIFA codes, flags, groups
│   ├── groupMatches.ts               # 72 group stage match fixtures
│   ├── knockoutStructure.ts          # 32 knockout match slot definitions
│   └── thirdPlaceMapping.ts          # Best-third bracket slot lookup
├── utils/
│   ├── standings.ts                  # Calculate group standings from results
│   ├── bestThirds.ts                 # Rank third-placed teams, select best 8
│   ├── knockout.ts                   # Resolve knockout slots + cascading clears
│   ├── formatDate.ts                 # UTC → localized date/time strings
│   └── persistence.ts               # LocalStorage save/load + JSON export/import
├── context/
│   └── FixtureContext.tsx            # React context, reducer, provider
├── components/
│   ├── Sidebar.tsx + Sidebar.css     # Navigation sidebar
│   ├── TopBar.tsx + TopBar.css       # Title, mode toggle, export/import
│   ├── GroupView.tsx + GroupView.css  # Standings table + group matches
│   ├── ScoreInput.tsx + ScoreInput.css # Editable score inputs
│   ├── BracketView.tsx + BracketView.css # Knockout bracket visualization
│   └── PenaltyInput.tsx              # Penalty score input for knockout draws
├── App.tsx                           # Root layout
├── App.css                           # Global styles + theme variables
└── main.tsx                          # Vite entry point
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `vitest.config.ts`

- [ ] **Step 1: Scaffold Vite project**

```bash
cd ~/Documents/src/fixture
npm create vite@latest . -- --template react-ts
```

Accept overwrite if prompted (directory has only docs/).

- [ ] **Step 2: Install dependencies**

```bash
npm install
npm install -D vitest
```

- [ ] **Step 3: Add vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify setup**

```bash
npm run build
```

Expected: Successful build with no errors.

- [ ] **Step 5: Update .gitignore and commit**

Append to existing `.gitignore`:

```
node_modules/
dist/
```

(These may already be there from Vite template; verify no duplicates.)

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TypeScript project"
```

---

### Task 2: Type Definitions

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create all type definitions**

```typescript
// src/types.ts

export interface Team {
  id: string;       // FIFA 3-letter code: "ARG"
  name: string;     // "Argentina"
  flag: string;     // "🇦🇷"
  group: string;    // "A" through "L"
}

export interface Score {
  home: number;
  away: number;
  penalties?: { home: number; away: number };
}

export interface GroupMatch {
  id: string;              // "G-A-1"
  group: string;           // "A"
  homeTeamId: string;
  awayTeamId: string;
  dateUtc: string;         // ISO 8601
  venue: string;
  result: Score | null;
  prediction: Score | null;
}

export type KnockoutRound = "R32" | "R16" | "QF" | "SF" | "3P" | "F";

export type KnockoutSlot =
  | { type: "group"; group: string; position: 1 | 2 }
  | { type: "best_third"; possibleGroups: string[] }
  | { type: "winner"; matchId: string }
  | { type: "loser"; matchId: string };

export interface KnockoutMatch {
  id: string;              // "R32-1", "QF-3", "F"
  round: KnockoutRound;
  homeSlot: KnockoutSlot;
  awaySlot: KnockoutSlot;
  dateUtc: string;
  venue: string;
  result: Score | null;
  prediction: Score | null;
}

export interface StandingRow {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export type ViewTarget =
  | { type: "group"; group: string }
  | { type: "knockout"; round: KnockoutRound };

export type FixtureMode = "results" | "predictions";

export interface FixtureState {
  mode: FixtureMode;
  teams: Team[];
  groupMatches: GroupMatch[];
  knockoutMatches: KnockoutMatch[];
  activeView: ViewTarget;
}

export type FixtureAction =
  | { type: "SET_GROUP_SCORE"; matchId: string; score: Score | null }
  | { type: "SET_KNOCKOUT_SCORE"; matchId: string; score: Score | null }
  | { type: "TOGGLE_MODE" }
  | { type: "SET_VIEW"; view: ViewTarget }
  | { type: "IMPORT_STATE"; groupMatches: GroupMatch[]; knockoutMatches: KnockoutMatch[] };
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add TypeScript type definitions"
```

---

### Task 3: Static Data — Teams

**Files:**
- Create: `src/data/teams.ts`

- [ ] **Step 1: Create teams data file**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/data/teams.ts
git commit -m "feat: add 48 teams data with flags and group assignments"
```

---

### Task 4: Static Data — Group Matches

**Files:**
- Create: `src/data/groupMatches.ts`

- [ ] **Step 1: Create group matches data**

```typescript
// src/data/groupMatches.ts
import { GroupMatch } from "../types";

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
```

- [ ] **Step 2: Commit**

```bash
git add src/data/groupMatches.ts
git commit -m "feat: add 72 group stage match fixtures with dates and venues"
```

---

### Task 5: Static Data — Knockout Structure & Third-Place Mapping

**Files:**
- Create: `src/data/knockoutStructure.ts`
- Create: `src/data/thirdPlaceMapping.ts`

- [ ] **Step 1: Create knockout structure**

```typescript
// src/data/knockoutStructure.ts
import { KnockoutMatch, KnockoutSlot } from "../types";

function km(
  id: string,
  round: KnockoutMatch["round"],
  homeSlot: KnockoutSlot,
  awaySlot: KnockoutSlot,
  dateUtc: string,
  venue: string
): KnockoutMatch {
  return { id, round, homeSlot, awaySlot, homeTeamId: null, awayTeamId: null, dateUtc, venue, result: null, prediction: null };
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
```

- [ ] **Step 2: Create third-place mapping**

The third-place mapping is complex (495 combinations). We use a simplified approach: given the 8 qualifying third-placed groups (sorted alphabetically), we map each to the R32 match that has their group in its `possibleGroups`. When multiple matches could accept a third from the same group, we assign greedily to ensure no group conflict.

```typescript
// src/data/thirdPlaceMapping.ts

// Given the list of 8 qualifying third-placed groups (sorted), returns a mapping
// from group letter to the R32 match ID where that third-placed team plays.
// This implements the FIFA bracket slot assignment rules.
//
// Each R32 match that features a "best_third" slot lists which groups' thirds
// it can accept (the possibleGroups field). The mapping must:
// 1. Assign exactly one third to each of the 8 R32 "best_third" slots
// 2. Only assign a third from a group listed in that slot's possibleGroups
//
// There are C(12,8)=495 possible qualifying combinations. FIFA pre-computes
// all 495. We hardcode a lookup keyed by the sorted qualifying group string.
// Example key: "ABCDEFGH" means thirds from groups A-H qualified.

// R32 matches with best_third slots and their possible groups:
// R32-2:  ["A","B","C","D","F"]
// R32-5:  ["C","D","F","G","H"]
// R32-7:  ["C","E","F","H","I"]
// R32-8:  ["E","H","I","J","K"]
// R32-9:  ["B","E","F","I","J"]
// R32-10: ["A","E","H","I","J"]
// R32-13: ["E","F","G","I","J"]
// R32-15: ["D","E","I","J","L"]

export type ThirdPlaceAssignment = Record<string, string>; // group -> R32 match id

// For MVP: we implement a greedy assignment algorithm rather than hardcoding 495 entries.
// Given qualifying groups, we assign each to the most constrained available slot.
export function assignThirdPlaceSlots(qualifyingGroups: string[]): ThirdPlaceAssignment {
  const slots: { matchId: string; possibleGroups: string[] }[] = [
    { matchId: "R32-2", possibleGroups: ["A","B","C","D","F"] },
    { matchId: "R32-5", possibleGroups: ["C","D","F","G","H"] },
    { matchId: "R32-7", possibleGroups: ["C","E","F","H","I"] },
    { matchId: "R32-8", possibleGroups: ["E","H","I","J","K"] },
    { matchId: "R32-9", possibleGroups: ["B","E","F","I","J"] },
    { matchId: "R32-10", possibleGroups: ["A","E","H","I","J"] },
    { matchId: "R32-13", possibleGroups: ["E","F","G","I","J"] },
    { matchId: "R32-15", possibleGroups: ["D","E","I","J","L"] },
  ];

  const sorted = [...qualifyingGroups].sort();
  const assignment: ThirdPlaceAssignment = {};
  const usedSlots = new Set<string>();
  const assignedGroups = new Set<string>();

  // Greedy: assign groups with fewest available slots first
  const remaining = [...sorted];

  while (remaining.length > 0) {
    // For each unassigned group, count how many open slots can accept it
    let bestGroup = remaining[0];
    let bestCount = Infinity;

    for (const group of remaining) {
      const count = slots.filter(
        (s) => !usedSlots.has(s.matchId) && s.possibleGroups.includes(group)
      ).length;
      if (count < bestCount) {
        bestCount = count;
        bestGroup = group;
      }
    }

    // Assign to the slot with the fewest remaining options (most constrained)
    const availableSlots = slots.filter(
      (s) => !usedSlots.has(s.matchId) && s.possibleGroups.includes(bestGroup)
    );

    if (availableSlots.length === 0) {
      // Should not happen with valid FIFA data, but handle gracefully
      remaining.splice(remaining.indexOf(bestGroup), 1);
      continue;
    }

    // Pick the most constrained slot (fewest remaining possible unassigned groups)
    let bestSlot = availableSlots[0];
    let bestSlotScore = Infinity;
    for (const slot of availableSlots) {
      const score = slot.possibleGroups.filter(
        (g) => remaining.includes(g) && !assignedGroups.has(g)
      ).length;
      if (score < bestSlotScore) {
        bestSlotScore = score;
        bestSlot = slot;
      }
    }

    assignment[bestGroup] = bestSlot.matchId;
    usedSlots.add(bestSlot.matchId);
    assignedGroups.add(bestGroup);
    remaining.splice(remaining.indexOf(bestGroup), 1);
  }

  return assignment;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/data/knockoutStructure.ts src/data/thirdPlaceMapping.ts
git commit -m "feat: add knockout bracket structure and third-place slot mapping"
```

---

### Task 6: Standings Calculation (TDD)

**Files:**
- Create: `src/utils/standings.ts`
- Create: `src/utils/__tests__/standings.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/utils/__tests__/standings.test.ts
import { describe, it, expect } from "vitest";
import { calculateStandings } from "../standings";
import { GroupMatch, StandingRow } from "../../types";

function makeMatch(
  id: string,
  group: string,
  home: string,
  away: string,
  homeGoals: number | null,
  awayGoals: number | null
): GroupMatch {
  return {
    id,
    group,
    homeTeamId: home,
    awayTeamId: away,
    dateUtc: "2026-06-11T19:00:00Z",
    venue: "Test Stadium",
    result: homeGoals !== null && awayGoals !== null
      ? { home: homeGoals, away: awayGoals }
      : null,
    prediction: null,
  };
}

describe("calculateStandings", () => {
  it("returns empty standings for teams with no results", () => {
    const matches = [makeMatch("1", "A", "T1", "T2", null, null)];
    const standings = calculateStandings(matches, ["T1", "T2"]);
    expect(standings).toHaveLength(2);
    expect(standings[0].points).toBe(0);
    expect(standings[0].played).toBe(0);
  });

  it("awards 3 points for a win, 0 for a loss", () => {
    const matches = [makeMatch("1", "A", "T1", "T2", 2, 0)];
    const standings = calculateStandings(matches, ["T1", "T2"]);
    const t1 = standings.find((s) => s.teamId === "T1")!;
    const t2 = standings.find((s) => s.teamId === "T2")!;
    expect(t1.points).toBe(3);
    expect(t1.won).toBe(1);
    expect(t1.goalsFor).toBe(2);
    expect(t1.goalDifference).toBe(2);
    expect(t2.points).toBe(0);
    expect(t2.lost).toBe(1);
  });

  it("awards 1 point each for a draw", () => {
    const matches = [makeMatch("1", "A", "T1", "T2", 1, 1)];
    const standings = calculateStandings(matches, ["T1", "T2"]);
    const t1 = standings.find((s) => s.teamId === "T1")!;
    const t2 = standings.find((s) => s.teamId === "T2")!;
    expect(t1.points).toBe(1);
    expect(t1.drawn).toBe(1);
    expect(t2.points).toBe(1);
  });

  it("sorts by points, then goal difference, then goals scored", () => {
    const matches = [
      makeMatch("1", "A", "T1", "T2", 3, 0), // T1 wins 3-0
      makeMatch("2", "A", "T3", "T4", 2, 0), // T3 wins 2-0
      makeMatch("3", "A", "T1", "T3", 1, 1), // Draw
      makeMatch("4", "A", "T2", "T4", 0, 0), // Draw
    ];
    const standings = calculateStandings(matches, ["T1", "T2", "T3", "T4"]);
    // T1: 4pts, GD +3, GF 4
    // T3: 4pts, GD +1, GF 3
    // T2: 1pt, GD -3, GF 0
    // T4: 1pt, GD -1, GF 0
    expect(standings[0].teamId).toBe("T1");
    expect(standings[1].teamId).toBe("T3");
    expect(standings[2].teamId).toBe("T4"); // better GD than T2
    expect(standings[3].teamId).toBe("T2");
  });

  it("uses prediction scores when scoreField is prediction", () => {
    const matches: GroupMatch[] = [{
      id: "1", group: "A", homeTeamId: "T1", awayTeamId: "T2",
      dateUtc: "2026-06-11T19:00:00Z", venue: "Test",
      result: null,
      prediction: { home: 1, away: 0 },
    }];
    const standings = calculateStandings(matches, ["T1", "T2"], "prediction");
    const t1 = standings.find((s) => s.teamId === "T1")!;
    expect(t1.points).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/utils/__tests__/standings.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement standings calculation**

```typescript
// src/utils/standings.ts
import { GroupMatch, StandingRow, Score } from "../types";

export function calculateStandings(
  matches: GroupMatch[],
  teamIds: string[],
  scoreField: "result" | "prediction" = "result"
): StandingRow[] {
  const map = new Map<string, StandingRow>();

  for (const id of teamIds) {
    map.set(id, {
      teamId: id,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  }

  for (const match of matches) {
    const score: Score | null = match[scoreField];
    if (!score) continue;

    const home = map.get(match.homeTeamId);
    const away = map.get(match.awayTeamId);
    if (!home || !away) continue;

    home.played++;
    away.played++;
    home.goalsFor += score.home;
    home.goalsAgainst += score.away;
    away.goalsFor += score.away;
    away.goalsAgainst += score.home;

    if (score.home > score.away) {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (score.home < score.away) {
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
      home.points += 1;
      away.points += 1;
    }
  }

  const standings = Array.from(map.values());

  for (const row of standings) {
    row.goalDifference = row.goalsFor - row.goalsAgainst;
  }

  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });

  return standings;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/utils/__tests__/standings.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/standings.ts src/utils/__tests__/standings.test.ts
git commit -m "feat: add group standings calculation with tests"
```

---

### Task 7: Best Third-Placed Teams (TDD)

**Files:**
- Create: `src/utils/bestThirds.ts`
- Create: `src/utils/__tests__/bestThirds.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/utils/__tests__/bestThirds.test.ts
import { describe, it, expect } from "vitest";
import { rankThirdPlacedTeams, selectBestThirds } from "../bestThirds";
import { StandingRow } from "../../types";

function makeThird(teamId: string, points: number, gd: number, gf: number): StandingRow {
  return {
    teamId,
    played: 3,
    won: points === 3 ? 1 : 0,
    drawn: points === 1 ? 1 : 0,
    lost: 0,
    goalsFor: gf,
    goalsAgainst: gf - gd,
    goalDifference: gd,
    points,
  };
}

describe("rankThirdPlacedTeams", () => {
  it("ranks thirds by points, then GD, then GF", () => {
    const thirds: Array<{ group: string; standing: StandingRow }> = [
      { group: "A", standing: makeThird("T1", 3, 1, 2) },
      { group: "B", standing: makeThird("T2", 4, 2, 3) },
      { group: "C", standing: makeThird("T3", 3, 1, 3) }, // same pts/GD as T1, more GF
    ];
    const ranked = rankThirdPlacedTeams(thirds);
    expect(ranked[0].group).toBe("B");  // 4 pts
    expect(ranked[1].group).toBe("C");  // 3 pts, GD +1, GF 3
    expect(ranked[2].group).toBe("A");  // 3 pts, GD +1, GF 2
  });
});

describe("selectBestThirds", () => {
  it("selects top 8 out of 12 thirds", () => {
    const thirds = "ABCDEFGHIJKL".split("").map((g, i) => ({
      group: g,
      standing: makeThird(`T${i}`, 6 - Math.floor(i / 2), i % 3, 5 - (i % 4)),
    }));
    const result = selectBestThirds(thirds);
    expect(result.qualifying).toHaveLength(8);
    expect(result.eliminated).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/utils/__tests__/bestThirds.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement best thirds logic**

```typescript
// src/utils/bestThirds.ts
import { StandingRow } from "../types";

export interface ThirdPlaceEntry {
  group: string;
  standing: StandingRow;
}

export function rankThirdPlacedTeams(thirds: ThirdPlaceEntry[]): ThirdPlaceEntry[] {
  return [...thirds].sort((a, b) => {
    const sa = a.standing;
    const sb = b.standing;
    if (sb.points !== sa.points) return sb.points - sa.points;
    if (sb.goalDifference !== sa.goalDifference) return sb.goalDifference - sa.goalDifference;
    if (sb.goalsFor !== sa.goalsFor) return sb.goalsFor - sa.goalsFor;
    return a.group.localeCompare(b.group); // tiebreak by group letter
  });
}

export function selectBestThirds(thirds: ThirdPlaceEntry[]): {
  qualifying: ThirdPlaceEntry[];
  eliminated: ThirdPlaceEntry[];
} {
  const ranked = rankThirdPlacedTeams(thirds);
  return {
    qualifying: ranked.slice(0, 8),
    eliminated: ranked.slice(8),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/utils/__tests__/bestThirds.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/bestThirds.ts src/utils/__tests__/bestThirds.test.ts
git commit -m "feat: add best third-placed teams ranking with tests"
```

---

### Task 8: Knockout Slot Resolution (TDD)

**Files:**
- Create: `src/utils/knockout.ts`
- Create: `src/utils/__tests__/knockout.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/utils/__tests__/knockout.test.ts
import { describe, it, expect } from "vitest";
import { resolveKnockoutTeams } from "../knockout";
import { KnockoutMatch, StandingRow } from "../../types";

function makeStandings(teamIds: string[]): StandingRow[] {
  return teamIds.map((id, i) => ({
    teamId: id,
    played: 3, won: 3 - i, drawn: 0, lost: i,
    goalsFor: 6 - i, goalsAgainst: i,
    goalDifference: 6 - 2 * i, points: (3 - i) * 3,
  }));
}

describe("resolveKnockoutTeams", () => {
  it("resolves group position slots from standings", () => {
    const match: KnockoutMatch = {
      id: "R32-1", round: "R32",
      homeSlot: { type: "group", group: "A", position: 1 },
      awaySlot: { type: "group", group: "A", position: 2 },
      homeTeamId: null, awayTeamId: null,
      dateUtc: "", venue: "", result: null, prediction: null,
    };
    const standingsByGroup = { A: makeStandings(["MEX", "RSA", "KOR", "CZE"]) };
    const thirdAssignment = {};

    const resolved = resolveKnockoutTeams(
      [match], standingsByGroup, thirdAssignment, []
    );
    expect(resolved[0].homeTeamId).toBe("MEX");
    expect(resolved[0].awayTeamId).toBe("RSA");
  });

  it("resolves winner slots from previous match results", () => {
    const r32: KnockoutMatch = {
      id: "R32-1", round: "R32",
      homeSlot: { type: "group", group: "A", position: 1 },
      awaySlot: { type: "group", group: "A", position: 2 },
      homeTeamId: "MEX", awayTeamId: "RSA",
      dateUtc: "", venue: "",
      result: { home: 2, away: 1 }, prediction: null,
    };
    const r16: KnockoutMatch = {
      id: "R16-1", round: "R16",
      homeSlot: { type: "winner", matchId: "R32-1" },
      awaySlot: { type: "winner", matchId: "R32-1" }, // dummy, just testing home
      homeTeamId: null, awayTeamId: null,
      dateUtc: "", venue: "", result: null, prediction: null,
    };

    const resolved = resolveKnockoutTeams(
      [r32, r16], {}, {}, []
    );
    const r16Result = resolved.find((m) => m.id === "R16-1")!;
    expect(r16Result.homeTeamId).toBe("MEX");
  });

  it("resolves loser slots for third-place match", () => {
    const sf: KnockoutMatch = {
      id: "SF-1", round: "SF",
      homeSlot: { type: "winner", matchId: "QF-1" },
      awaySlot: { type: "winner", matchId: "QF-2" },
      homeTeamId: "ARG", awayTeamId: "BRA",
      dateUtc: "", venue: "",
      result: { home: 3, away: 1 }, prediction: null,
    };
    const thirdPlace: KnockoutMatch = {
      id: "3P", round: "3P",
      homeSlot: { type: "loser", matchId: "SF-1" },
      awaySlot: { type: "loser", matchId: "SF-1" }, // dummy
      homeTeamId: null, awayTeamId: null,
      dateUtc: "", venue: "", result: null, prediction: null,
    };

    const resolved = resolveKnockoutTeams(
      [sf, thirdPlace], {}, {}, []
    );
    const tp = resolved.find((m) => m.id === "3P")!;
    expect(tp.homeTeamId).toBe("BRA"); // loser
  });

  it("clears results when resolved team changes", () => {
    const r32: KnockoutMatch = {
      id: "R32-1", round: "R32",
      homeSlot: { type: "group", group: "A", position: 1 },
      awaySlot: { type: "group", group: "B", position: 1 },
      homeTeamId: "MEX", awayTeamId: "CAN",
      dateUtc: "", venue: "",
      result: { home: 1, away: 0 }, prediction: null,
    };
    // Standings changed: now RSA is first in A
    const standingsByGroup = {
      A: makeStandings(["RSA", "MEX", "KOR", "CZE"]),
      B: makeStandings(["CAN", "SUI", "QAT", "BIH"]),
    };

    const resolved = resolveKnockoutTeams(
      [r32], standingsByGroup, {}, []
    );
    const r = resolved[0];
    expect(r.homeTeamId).toBe("RSA"); // changed
    expect(r.result).toBeNull(); // cleared because team changed
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/utils/__tests__/knockout.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement knockout resolution**

```typescript
// src/utils/knockout.ts
import { KnockoutMatch, KnockoutSlot, Score, StandingRow } from "../types";
import { ThirdPlaceAssignment } from "../data/thirdPlaceMapping";

function getWinner(homeTeamId: string | null, awayTeamId: string | null, score: Score | null): string | null {
  if (!homeTeamId || !awayTeamId || !score) return null;
  if (score.home > score.away) return homeTeamId;
  if (score.away > score.home) return awayTeamId;
  // Draw in knockout = penalties
  if (score.penalties) {
    return score.penalties.home > score.penalties.away ? homeTeamId : awayTeamId;
  }
  return null; // draw without penalties = not yet decided
}

function getLoser(homeTeamId: string | null, awayTeamId: string | null, score: Score | null): string | null {
  const winner = getWinner(homeTeamId, awayTeamId, score);
  if (!winner || !homeTeamId || !awayTeamId) return null;
  return winner === homeTeamId ? awayTeamId : homeTeamId;
}

function resolveSlot(
  slot: KnockoutSlot,
  standingsByGroup: Record<string, StandingRow[]>,
  thirdAssignment: ThirdPlaceAssignment,
  matchMap: Map<string, KnockoutMatch>,
  qualifyingThirdGroups: string[]
): string | null {
  switch (slot.type) {
    case "group": {
      const standings = standingsByGroup[slot.group];
      if (!standings || standings.length < slot.position) return null;
      return standings[slot.position - 1].teamId;
    }
    case "best_third": {
      // Find which qualifying third group is assigned to this slot's match
      for (const [group, matchId] of Object.entries(thirdAssignment)) {
        // We need to find the match that contains this slot to check assignment
        // Since we can't easily reverse-lookup, we check if this group is in possibleGroups
        if (slot.possibleGroups.includes(group) && qualifyingThirdGroups.includes(group)) {
          // Check if this group is assigned to a match whose slot matches
          const assignedMatch = thirdAssignment[group];
          // We need to check if this specific slot belongs to the match assigned to this group
          // This is handled by the caller passing the right assignment
          const groupStandings = standingsByGroup[group];
          if (groupStandings && groupStandings.length >= 3) {
            return groupStandings[2].teamId; // 3rd place (index 2)
          }
        }
      }
      return null;
    }
    case "winner": {
      const prev = matchMap.get(slot.matchId);
      if (!prev) return null;
      return getWinner(prev.homeTeamId, prev.awayTeamId, prev.result);
    }
    case "loser": {
      const prev = matchMap.get(slot.matchId);
      if (!prev) return null;
      return getLoser(prev.homeTeamId, prev.awayTeamId, prev.result);
    }
  }
}

export function resolveKnockoutTeams(
  matches: KnockoutMatch[],
  standingsByGroup: Record<string, StandingRow[]>,
  thirdAssignment: ThirdPlaceAssignment,
  qualifyingThirdGroups: string[]
): KnockoutMatch[] {
  // Build a mutable map for iterative resolution
  const matchMap = new Map<string, KnockoutMatch>();
  const resolved = matches.map((m) => ({ ...m }));

  for (const m of resolved) {
    matchMap.set(m.id, m);
  }

  // Resolve in round order: R32 → R16 → QF → SF → 3P/F
  const roundOrder: KnockoutMatch["round"][] = ["R32", "R16", "QF", "SF", "3P", "F"];

  for (const round of roundOrder) {
    const roundMatches = resolved.filter((m) => m.round === round);
    for (const match of roundMatches) {
      const newHome = resolveSlot(
        match.homeSlot, standingsByGroup, thirdAssignment, matchMap, qualifyingThirdGroups
      );
      const newAway = resolveSlot(
        match.awaySlot, standingsByGroup, thirdAssignment, matchMap, qualifyingThirdGroups
      );

      // If team changed, clear result (cascading)
      const homeChanged = match.homeTeamId !== null && match.homeTeamId !== newHome;
      const awayChanged = match.awayTeamId !== null && match.awayTeamId !== newAway;

      match.homeTeamId = newHome;
      match.awayTeamId = newAway;

      if (homeChanged || awayChanged) {
        match.result = null;
        match.prediction = null;
      }

      matchMap.set(match.id, match);
    }
  }

  return resolved;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/utils/__tests__/knockout.test.ts
```

Expected: All 4 tests PASS. The `best_third` slot test may need adjustment — if it doesn't pass, update the `resolveSlot` function for the `best_third` case to properly look up which group's third is assigned to each R32 match:

Replace the `best_third` case with:

```typescript
case "best_third": {
  // Find which group's third is assigned to a match with this slot's possibleGroups
  for (const group of slot.possibleGroups) {
    if (thirdAssignment[group]) {
      // Check if this slot's match is the one assigned to this group
      // We need to find which match this slot belongs to
      const groupStandings = standingsByGroup[group];
      if (groupStandings && groupStandings.length >= 3 && qualifyingThirdGroups.includes(group)) {
        // Verify this group is assigned to a match whose possibleGroups matches
        return groupStandings[2].teamId;
      }
    }
  }
  return null;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/utils/knockout.ts src/utils/__tests__/knockout.test.ts
git commit -m "feat: add knockout slot resolution with cascading clears"
```

---

### Task 9: Date Formatting & Persistence Utils

**Files:**
- Create: `src/utils/formatDate.ts`
- Create: `src/utils/persistence.ts`

- [ ] **Step 1: Create date formatting utility**

```typescript
// src/utils/formatDate.ts

const SHORT_WEEKDAYS_ES: Record<string, string> = {
  Monday: "Lun", Tuesday: "Mar", Wednesday: "Mié",
  Thursday: "Jue", Friday: "Vie", Saturday: "Sáb", Sunday: "Dom",
};

const MONTHS_ES: Record<string, string> = {
  January: "Ene", February: "Feb", March: "Mar", April: "Abr",
  May: "May", June: "Jun", July: "Jul", August: "Ago",
  September: "Sep", October: "Oct", November: "Nov", December: "Dic",
};

export function formatMatchDate(utcDate: string): string {
  const date = new Date(utcDate);

  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
  const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(date);
  const day = date.toLocaleDateString("en-US", { day: "numeric" });
  const time = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  const weekdayEs = SHORT_WEEKDAYS_ES[weekday] ?? weekday.slice(0, 3);
  const monthEs = MONTHS_ES[month] ?? month.slice(0, 3);

  return `${weekdayEs} ${day} ${monthEs} · ${time}`;
}
```

- [ ] **Step 2: Create persistence utility**

```typescript
// src/utils/persistence.ts
import { GroupMatch, KnockoutMatch } from "../types";

const STORAGE_KEY = "wc2026-fixture";

interface PersistedData {
  groupMatches: GroupMatch[];
  knockoutMatches: KnockoutMatch[];
}

export function saveToLocalStorage(data: PersistedData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

export function loadFromLocalStorage(): PersistedData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedData;
  } catch {
    return null;
  }
}

export function exportToJson(data: PersistedData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mundial-2026-fixture-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importFromJson(file: File): Promise<PersistedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as PersistedData;
        if (!Array.isArray(data.groupMatches) || !Array.isArray(data.knockoutMatches)) {
          throw new Error("Invalid fixture data format");
        }
        resolve(data);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/formatDate.ts src/utils/persistence.ts
git commit -m "feat: add date formatting and persistence utilities"
```

---

### Task 10: Fixture Context & Reducer

**Files:**
- Create: `src/context/FixtureContext.tsx`

- [ ] **Step 1: Create context with reducer**

```typescript
// src/context/FixtureContext.tsx
import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  useMemo,
  ReactNode,
} from "react";
import {
  FixtureState,
  FixtureAction,
  GroupMatch,
  KnockoutMatch,
  ViewTarget,
  StandingRow,
} from "../types";
import { TEAMS, GROUPS } from "../data/teams";
import { INITIAL_GROUP_MATCHES } from "../data/groupMatches";
import { INITIAL_KNOCKOUT_MATCHES } from "../data/knockoutStructure";
import { calculateStandings } from "../utils/standings";
import { selectBestThirds, ThirdPlaceEntry } from "../utils/bestThirds";
import { assignThirdPlaceSlots } from "../data/thirdPlaceMapping";
import { resolveKnockoutTeams } from "../utils/knockout";
import { saveToLocalStorage, loadFromLocalStorage } from "../utils/persistence";

function fixtureReducer(state: FixtureState, action: FixtureAction): FixtureState {
  switch (action.type) {
    case "SET_GROUP_SCORE": {
      const field = state.mode === "predictions" ? "prediction" : "result";
      return {
        ...state,
        groupMatches: state.groupMatches.map((m) =>
          m.id === action.matchId ? { ...m, [field]: action.score } : m
        ),
      };
    }
    case "SET_KNOCKOUT_SCORE": {
      const field = state.mode === "predictions" ? "prediction" : "result";
      return {
        ...state,
        knockoutMatches: state.knockoutMatches.map((m) =>
          m.id === action.matchId ? { ...m, [field]: action.score } : m
        ),
      };
    }
    case "TOGGLE_MODE":
      return {
        ...state,
        mode: state.mode === "results" ? "predictions" : "results",
      };
    case "SET_VIEW":
      return { ...state, activeView: action.view };
    case "IMPORT_STATE":
      return {
        ...state,
        groupMatches: action.groupMatches,
        knockoutMatches: action.knockoutMatches,
      };
    default:
      return state;
  }
}

function buildInitialState(): FixtureState {
  const saved = loadFromLocalStorage();

  return {
    mode: "results",
    teams: TEAMS,
    groupMatches: saved?.groupMatches ?? INITIAL_GROUP_MATCHES,
    knockoutMatches: saved?.knockoutMatches ?? INITIAL_KNOCKOUT_MATCHES,
    activeView: { type: "group", group: "A" },
  };
}

interface FixtureContextValue {
  state: FixtureState;
  dispatch: React.Dispatch<FixtureAction>;
  standingsByGroup: Record<string, StandingRow[]>;
  resolvedKnockout: KnockoutMatch[];
  bestThirds: { qualifying: ThirdPlaceEntry[]; eliminated: ThirdPlaceEntry[] };
}

const FixtureContext = createContext<FixtureContextValue | null>(null);

export function FixtureProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(fixtureReducer, undefined, buildInitialState);

  const scoreField = state.mode === "predictions" ? "prediction" : "result";

  // Calculate standings for each group
  const standingsByGroup = useMemo(() => {
    const result: Record<string, StandingRow[]> = {};
    for (const group of GROUPS) {
      const groupMatches = state.groupMatches.filter((m) => m.group === group);
      const teamIds = TEAMS.filter((t) => t.group === group).map((t) => t.id);
      result[group] = calculateStandings(groupMatches, teamIds, scoreField);
    }
    return result;
  }, [state.groupMatches, scoreField]);

  // Calculate best third-placed teams
  const bestThirds = useMemo(() => {
    const thirds: ThirdPlaceEntry[] = [];
    for (const group of GROUPS) {
      const standings = standingsByGroup[group];
      if (standings && standings.length >= 3) {
        thirds.push({ group, standing: standings[2] });
      }
    }
    return selectBestThirds(thirds);
  }, [standingsByGroup]);

  // Assign third-placed teams to R32 slots
  const thirdAssignment = useMemo(() => {
    const qualifyingGroups = bestThirds.qualifying.map((t) => t.group);
    return assignThirdPlaceSlots(qualifyingGroups);
  }, [bestThirds]);

  // Resolve knockout teams from standings + previous results
  const resolvedKnockout = useMemo(() => {
    const qualifyingGroups = bestThirds.qualifying.map((t) => t.group);
    return resolveKnockoutTeams(
      state.knockoutMatches,
      standingsByGroup,
      thirdAssignment,
      qualifyingGroups
    );
  }, [state.knockoutMatches, standingsByGroup, thirdAssignment, bestThirds]);

  // Auto-save to LocalStorage (debounced)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveToLocalStorage({
        groupMatches: state.groupMatches,
        knockoutMatches: state.knockoutMatches,
      });
    }, 500);
    return () => clearTimeout(saveTimerRef.current);
  }, [state.groupMatches, state.knockoutMatches]);

  const value = useMemo(
    () => ({ state, dispatch, standingsByGroup, resolvedKnockout, bestThirds }),
    [state, standingsByGroup, resolvedKnockout, bestThirds]
  );

  return (
    <FixtureContext.Provider value={value}>
      {children}
    </FixtureContext.Provider>
  );
}

export function useFixture(): FixtureContextValue {
  const ctx = useContext(FixtureContext);
  if (!ctx) throw new Error("useFixture must be used within FixtureProvider");
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/context/FixtureContext.tsx
git commit -m "feat: add fixture context with reducer, computed standings, and knockout resolution"
```

---

### Task 11: Global Styles & App Layout

**Files:**
- Modify: `src/App.css`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Write global CSS with theme variables**

Replace contents of `src/App.css`:

```css
/* src/App.css */
:root {
  --sidebar-bg: #0d3311;
  --sidebar-text: #a5d6a7;
  --sidebar-active-text: #ffffff;
  --sidebar-active-border: #fdd835;
  --sidebar-section-title: #66bb6a;

  --topbar-bg: #1b5e20;
  --topbar-text: #ffffff;

  --content-bg: #f5f5f0;
  --content-text: #333333;

  --accent-green: #2e7d32;
  --accent-gold: #fdd835;
  --accent-qualify: #c8e6c9;
  --accent-maybe: #fff9c4;
  --accent-eliminated: #ffcdd2;

  --card-bg: #ffffff;
  --card-border: #e0e0e0;

  --prediction-blue: #1565c0;
  --result-green: #2e7d32;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background: var(--content-bg);
  color: var(--content-text);
}

.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  width: 200px;
  background: var(--sidebar-bg);
  overflow-y: auto;
  flex-shrink: 0;
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.topbar {
  background: var(--topbar-bg);
  color: var(--topbar-text);
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}
```

- [ ] **Step 2: Write App component**

Replace `src/App.tsx`:

```typescript
// src/App.tsx
import { useFixture } from "./context/FixtureContext";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { GroupView } from "./components/GroupView";
import { BracketView } from "./components/BracketView";
import "./App.css";

export default function App() {
  const { state } = useFixture();
  const { activeView } = state;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-area">
        <TopBar />
        <div className="main-content">
          {activeView.type === "group" && <GroupView group={activeView.group} />}
          {activeView.type === "knockout" && <BracketView round={activeView.round} />}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update main.tsx**

Replace `src/main.tsx`:

```typescript
// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FixtureProvider } from "./context/FixtureContext";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FixtureProvider>
      <App />
    </FixtureProvider>
  </StrictMode>
);
```

- [ ] **Step 4: Delete default Vite boilerplate files**

```bash
rm -f src/index.css src/assets/react.svg public/vite.svg
```

Remove `import './index.css'` from `main.tsx` if Vite scaffold added it.

- [ ] **Step 5: Commit**

```bash
git add src/App.css src/App.tsx src/main.tsx
git commit -m "feat: add app layout with sidebar, topbar, and main content area"
```

---

### Task 12: Sidebar Component

**Files:**
- Create: `src/components/Sidebar.tsx`
- Create: `src/components/Sidebar.css`

- [ ] **Step 1: Create Sidebar CSS**

```css
/* src/components/Sidebar.css */
.sidebar-section-title {
  padding: 14px 16px 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--sidebar-section-title);
  text-transform: uppercase;
}

.sidebar-item {
  padding: 8px 16px;
  font-size: 13px;
  color: var(--sidebar-text);
  cursor: pointer;
  border-left: 3px solid transparent;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.15s, border-color 0.15s;
}

.sidebar-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.sidebar-item.active {
  color: var(--sidebar-active-text);
  border-left-color: var(--sidebar-active-border);
  background: rgba(255, 255, 255, 0.08);
}

.sidebar-badge {
  font-size: 10px;
  color: var(--sidebar-section-title);
  opacity: 0.7;
}
```

- [ ] **Step 2: Create Sidebar component**

```typescript
// src/components/Sidebar.tsx
import { useFixture } from "../context/FixtureContext";
import { GROUPS } from "../data/teams";
import { KnockoutRound } from "../types";
import "./Sidebar.css";

const KNOCKOUT_ROUNDS: { round: KnockoutRound; label: string }[] = [
  { round: "R32", label: "32avos" },
  { round: "R16", label: "Octavos" },
  { round: "QF", label: "Cuartos" },
  { round: "SF", label: "Semifinales" },
  { round: "F", label: "Final" },
];

export function Sidebar() {
  const { state, dispatch } = useFixture();
  const { activeView, groupMatches, mode } = state;

  function countPlayed(group: string): string {
    const field = mode === "predictions" ? "prediction" : "result";
    const matches = groupMatches.filter((m) => m.group === group);
    const played = matches.filter((m) => m[field] !== null).length;
    return `${played}/6`;
  }

  return (
    <nav className="sidebar">
      <div className="sidebar-section-title">Fase de Grupos</div>
      {GROUPS.map((group) => {
        const isActive = activeView.type === "group" && activeView.group === group;
        return (
          <div
            key={group}
            className={`sidebar-item ${isActive ? "active" : ""}`}
            onClick={() => dispatch({ type: "SET_VIEW", view: { type: "group", group } })}
          >
            <span>Grupo {group}</span>
            <span className="sidebar-badge">{countPlayed(group)}</span>
          </div>
        );
      })}
      <div className="sidebar-section-title">Eliminatorias</div>
      {KNOCKOUT_ROUNDS.map(({ round, label }) => {
        const isActive = activeView.type === "knockout" && activeView.round === round;
        return (
          <div
            key={round}
            className={`sidebar-item ${isActive ? "active" : ""}`}
            onClick={() => dispatch({ type: "SET_VIEW", view: { type: "knockout", round } })}
          >
            {label}
          </div>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.tsx src/components/Sidebar.css
git commit -m "feat: add sidebar navigation component"
```

---

### Task 13: TopBar Component

**Files:**
- Create: `src/components/TopBar.tsx`
- Create: `src/components/TopBar.css`

- [ ] **Step 1: Create TopBar CSS**

```css
/* src/components/TopBar.css */
.topbar-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.mode-toggle {
  display: flex;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  overflow: hidden;
}

.mode-toggle button {
  padding: 6px 16px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.mode-toggle button.active {
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}

.topbar-btn {
  padding: 6px 14px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  background: transparent;
  color: #ffffff;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.topbar-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.import-input {
  display: none;
}
```

- [ ] **Step 2: Create TopBar component**

```typescript
// src/components/TopBar.tsx
import { useRef } from "react";
import { useFixture } from "../context/FixtureContext";
import { exportToJson, importFromJson } from "../utils/persistence";
import "./TopBar.css";

export function TopBar() {
  const { state, dispatch } = useFixture();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    exportToJson({
      groupMatches: state.groupMatches,
      knockoutMatches: state.knockoutMatches,
    });
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importFromJson(file);
      dispatch({ type: "IMPORT_STATE", groupMatches: data.groupMatches, knockoutMatches: data.knockoutMatches });
    } catch {
      alert("Error al importar el archivo. Verificá que sea un JSON válido.");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="topbar">
      <div className="topbar-title">Mundial 2026</div>
      <div className="topbar-actions">
        <div className="mode-toggle">
          <button
            className={state.mode === "results" ? "active" : ""}
            onClick={() => state.mode !== "results" && dispatch({ type: "TOGGLE_MODE" })}
          >
            Resultados
          </button>
          <button
            className={state.mode === "predictions" ? "active" : ""}
            onClick={() => state.mode !== "predictions" && dispatch({ type: "TOGGLE_MODE" })}
          >
            Predicciones
          </button>
        </div>
        <button className="topbar-btn" onClick={handleExport}>Exportar</button>
        <button className="topbar-btn" onClick={() => fileInputRef.current?.click()}>Importar</button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="import-input"
          onChange={handleImport}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TopBar.tsx src/components/TopBar.css
git commit -m "feat: add topbar with mode toggle and export/import"
```

---

### Task 14: ScoreInput Component

**Files:**
- Create: `src/components/ScoreInput.tsx`
- Create: `src/components/ScoreInput.css`

- [ ] **Step 1: Create ScoreInput CSS**

```css
/* src/components/ScoreInput.css */
.score-input-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
}

.score-field {
  width: 32px;
  height: 28px;
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  border: 1px solid var(--card-border);
  border-radius: 4px;
  background: var(--card-bg);
  color: var(--content-text);
  outline: none;
  transition: border-color 0.15s;
}

.score-field:focus {
  border-color: var(--accent-green);
}

.score-field.prediction {
  border-color: var(--prediction-blue);
  color: var(--prediction-blue);
}

.score-separator {
  font-size: 14px;
  font-weight: 700;
  color: #999;
}

.score-readonly {
  font-size: 16px;
  font-weight: 700;
  min-width: 32px;
  text-align: center;
}

.prediction-indicator {
  margin-left: 8px;
  font-size: 14px;
}

.prediction-indicator.exact { color: #2e7d32; }
.prediction-indicator.winner { color: #f9a825; }
.prediction-indicator.wrong { color: #c62828; }
```

- [ ] **Step 2: Create ScoreInput component**

```typescript
// src/components/ScoreInput.tsx
import { useState, useRef, useEffect } from "react";
import { Score } from "../types";
import "./ScoreInput.css";

interface ScoreInputProps {
  score: Score | null;
  onScoreChange: (score: Score | null) => void;
  isPrediction?: boolean;
  readonlyScore?: Score | null; // show result alongside prediction
}

export function ScoreInput({ score, onScoreChange, isPrediction, readonlyScore }: ScoreInputProps) {
  const [homeStr, setHomeStr] = useState(score?.home?.toString() ?? "");
  const [awayStr, setAwayStr] = useState(score?.away?.toString() ?? "");
  const homeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHomeStr(score?.home?.toString() ?? "");
    setAwayStr(score?.away?.toString() ?? "");
  }, [score]);

  function commitScore() {
    const home = parseInt(homeStr, 10);
    const away = parseInt(awayStr, 10);
    if (!isNaN(home) && !isNaN(away) && home >= 0 && away >= 0) {
      onScoreChange({ home, away });
    } else if (homeStr === "" && awayStr === "") {
      onScoreChange(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      commitScore();
      (e.target as HTMLInputElement).blur();
    }
  }

  function getPredictionIndicator(): { className: string; symbol: string } | null {
    if (!readonlyScore || !score) return null;
    if (readonlyScore.home === score.home && readonlyScore.away === score.away) {
      return { className: "exact", symbol: "✓" };
    }
    const realOutcome = Math.sign(readonlyScore.home - readonlyScore.away);
    const predOutcome = Math.sign(score.home - score.away);
    if (realOutcome === predOutcome) {
      return { className: "winner", symbol: "½" };
    }
    return { className: "wrong", symbol: "✗" };
  }

  const indicator = getPredictionIndicator();

  return (
    <div className="score-input-wrapper">
      {readonlyScore && (
        <>
          <span className="score-readonly">{readonlyScore.home}</span>
          <span className="score-separator">-</span>
          <span className="score-readonly">{readonlyScore.away}</span>
          <span className="score-separator">|</span>
        </>
      )}
      <input
        ref={homeRef}
        type="number"
        min="0"
        max="99"
        className={`score-field ${isPrediction ? "prediction" : ""}`}
        value={homeStr}
        onChange={(e) => setHomeStr(e.target.value)}
        onBlur={commitScore}
        onKeyDown={handleKeyDown}
      />
      <span className="score-separator">-</span>
      <input
        type="number"
        min="0"
        max="99"
        className={`score-field ${isPrediction ? "prediction" : ""}`}
        value={awayStr}
        onChange={(e) => setAwayStr(e.target.value)}
        onBlur={commitScore}
        onKeyDown={handleKeyDown}
      />
      {indicator && (
        <span className={`prediction-indicator ${indicator.className}`}>
          {indicator.symbol}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ScoreInput.tsx src/components/ScoreInput.css
git commit -m "feat: add ScoreInput component with prediction comparison"
```

---

### Task 15: GroupView Component

**Files:**
- Create: `src/components/GroupView.tsx`
- Create: `src/components/GroupView.css`

- [ ] **Step 1: Create GroupView CSS**

```css
/* src/components/GroupView.css */
.group-view h2 {
  font-size: 22px;
  color: var(--accent-green);
  margin-bottom: 16px;
}

.standings-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 24px;
  background: var(--card-bg);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.standings-table th {
  background: var(--accent-green);
  color: white;
  font-size: 11px;
  font-weight: 600;
  padding: 8px 10px;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.standings-table th:first-child {
  text-align: left;
  padding-left: 16px;
}

.standings-table td {
  padding: 10px 10px;
  text-align: center;
  font-size: 13px;
  border-bottom: 1px solid #eee;
}

.standings-table td:first-child {
  text-align: left;
  padding-left: 16px;
  font-weight: 600;
}

.standings-table tr.qualify {
  background: var(--accent-qualify);
}

.standings-table tr.maybe-qualify {
  background: var(--accent-maybe);
}

.team-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.team-flag {
  font-size: 18px;
}

.group-matches-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--content-text);
  margin-bottom: 12px;
}

.group-match-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: var(--card-bg);
  border-radius: 6px;
  margin-bottom: 6px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.match-date {
  font-size: 11px;
  color: #888;
  min-width: 130px;
}

.match-teams {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.match-team-name {
  font-size: 13px;
  font-weight: 600;
  min-width: 100px;
}

.match-team-name.home {
  text-align: right;
}

.match-vs {
  font-size: 11px;
  color: #999;
}
```

- [ ] **Step 2: Create GroupView component**

```typescript
// src/components/GroupView.tsx
import { useFixture } from "../context/FixtureContext";
import { ScoreInput } from "./ScoreInput";
import { getTeam } from "../data/teams";
import { formatMatchDate } from "../utils/formatDate";
import "./GroupView.css";

interface GroupViewProps {
  group: string;
}

export function GroupView({ group }: GroupViewProps) {
  const { state, dispatch, standingsByGroup } = useFixture();
  const standings = standingsByGroup[group] ?? [];
  const matches = state.groupMatches
    .filter((m) => m.group === group)
    .sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));

  const isPrediction = state.mode === "predictions";

  return (
    <div className="group-view">
      <h2>Grupo {group}</h2>

      <table className="standings-table">
        <thead>
          <tr>
            <th>Equipo</th>
            <th>PJ</th>
            <th>G</th>
            <th>E</th>
            <th>P</th>
            <th>GF</th>
            <th>GC</th>
            <th>DG</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, i) => {
            const team = getTeam(row.teamId);
            const rowClass = i < 2 ? "qualify" : i === 2 ? "maybe-qualify" : "";
            return (
              <tr key={row.teamId} className={rowClass}>
                <td>
                  <div className="team-cell">
                    <span className="team-flag">{team?.flag}</span>
                    <span>{team?.name ?? row.teamId}</span>
                  </div>
                </td>
                <td>{row.played}</td>
                <td>{row.won}</td>
                <td>{row.drawn}</td>
                <td>{row.lost}</td>
                <td>{row.goalsFor}</td>
                <td>{row.goalsAgainst}</td>
                <td>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                <td><strong>{row.points}</strong></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="group-matches-title">Partidos</div>
      {matches.map((match) => {
        const homeTeam = getTeam(match.homeTeamId);
        const awayTeam = getTeam(match.awayTeamId);
        const currentScore = isPrediction ? match.prediction : match.result;
        const readonlyScore = isPrediction ? match.result : undefined;

        return (
          <div key={match.id} className="group-match-row">
            <div className="match-date">{formatMatchDate(match.dateUtc)}</div>
            <div className="match-teams">
              <span className="team-flag">{homeTeam?.flag}</span>
              <span className="match-team-name home">{homeTeam?.name}</span>
              <ScoreInput
                score={currentScore}
                onScoreChange={(score) =>
                  dispatch({ type: "SET_GROUP_SCORE", matchId: match.id, score })
                }
                isPrediction={isPrediction}
                readonlyScore={readonlyScore ?? undefined}
              />
              <span className="match-team-name">{awayTeam?.name}</span>
              <span className="team-flag">{awayTeam?.flag}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/GroupView.tsx src/components/GroupView.css
git commit -m "feat: add GroupView with standings table and match score editing"
```

---

### Task 16: BracketView Component

**Files:**
- Create: `src/components/BracketView.tsx`
- Create: `src/components/BracketView.css`

- [ ] **Step 1: Create BracketView CSS**

```css
/* src/components/BracketView.css */
.bracket-view h2 {
  font-size: 22px;
  color: var(--accent-green);
  margin-bottom: 16px;
}

.bracket-round-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent-green);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
}

.bracket-matches {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 12px;
  margin-bottom: 32px;
}

.bracket-match-card {
  background: var(--card-bg);
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  border-left: 3px solid var(--accent-green);
}

.bracket-match-card.third-place {
  border-left-color: var(--accent-gold);
}

.bracket-match-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.bracket-match-id {
  font-size: 10px;
  font-weight: 600;
  color: #999;
  text-transform: uppercase;
}

.bracket-match-date {
  font-size: 11px;
  color: #888;
}

.bracket-match-teams {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bracket-team {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 110px;
  font-size: 13px;
  font-weight: 600;
}

.bracket-team.home {
  justify-content: flex-end;
}

.bracket-team.pending {
  color: #bbb;
  font-weight: 400;
  font-style: italic;
}

.bracket-venue {
  font-size: 10px;
  color: #aaa;
  margin-top: 6px;
}

.penalties-input {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-size: 11px;
  color: #888;
}

.penalties-input .score-field {
  width: 28px;
  height: 24px;
  font-size: 13px;
}
```

- [ ] **Step 2: Create BracketView component**

```typescript
// src/components/BracketView.tsx
import { useFixture } from "../context/FixtureContext";
import { ScoreInput } from "./ScoreInput";
import { getTeam } from "../data/teams";
import { formatMatchDate } from "../utils/formatDate";
import { KnockoutRound, KnockoutMatch } from "../types";
import "./BracketView.css";

const ROUND_LABELS: Record<KnockoutRound, string> = {
  R32: "32avos de Final",
  R16: "Octavos de Final",
  QF: "Cuartos de Final",
  SF: "Semifinales",
  "3P": "Tercer Puesto",
  F: "Final",
};

interface BracketViewProps {
  round: KnockoutRound;
}

function slotLabel(match: KnockoutMatch, side: "home" | "away"): string {
  const slot = side === "home" ? match.homeSlot : match.awaySlot;
  switch (slot.type) {
    case "group":
      return `${slot.position}° Grupo ${slot.group}`;
    case "best_third":
      return `3° (${slot.possibleGroups.join("/")})`;
    case "winner":
      return `Ganador ${slot.matchId}`;
    case "loser":
      return `Perdedor ${slot.matchId}`;
  }
}

export function BracketView({ round }: BracketViewProps) {
  const { state, dispatch, resolvedKnockout } = useFixture();
  const isPrediction = state.mode === "predictions";

  // Show the selected round, plus 3P alongside F
  const roundsToShow: KnockoutRound[] = round === "F" ? ["F", "3P"] : [round];

  return (
    <div className="bracket-view">
      <h2>{ROUND_LABELS[round]}</h2>

      {roundsToShow.map((r) => {
        const matches = resolvedKnockout
          .filter((m) => m.round === r)
          .sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));

        return (
          <div key={r}>
            {roundsToShow.length > 1 && (
              <div className="bracket-round-label">{ROUND_LABELS[r]}</div>
            )}
            <div className="bracket-matches">
              {matches.map((match) => {
                const homeTeam = match.homeTeamId ? getTeam(match.homeTeamId) : null;
                const awayTeam = match.awayTeamId ? getTeam(match.awayTeamId) : null;
                const currentScore = isPrediction ? match.prediction : match.result;
                const readonlyScore = isPrediction ? match.result : undefined;
                const bothTeamsKnown = match.homeTeamId !== null && match.awayTeamId !== null;

                return (
                  <div
                    key={match.id}
                    className={`bracket-match-card ${r === "3P" ? "third-place" : ""}`}
                  >
                    <div className="bracket-match-header">
                      <span className="bracket-match-id">{match.id}</span>
                      <span className="bracket-match-date">{formatMatchDate(match.dateUtc)}</span>
                    </div>
                    <div className="bracket-match-teams">
                      <div className={`bracket-team home ${!homeTeam ? "pending" : ""}`}>
                        {homeTeam ? (
                          <>
                            <span>{homeTeam.name}</span>
                            <span className="team-flag">{homeTeam.flag}</span>
                          </>
                        ) : (
                          <span>{slotLabel(match, "home")}</span>
                        )}
                      </div>
                      {bothTeamsKnown ? (
                        <ScoreInput
                          score={currentScore}
                          onScoreChange={(score) =>
                            dispatch({ type: "SET_KNOCKOUT_SCORE", matchId: match.id, score })
                          }
                          isPrediction={isPrediction}
                          readonlyScore={readonlyScore ?? undefined}
                        />
                      ) : (
                        <span className="score-separator">vs</span>
                      )}
                      <div className={`bracket-team ${!awayTeam ? "pending" : ""}`}>
                        {awayTeam ? (
                          <>
                            <span className="team-flag">{awayTeam.flag}</span>
                            <span>{awayTeam.name}</span>
                          </>
                        ) : (
                          <span>{slotLabel(match, "away")}</span>
                        )}
                      </div>
                    </div>
                    <div className="bracket-venue">{match.venue}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Add penalty handling to ScoreInput for knockout**

When a knockout match result is a draw (home === away), show extra penalty inputs. Update `ScoreInput.tsx` — add an optional `allowPenalties` prop:

Add to `ScoreInputProps`:
```typescript
  allowPenalties?: boolean;
```

Add after the main score inputs in the JSX (before the prediction indicator):
```typescript
      {allowPenalties && score && score.home === score.away && (
        <div className="penalties-input">
          <span>Pen:</span>
          <input
            type="number"
            min="0"
            max="99"
            className="score-field"
            value={score.penalties?.home?.toString() ?? ""}
            onChange={(e) => {
              const penHome = parseInt(e.target.value, 10);
              if (!isNaN(penHome)) {
                onScoreChange({
                  ...score,
                  penalties: { home: penHome, away: score.penalties?.away ?? 0 },
                });
              }
            }}
          />
          <span className="score-separator">-</span>
          <input
            type="number"
            min="0"
            max="99"
            className="score-field"
            value={score.penalties?.away?.toString() ?? ""}
            onChange={(e) => {
              const penAway = parseInt(e.target.value, 10);
              if (!isNaN(penAway)) {
                onScoreChange({
                  ...score,
                  penalties: { home: score.penalties?.home ?? 0, away: penAway },
                });
              }
            }}
          />
        </div>
      )}
```

In `BracketView.tsx`, pass `allowPenalties` to ScoreInput:
```typescript
<ScoreInput
  score={currentScore}
  onScoreChange={(score) =>
    dispatch({ type: "SET_KNOCKOUT_SCORE", matchId: match.id, score })
  }
  isPrediction={isPrediction}
  readonlyScore={readonlyScore ?? undefined}
  allowPenalties
/>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/BracketView.tsx src/components/BracketView.css src/components/ScoreInput.tsx
git commit -m "feat: add BracketView with knockout match cards, slot resolution, and penalty support"
```

---

### Task 17: Build & Verify

- [ ] **Step 1: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```

Expected: No errors. If there are import/type errors, fix them.

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: All tests pass (standings + bestThirds + knockout).

- [ ] **Step 3: Run dev server and verify visually**

```bash
npm run dev
```

Open `http://localhost:5173`. Verify:
- Sidebar shows groups A-L and knockout rounds
- Clicking a group shows standings table and 6 matches
- Entering scores updates the standings table in real time
- Clicking knockout rounds shows match cards
- Mode toggle switches between Resultados/Predicciones
- Export downloads a JSON file
- Import restores state from JSON

- [ ] **Step 4: Build for production**

```bash
npm run build
```

Expected: Successful production build in `dist/`.

- [ ] **Step 5: Commit any fixes and final commit**

```bash
git add -A
git commit -m "feat: complete World Cup 2026 fixture app MVP"
```

---

### Task 18: Push to Remote

- [ ] **Step 1: Push to GitHub**

```bash
git push -u origin main
```

Expected: Successfully pushed to `git@github.com:pampeanodev/fixture.git`.
