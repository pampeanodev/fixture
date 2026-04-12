# World Cup 2026 Fixture — Design Spec

## Overview

Interactive World Cup 2026 fixture web app that replicates the classic Excel spreadsheet experience: groups with standings tables, match results, localized schedules, and a full knockout bracket that auto-fills as results are entered. Includes a prediction mode for users to enter their own forecasts and compare against real results.

## Stack

- **React + TypeScript + Vite**
- No backend — fully client-side
- Styling: CSS Modules or plain CSS (no UI library)

## Visual Design

- **Layout:** Sidebar navigation (left) + main content area (right)
- **Color palette:** "Cancha clásica" — dark green sidebar (`#0d3311`), green gradient background (`#1b5e20` → `#2e7d32`), gold accents (`#fdd835`) for active/highlight states, light content area (`#f5f5f0`)
- **Typography:** System font stack, bold weights for scores and standings

## Navigation Structure

**Sidebar (fixed left):**
```
FASE DE GRUPOS
  Grupo A  (active state: white text, gold left border, subtle bg highlight)
  Grupo B
  ...
  Grupo L
ELIMINATORIAS
  32avos
  Octavos
  Cuartos
  Semifinales
  Final
```

**TopBar (fixed top):**
- Title: "Mundial 2026"
- Mode toggle: Resultados / Predicciones (pill toggle)
- Actions: Export JSON, Import JSON

## Data Model

### Teams (static, 48 entries)

```typescript
interface Team {
  id: string;          // FIFA code: "ARG", "BRA", etc.
  name: string;        // "Argentina"
  flag: string;        // "🇦🇷"
  group: string;       // "A" through "L"
}
```

### Group Matches (72 total: 6 per group × 12 groups)

```typescript
interface GroupMatch {
  id: string;                    // "G-A-1" (group A, match 1)
  group: string;                 // "A"
  homeTeamId: string;            // "MEX"
  awayTeamId: string;            // "COL"
  dateUtc: string;               // ISO 8601 UTC
  venue: string;                 // "Estadio Azteca"
  result: Score | null;          // real result
  prediction: Score | null;      // user prediction
}

interface Score {
  home: number;
  away: number;
  penalties?: { home: number; away: number };  // only for knockout
}
```

### Standings (computed, never stored)

```typescript
interface StandingRow {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  position: number;  // 1-4 within group
}
```

**Sorting criteria (FIFA rules, in order):**
1. Points (W=3, D=1, L=0)
2. Goal difference
3. Goals scored
4. If teams are still tied: head-to-head record (points, then GD, then GF among tied teams only)

Note: For simplicity, we implement criteria 1-3. Full head-to-head tiebreaking (criterion 4) is complex and rarely decisive — we can add it later if needed. For the best-third ranking across groups, head-to-head doesn't apply (different groups), so criteria 1-3 suffice.

### Best Third-Placed Teams

From the 12 third-placed teams, the 8 best qualify for the round of 32. Ranking criteria (same as above, applied across groups). The 4 worst thirds are eliminated.

**Bracket slot mapping:** FIFA publishes a fixed table that maps which combination of qualifying third-placed groups corresponds to which bracket positions. This table is hardcoded as a lookup.

### Knockout Matches (32 total: 16 + 8 + 4 + 2 + 1 + 1 third-place match)

```typescript
interface KnockoutMatch {
  id: string;                    // "R32-1", "QF-3", "F"
  round: "R32" | "R16" | "QF" | "SF" | "3P" | "F";
  homeSlot: KnockoutSlot;       // describes where this team comes from
  awaySlot: KnockoutSlot;       // describes where this team comes from
  homeTeamId: string | null;    // resolved team, null if not yet determined
  awayTeamId: string | null;
  dateUtc: string;
  venue: string;
  result: Score | null;
  prediction: Score | null;
}

type KnockoutSlot =
  | { type: "group"; group: string; position: 1 | 2 | 3 }
  | { type: "best_third"; slotIndex: number }
  | { type: "winner"; matchId: string }
  | { type: "loser"; matchId: string };  // only for 3rd place match
```

### App State

```typescript
interface FixtureState {
  mode: "results" | "predictions";
  teams: Team[];
  groupMatches: GroupMatch[];
  knockoutMatches: KnockoutMatch[];
  activeView: ViewTarget;
}

type ViewTarget =
  | { type: "group"; group: string }
  | { type: "knockout"; round: string }
  | { type: "calendar" };
```

## State Management

- **React Context + useReducer** for global fixture state
- Actions: `SET_GROUP_SCORE`, `SET_KNOCKOUT_SCORE`, `CLEAR_MATCH`, `TOGGLE_MODE`, `SET_VIEW`, `IMPORT_STATE`
- Standings computed via `useMemo` from group match results
- Knockout team slots resolved via `useMemo` from standings + bracket mapping

## Persistence

- **LocalStorage:** Auto-save on every state change (debounced 500ms). Key: `"wc2026-fixture"`
- **Export:** Download full state as `.json` file via browser download API
- **Import:** File input that reads JSON, validates structure, and replaces state

## Component Breakdown

### `App`
Root layout: Sidebar + TopBar + MainContent. Provides FixtureContext.

### `Sidebar`
- Lists all 12 groups (A-L) with click to navigate
- Lists knockout rounds with click to navigate
- Highlights active view
- Shows group completion status (e.g., "4/6" matches played as subtle indicator)

### `TopBar`
- "Mundial 2026" title
- Pill toggle for Results/Predictions mode
- Export/Import buttons

### `GroupView`
- Shows standings table for selected group
- Qualifying positions highlighted: 1st & 2nd in green, 3rd in yellow (potential qualifier)
- Below table: list of 6 group matches with editable scores
- Each match row: date/time (localized), flag+name vs flag+name, score inputs

### `ScoreInput`
- Two small number inputs (home/away goals)
- Click to edit, Enter or blur to confirm
- In predictions mode, shows prediction inputs alongside real results (if both exist)

### `BracketView`
- Horizontal bracket visualization
- Scrollable horizontally for the full R32→Final tree
- Each match node shows: teams (or placeholder like "1° Grupo A"), score, date
- Lines connecting winners to next round
- Third-place match displayed below the final

### `MatchCard` (used in both group and bracket)
- Compact card: flags, team names, score, date/time
- Visual indicator for prediction accuracy (✓ exact, ½ correct winner, ✗ wrong)

## Timezone Handling

- All dates stored as UTC ISO strings
- Displayed using `Intl.DateTimeFormat` with the browser's detected timezone
- Format: "Lun 16 Jun · 16:00" (short weekday, day, month, time)

## Predictions Feature

- Global toggle between "Resultados" and "Predicciones" modes
- In Resultados mode: editing scores updates `result` field
- In Predicciones mode: editing scores updates `prediction` field
- Both datasets coexist — switching mode doesn't erase anything
- When both exist for a match, show comparison indicators:
  - ✓ Green check: exact score match
  - ½ Yellow half-check: correct winner/draw but wrong score
  - ✗ Red X: wrong outcome

## Cascading Updates

When a group result changes:
1. Recalculate group standings
2. Re-resolve best third-placed teams
3. Update knockout R32 team slots
4. If a team in R32 changed and that R32 match had a result → clear it and cascade forward
5. Continue clearing through subsequent rounds affected

This ensures the bracket never shows stale teams from a previous group configuration.

## Initial Data

- 48 teams with FIFA codes, names, flags, and group assignments — hardcoded from the official FIFA draw
- 72 group match fixtures with dates, times (UTC), and venues — hardcoded from the official schedule
- 32 knockout match structures with slot mappings — hardcoded from FIFA bracket rules
- Best-third combination lookup table — hardcoded from FIFA regulations

## Out of Scope

- Multi-user / shared state / real-time sync
- Fetching live results from an API
- Mobile-first responsive design (desktop-first, basic mobile support via sidebar collapse)
- User accounts or authentication
- Statistics beyond basic standings (top scorers, cards, etc.)
