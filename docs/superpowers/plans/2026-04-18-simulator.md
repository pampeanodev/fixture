# Match Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a match-by-match simulator that lets users playtest the prode by generating realistic results (or entering manual ones) for each pending match in chronological order, with ephemeral state that never corrupts the real prode.

**Architecture:** A new `src/simulator/` module with pure modules for ratings, Poisson sampling, penalties, result generation, and match ordering. `FixtureState` gets two new fields (`simulationActive`, `simulationSnapshot`) and three new actions (`ENTER_SIMULATION`, `EXIT_SIMULATION`, `RESET_SIMULATION`). A dedicated `SimulatorView` component drives the per-match flow and reuses `ScoreInput` for manual entry. Existing standings/knockout/scoring pipelines are untouched — the simulator writes to `match.result` directly and relies on the existing derived-state `useMemo` chain.

**Tech Stack:** React 19, TypeScript, Vite, vitest. Zero new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-18-simulator-design.md`

---

## File Structure

```
src/
├── simulator/
│   ├── types.ts                  — PendingMatch type
│   ├── ratings.ts                — team tier arrays + getRating()
│   ├── poisson.ts                — samplePoisson()
│   ├── penalties.ts              — simulatePenalties()
│   ├── resultGenerator.ts        — generateGroupResult, generateKnockoutResult
│   ├── matchOrder.ts             — nextPendingMatch()
│   └── __tests__/
│       ├── poisson.test.ts
│       ├── penalties.test.ts
│       ├── resultGenerator.test.ts
│       └── matchOrder.test.ts
├── components/
│   ├── SimulatorView.tsx         — NEW
│   └── SimulatorView.css         — NEW
├── context/FixtureContext.tsx    — MODIFY (3 new actions, 2 state fields, persist gate)
├── utils/scoring.ts              — MODIFY (extract computeRanking + RankedPlayer type)
├── components/RankingView.tsx    — MODIFY (use computeRanking)
├── components/Sidebar.tsx        — MODIFY (conditional "Simulación" item)
├── components/TopBar.tsx         — MODIFY (Simulación menu section)
├── types.ts                      — MODIFY (state/action/ViewTarget)
└── App.tsx                       — MODIFY (route simulator view)
```

---

### Task 1: Extend types for simulation state

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Extend `FixtureState` with simulation fields**

Open `src/types.ts`. Find the `FixtureState` interface and add two fields at the end:

```typescript
export interface FixtureState {
  mode: FixtureMode;
  teams: Team[];
  groupMatches: GroupMatch[];
  knockoutMatches: KnockoutMatch[];
  activeView: ViewTarget;
  playerName: string;
  rivals: Rival[];
  simulationActive: boolean;
  simulationSnapshot: SimulationSnapshot | null;
}

export interface SimulationSnapshot {
  groupMatches: GroupMatch[];
  knockoutMatches: KnockoutMatch[];
}
```

- [ ] **Step 2: Extend `FixtureAction` with three new actions**

In the same file, add three action variants to the `FixtureAction` union:

```typescript
export type FixtureAction =
  | { type: "SET_GROUP_SCORE"; matchId: string; score: Score | null }
  | { type: "SET_KNOCKOUT_SCORE"; matchId: string; score: Score | null }
  | { type: "TOGGLE_MODE" }
  | { type: "SET_VIEW"; view: ViewTarget }
  | { type: "IMPORT_STATE"; groupMatches: GroupMatch[]; knockoutMatches: KnockoutMatch[] }
  | { type: "SET_PLAYER_NAME"; name: string }
  | { type: "ADD_RIVAL"; rival: Rival }
  | { type: "REMOVE_RIVAL"; name: string }
  | { type: "ENTER_SIMULATION" }
  | { type: "EXIT_SIMULATION" }
  | { type: "RESET_SIMULATION" };
```

- [ ] **Step 3: Extend `ViewTarget` with `"simulator"`**

In the same file, add `"simulator"` to the `ViewTarget` union:

```typescript
export type ViewTarget =
  | { type: "groups"; group: string }
  | { type: "knockout"; round: KnockoutRound }
  | { type: "schedule" }
  | { type: "ranking" }
  | { type: "rooms" }
  | { type: "room"; roomId: string }
  | { type: "simulator" };
```

- [ ] **Step 4: Verify build**

```bash
pnpm build
```

Expected: FAILS with TypeScript errors in `src/context/FixtureContext.tsx` because `FixtureState` now requires `simulationActive` and `simulationSnapshot` but the initial state doesn't provide them. This is expected — Task 2 fixes it.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts
git commit -m "feat: extend fixture state and actions for simulation"
```

---

### Task 2: Wire simulation into FixtureContext reducer

**Files:**
- Modify: `src/context/FixtureContext.tsx`

- [ ] **Step 1: Extend `buildInitialState` with simulation defaults**

Open `src/context/FixtureContext.tsx`. Find `buildInitialState` (around line 51). Add the two new fields:

```typescript
function buildInitialState(): FixtureState {
  const saved = loadFromLocalStorage();
  return {
    mode: "results",
    teams: TEAMS,
    groupMatches: saved?.groupMatches ?? INITIAL_GROUP_MATCHES,
    knockoutMatches: saved?.knockoutMatches ?? INITIAL_KNOCKOUT_MATCHES,
    activeView: { type: "groups", group: "A" },
    playerName: loadPlayerName(),
    rivals: loadRivals(),
    simulationActive: false,
    simulationSnapshot: null,
  };
}
```

- [ ] **Step 2: Add the three simulation cases to the reducer**

Find `fixtureReducer`. Before the `default:` branch, add:

```typescript
case "ENTER_SIMULATION": {
  return {
    ...state,
    mode: "results",
    simulationActive: true,
    simulationSnapshot: {
      groupMatches: state.groupMatches,
      knockoutMatches: state.knockoutMatches,
    },
  };
}
case "EXIT_SIMULATION": {
  if (!state.simulationSnapshot) return state;
  return {
    ...state,
    groupMatches: state.simulationSnapshot.groupMatches,
    knockoutMatches: state.simulationSnapshot.knockoutMatches,
    simulationActive: false,
    simulationSnapshot: null,
  };
}
case "RESET_SIMULATION": {
  if (!state.simulationSnapshot) return state;
  return {
    ...state,
    groupMatches: state.simulationSnapshot.groupMatches,
    knockoutMatches: state.simulationSnapshot.knockoutMatches,
  };
}
```

- [ ] **Step 3: Gate match persistence on `simulationActive`**

Find the `useEffect` that persists `groupMatches`/`knockoutMatches` (around line 107). Add the early return and include `simulationActive` in the dependency array:

```typescript
useEffect(() => {
  if (state.simulationActive) return;
  clearTimeout(saveTimerRef.current);
  saveTimerRef.current = setTimeout(() => {
    saveToLocalStorage({ groupMatches: state.groupMatches, knockoutMatches: state.knockoutMatches });
  }, 500);
  return () => clearTimeout(saveTimerRef.current);
}, [state.groupMatches, state.knockoutMatches, state.simulationActive]);
```

- [ ] **Step 4: Verify build**

```bash
pnpm build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/context/FixtureContext.tsx
git commit -m "feat: add simulation actions and persistence gating to FixtureContext"
```

---

### Task 3: Simulator types and ratings module

**Files:**
- Create: `src/simulator/types.ts`
- Create: `src/simulator/ratings.ts`

- [ ] **Step 1: Create simulator types**

Create `src/simulator/types.ts`:

```typescript
import type { GroupMatch, KnockoutMatch } from "../types";

export type PendingMatch =
  | { kind: "group"; match: GroupMatch }
  | { kind: "knockout"; match: KnockoutMatch };
```

- [ ] **Step 2: Verify team IDs against existing data**

Before writing ratings, check which team IDs exist in the project:

```bash
grep -oE '"[A-Z]{3}"' src/data/teams.ts | sort -u
```

Expected: a list of 48 three-letter team codes. The ratings module below uses the codes known at design time. If any are missing, add them to an appropriate tier; if any are extra here, remove them. The fallback `return 0.55` handles unexpected cases.

- [ ] **Step 3: Create ratings module**

Create `src/simulator/ratings.ts`:

```typescript
/** Tier-based team strength ratings for result simulation. Values in [0, 1]. */

const TIER_S = ["ARG", "BRA", "FRA", "ESP", "ENG"];
const TIER_A = ["GER", "POR", "NED", "ITA", "BEL", "URU", "CRO"];
const TIER_B = [
  "COL", "MEX", "USA", "MAR", "SUI", "DEN", "JPN", "SEN",
  "KOR", "POL", "AUT", "ECU", "AUS",
];
const TIER_C = [
  "CZE", "TUR", "PAR", "CAN", "SCO", "NOR", "EGY",
  "HUN", "NGA", "SRB", "GHA", "CMR",
];
const TIER_D = [
  "HAI", "BIH", "CUW", "QAT", "RSA", "PAN", "NZL",
  "UZB", "VEN", "BOL",
];
const TIER_E = ["MOZ", "PNG", "SUR", "CPV"];

export function getRating(teamId: string): number {
  if (TIER_S.includes(teamId)) return 0.92;
  if (TIER_A.includes(teamId)) return 0.82;
  if (TIER_B.includes(teamId)) return 0.70;
  if (TIER_C.includes(teamId)) return 0.58;
  if (TIER_D.includes(teamId)) return 0.46;
  if (TIER_E.includes(teamId)) return 0.34;
  return 0.55;
}
```

- [ ] **Step 4: Verify build**

```bash
pnpm build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/simulator/types.ts src/simulator/ratings.ts
git commit -m "feat: add simulator types and team rating tiers"
```

---

### Task 4: Poisson sampling with tests

**Files:**
- Create: `src/simulator/poisson.ts`
- Create: `src/simulator/__tests__/poisson.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/simulator/__tests__/poisson.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { samplePoisson } from "../poisson";

describe("samplePoisson", () => {
  it("returns a non-negative integer", () => {
    for (let i = 0; i < 100; i++) {
      const v = samplePoisson(1.3);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns 0 when lambda is 0", () => {
    // lambda=0 means L=1, and since p starts at 1 and multiplies by random [0,1),
    // first iteration gives p<1<=L... actually the loop runs once and returns 0
    expect(samplePoisson(0)).toBe(0);
  });

  it("empirical mean converges to lambda (N=10000, lambda=1.3)", () => {
    const N = 10000;
    const lambda = 1.3;
    let sum = 0;
    for (let i = 0; i < N; i++) sum += samplePoisson(lambda);
    const mean = sum / N;
    expect(Math.abs(mean - lambda)).toBeLessThan(0.1);
  });

  it("empirical mean converges to lambda (N=10000, lambda=2.5)", () => {
    const N = 10000;
    const lambda = 2.5;
    let sum = 0;
    for (let i = 0; i < N; i++) sum += samplePoisson(lambda);
    const mean = sum / N;
    expect(Math.abs(mean - lambda)).toBeLessThan(0.15);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/simulator/__tests__/poisson.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement Poisson sampling**

Create `src/simulator/poisson.ts`:

```typescript
/** Sample a non-negative integer from a Poisson distribution with mean `lambda`. */
export function samplePoisson(lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/simulator/__tests__/poisson.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/simulator/poisson.ts src/simulator/__tests__/poisson.test.ts
git commit -m "feat: add Poisson sampler for goal generation"
```

---

### Task 5: Penalty shootout simulator

**Files:**
- Create: `src/simulator/penalties.ts`
- Create: `src/simulator/__tests__/penalties.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/simulator/__tests__/penalties.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { simulatePenalties } from "../penalties";

describe("simulatePenalties", () => {
  it("never returns a tie", () => {
    for (let i = 0; i < 1000; i++) {
      const { home, away } = simulatePenalties();
      expect(home).not.toBe(away);
    }
  });

  it("returns non-negative integers", () => {
    for (let i = 0; i < 100; i++) {
      const { home, away } = simulatePenalties();
      expect(Number.isInteger(home)).toBe(true);
      expect(Number.isInteger(away)).toBe(true);
      expect(home).toBeGreaterThanOrEqual(0);
      expect(away).toBeGreaterThanOrEqual(0);
    }
  });

  it("winner scored at least one", () => {
    for (let i = 0; i < 1000; i++) {
      const { home, away } = simulatePenalties();
      const winner = Math.max(home, away);
      expect(winner).toBeGreaterThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/simulator/__tests__/penalties.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement penalty simulation**

Create `src/simulator/penalties.ts`:

```typescript
/** Probability a single penalty kick is converted. */
const CONVERSION_RATE = 0.70;

function kick(): boolean {
  return Math.random() < CONVERSION_RATE;
}

/**
 * Simulate a penalty shootout: 5 kicks each, then sudden death until someone misses.
 * Returns the total kicks converted by each side. Never returns a tie.
 */
export function simulatePenalties(): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (let i = 0; i < 5; i++) {
    if (kick()) home++;
    if (kick()) away++;
  }
  while (home === away) {
    const h = kick();
    const a = kick();
    if (h) home++;
    if (a) away++;
  }
  return { home, away };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/simulator/__tests__/penalties.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/simulator/penalties.ts src/simulator/__tests__/penalties.test.ts
git commit -m "feat: add penalty shootout simulator"
```

---

### Task 6: Result generator with tests

**Files:**
- Create: `src/simulator/resultGenerator.ts`
- Create: `src/simulator/__tests__/resultGenerator.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/simulator/__tests__/resultGenerator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateGroupResult, generateKnockoutResult } from "../resultGenerator";

describe("generateGroupResult", () => {
  it("returns non-negative integer scores", () => {
    for (let i = 0; i < 100; i++) {
      const { home, away } = generateGroupResult("ARG", "MAR");
      expect(Number.isInteger(home)).toBe(true);
      expect(Number.isInteger(away)).toBe(true);
      expect(home).toBeGreaterThanOrEqual(0);
      expect(away).toBeGreaterThanOrEqual(0);
    }
  });

  it("favors the stronger team over many samples (Brazil vs Mozambique)", () => {
    const N = 500;
    let braWins = 0;
    for (let i = 0; i < N; i++) {
      const { home, away } = generateGroupResult("BRA", "MOZ");
      if (home > away) braWins++;
    }
    expect(braWins / N).toBeGreaterThan(0.55);
  });

  it("produces roughly balanced results for similar-strength teams", () => {
    const N = 500;
    let argWins = 0;
    let fraWins = 0;
    for (let i = 0; i < N; i++) {
      const { home, away } = generateGroupResult("ARG", "FRA");
      if (home > away) argWins++;
      else if (away > home) fraWins++;
    }
    // Both should win a significant fraction; neither should dominate
    expect(argWins).toBeGreaterThan(N * 0.25);
    expect(fraWins).toBeGreaterThan(N * 0.25);
  });

  it("never includes penalties for a group match", () => {
    for (let i = 0; i < 100; i++) {
      const score = generateGroupResult("ARG", "MAR");
      expect(score.penalties).toBeUndefined();
    }
  });
});

describe("generateKnockoutResult", () => {
  it("includes penalties exactly when the score is a draw", () => {
    for (let i = 0; i < 500; i++) {
      const score = generateKnockoutResult("ARG", "FRA");
      if (score.home === score.away) {
        expect(score.penalties).toBeDefined();
        expect(score.penalties!.home).not.toBe(score.penalties!.away);
      } else {
        expect(score.penalties).toBeUndefined();
      }
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/simulator/__tests__/resultGenerator.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement result generator**

Create `src/simulator/resultGenerator.ts`:

```typescript
import type { Score } from "../types";
import { getRating } from "./ratings";
import { samplePoisson } from "./poisson";
import { simulatePenalties } from "./penalties";

/** Baseline expected goals per team in an evenly-matched World Cup game. */
const BASE_GOALS = 1.3;

function expectedGoals(attackRating: number, defenseRating: number): number {
  const delta = attackRating - defenseRating;
  return Math.max(0.1, BASE_GOALS * (1 + delta));
}

export function generateGroupResult(homeTeamId: string, awayTeamId: string): Score {
  const homeR = getRating(homeTeamId);
  const awayR = getRating(awayTeamId);
  return {
    home: samplePoisson(expectedGoals(homeR, awayR)),
    away: samplePoisson(expectedGoals(awayR, homeR)),
  };
}

export function generateKnockoutResult(homeTeamId: string, awayTeamId: string): Score {
  const base = generateGroupResult(homeTeamId, awayTeamId);
  if (base.home !== base.away) return base;
  return { ...base, penalties: simulatePenalties() };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/simulator/__tests__/resultGenerator.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/simulator/resultGenerator.ts src/simulator/__tests__/resultGenerator.test.ts
git commit -m "feat: add match result generator using Poisson and team ratings"
```

---

### Task 7: Match ordering logic

**Files:**
- Create: `src/simulator/matchOrder.ts`
- Create: `src/simulator/__tests__/matchOrder.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/simulator/__tests__/matchOrder.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { nextPendingMatch } from "../matchOrder";
import type { GroupMatch, KnockoutMatch } from "../../types";

function makeGroupMatch(id: string, dateUtc: string, result: GroupMatch["result"] = null): GroupMatch {
  return {
    id, group: "A", homeTeamId: "ARG", awayTeamId: "MAR",
    dateUtc, venue: "Test", result, prediction: null,
  };
}

function makeKnockoutMatch(
  id: string, dateUtc: string,
  opts: Partial<Pick<KnockoutMatch, "homeTeamId" | "awayTeamId" | "result">> = {},
): KnockoutMatch {
  return {
    id, round: "R32",
    homeSlot: { type: "group", group: "A", position: 1 },
    awaySlot: { type: "group", group: "B", position: 2 },
    homeTeamId: opts.homeTeamId ?? "ARG",
    awayTeamId: opts.awayTeamId ?? "FRA",
    dateUtc, venue: "Test",
    result: opts.result ?? null,
    prediction: null,
  };
}

describe("nextPendingMatch", () => {
  it("returns the chronologically earliest pending group match", () => {
    const groups = [
      makeGroupMatch("G2", "2026-06-12T18:00:00Z"),
      makeGroupMatch("G1", "2026-06-11T18:00:00Z"),
      makeGroupMatch("G3", "2026-06-13T18:00:00Z"),
    ];
    const result = nextPendingMatch(groups, [], new Set());
    expect(result?.kind).toBe("group");
    expect(result?.match.id).toBe("G1");
  });

  it("skips matches that already have a result", () => {
    const groups = [
      makeGroupMatch("G1", "2026-06-11T18:00:00Z", { home: 2, away: 1 }),
      makeGroupMatch("G2", "2026-06-12T18:00:00Z"),
    ];
    const result = nextPendingMatch(groups, [], new Set());
    expect(result?.match.id).toBe("G2");
  });

  it("returns null when nothing is pending", () => {
    const groups = [
      makeGroupMatch("G1", "2026-06-11T18:00:00Z", { home: 2, away: 1 }),
    ];
    expect(nextPendingMatch(groups, [], new Set())).toBeNull();
  });

  it("includes knockout matches only when both team IDs are resolved", () => {
    const groups: GroupMatch[] = [];
    const knockouts = [
      makeKnockoutMatch("K1", "2026-07-01T18:00:00Z", { homeTeamId: null }),
      makeKnockoutMatch("K2", "2026-07-02T18:00:00Z"),
    ];
    const result = nextPendingMatch(groups, knockouts, new Set());
    expect(result?.kind).toBe("knockout");
    expect(result?.match.id).toBe("K2");
  });

  it("interleaves group and knockout matches by date", () => {
    const groups = [makeGroupMatch("G1", "2026-07-05T18:00:00Z")];
    const knockouts = [makeKnockoutMatch("K1", "2026-07-01T18:00:00Z")];
    const result = nextPendingMatch(groups, knockouts, new Set());
    expect(result?.match.id).toBe("K1");
  });

  it("respects the skippedMatches set", () => {
    const groups = [
      makeGroupMatch("G1", "2026-06-11T18:00:00Z"),
      makeGroupMatch("G2", "2026-06-12T18:00:00Z"),
    ];
    const result = nextPendingMatch(groups, [], new Set(["G1"]));
    expect(result?.match.id).toBe("G2");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/simulator/__tests__/matchOrder.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement match ordering**

Create `src/simulator/matchOrder.ts`:

```typescript
import type { GroupMatch, KnockoutMatch } from "../types";
import type { PendingMatch } from "./types";

/**
 * Returns the chronologically earliest unplayed match, respecting a set of skipped match IDs.
 * Knockout matches are only considered pending if both team IDs are resolved.
 */
export function nextPendingMatch(
  groupMatches: GroupMatch[],
  resolvedKnockoutMatches: KnockoutMatch[],
  skipped: Set<string>,
): PendingMatch | null {
  const pending: PendingMatch[] = [];

  for (const m of groupMatches) {
    if (m.result) continue;
    if (skipped.has(m.id)) continue;
    pending.push({ kind: "group", match: m });
  }

  for (const m of resolvedKnockoutMatches) {
    if (m.result) continue;
    if (skipped.has(m.id)) continue;
    if (!m.homeTeamId || !m.awayTeamId) continue;
    pending.push({ kind: "knockout", match: m });
  }

  if (pending.length === 0) return null;

  pending.sort((a, b) => a.match.dateUtc.localeCompare(b.match.dateUtc));
  return pending[0];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/simulator/__tests__/matchOrder.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/simulator/matchOrder.ts src/simulator/__tests__/matchOrder.test.ts
git commit -m "feat: add next-pending-match ordering for simulator"
```

---

### Task 8: Extract computeRanking to scoring utilities

**Files:**
- Modify: `src/utils/scoring.ts`
- Modify: `src/components/RankingView.tsx`

- [ ] **Step 1: Add `RankedPlayer` type and `computeRanking` function to `scoring.ts`**

Open `src/utils/scoring.ts`. At the bottom of the file, add:

```typescript
import type { FixtureState } from "../types";

export interface RankedPlayer {
  name: string;
  isLocal: boolean;
  total: number;
  exact: number;
  winner: number;
  wrong: number;
  pending: number;
}

export function computeRanking(state: FixtureState): RankedPlayer[] {
  const players: RankedPlayer[] = [];

  const localName = state.playerName.trim() || "Yo";
  const localPreds = extractLocalPredictions(state.groupMatches, state.knockoutMatches);
  const localScore = calculatePlayerScore(state.groupMatches, state.knockoutMatches, localPreds);
  players.push({ name: localName, isLocal: true, ...localScore });

  for (const rival of state.rivals) {
    const rivalPreds = extractRivalPredictions(rival);
    const rivalScore = calculatePlayerScore(state.groupMatches, state.knockoutMatches, rivalPreds);
    players.push({ name: rival.name, isLocal: false, ...rivalScore });
  }

  players.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.exact !== a.exact) return b.exact - a.exact;
    return b.winner - a.winner;
  });

  return players;
}
```

Note: `FixtureState` must be imported from `../types`. If `import type { FixtureState }` is not already at the top of the file, add it to the existing type import line.

- [ ] **Step 2: Refactor `RankingView` to use `computeRanking`**

Open `src/components/RankingView.tsx`. Replace the current `useMemo` that computes `ranking` with a call to `computeRanking`:

Before (lines 19-47):
```typescript
const ranking = useMemo(() => {
  const players: RankedPlayer[] = [];
  // ... existing logic
  return players;
}, [state.groupMatches, state.knockoutMatches, state.playerName, state.rivals]);
```

After:
```typescript
const ranking = useMemo(() => computeRanking(state), [state]);
```

Also remove the local `interface RankedPlayer` declaration (lines 6-14) and update the import line:

```typescript
import { computeRanking } from "../utils/scoring";
```

Remove the now-unused imports `calculatePlayerScore`, `extractLocalPredictions`, `extractRivalPredictions` if present.

- [ ] **Step 3: Run all existing tests**

```bash
pnpm test
```

Expected: All tests still PASS (no behavior change).

- [ ] **Step 4: Verify build**

```bash
pnpm build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/scoring.ts src/components/RankingView.tsx
git commit -m "refactor: extract computeRanking from RankingView to scoring utils"
```

---

### Task 9: SimulatorView component (State A — pre-match)

**Files:**
- Create: `src/components/SimulatorView.tsx`
- Create: `src/components/SimulatorView.css`

- [ ] **Step 1: Create the base SimulatorView with State A only**

Create `src/components/SimulatorView.tsx`:

```tsx
import { useState, useMemo } from "react";
import { useFixture } from "../context/FixtureContext";
import { nextPendingMatch } from "../simulator/matchOrder";
import {
  generateGroupResult,
  generateKnockoutResult,
} from "../simulator/resultGenerator";
import { ScoreInput } from "./ScoreInput";
import type { Score } from "../types";
import type { PendingMatch } from "../simulator/types";
import "./SimulatorView.css";

export function SimulatorView() {
  const { state, dispatch, resolvedKnockout } = useFixture();
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [manualEntry, setManualEntry] = useState(false);
  const [manualScore, setManualScore] = useState<Score | null>(null);

  const pending = useMemo(
    () => nextPendingMatch(state.groupMatches, resolvedKnockout, skipped),
    [state.groupMatches, resolvedKnockout, skipped],
  );

  function handleSimulate() {
    if (!pending) return;
    const { homeTeamId, awayTeamId } = pending.match;
    if (!homeTeamId || !awayTeamId) return;
    const score =
      pending.kind === "group"
        ? generateGroupResult(homeTeamId, awayTeamId)
        : generateKnockoutResult(homeTeamId, awayTeamId);
    dispatchResult(pending, score);
  }

  function handleManualSubmit() {
    if (!pending || !manualScore) return;
    dispatchResult(pending, manualScore);
    setManualEntry(false);
    setManualScore(null);
  }

  function handleSkip() {
    if (!pending) return;
    setSkipped((prev) => new Set(prev).add(pending.match.id));
    setManualEntry(false);
    setManualScore(null);
  }

  function dispatchResult(p: PendingMatch, score: Score) {
    if (p.kind === "group") {
      dispatch({ type: "SET_GROUP_SCORE", matchId: p.match.id, score });
    } else {
      dispatch({ type: "SET_KNOCKOUT_SCORE", matchId: p.match.id, score });
    }
  }

  function handleExit() {
    dispatch({ type: "EXIT_SIMULATION" });
    dispatch({ type: "SET_VIEW", view: { type: "ranking" } });
  }

  function handleReset() {
    dispatch({ type: "RESET_SIMULATION" });
    setSkipped(new Set());
    setManualEntry(false);
    setManualScore(null);
  }

  if (!pending) {
    return (
      <div className="simulator-view">
        <div className="simulator-empty">
          <h2>Simulación completa</h2>
          <p>No quedan partidos por simular.</p>
          <div className="simulator-actions">
            <button className="sim-btn primary" onClick={handleExit}>
              Salir y volver al prode real
            </button>
            <button className="sim-btn" onClick={handleReset}>
              Simular de nuevo
            </button>
          </div>
        </div>
      </div>
    );
  }

  const match = pending.match;
  const homeTeam = state.teams.find((t) => t.id === match.homeTeamId);
  const awayTeam = state.teams.find((t) => t.id === match.awayTeamId);
  const isKnockout = pending.kind === "knockout";
  const stageLabel =
    pending.kind === "group"
      ? `Grupo ${(match as { group?: string }).group ?? ""}`
      : (match as { round: string }).round;

  return (
    <div className="simulator-view">
      <div className="simulator-header">
        <h2>Simulación</h2>
        <div className="simulator-header-actions">
          <button className="sim-btn" onClick={handleReset}>Resetear</button>
          <button className="sim-btn danger" onClick={handleExit}>Salir</button>
        </div>
      </div>

      <div className="simulator-match">
        <div className="simulator-match-meta">
          {stageLabel} · {new Date(match.dateUtc).toLocaleString()}
        </div>
        <div className="simulator-match-teams">
          <div className="sim-team">
            <span className="sim-team-flag">{homeTeam?.flag}</span>
            <span className="sim-team-name">{homeTeam?.name}</span>
          </div>
          <span className="sim-vs">vs</span>
          <div className="sim-team">
            <span className="sim-team-flag">{awayTeam?.flag}</span>
            <span className="sim-team-name">{awayTeam?.name}</span>
          </div>
        </div>
      </div>

      {manualEntry ? (
        <div className="simulator-manual">
          <p>Ingresá el resultado:</p>
          <ScoreInput
            score={manualScore}
            onScoreChange={setManualScore}
            allowPenalties={isKnockout}
          />
          <div className="simulator-actions">
            <button
              className="sim-btn primary"
              onClick={handleManualSubmit}
              disabled={!manualScore}
            >
              Confirmar
            </button>
            <button className="sim-btn" onClick={() => { setManualEntry(false); setManualScore(null); }}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="simulator-actions">
          <button className="sim-btn primary" onClick={handleSimulate}>
            ▶ Simular random
          </button>
          <button className="sim-btn" onClick={() => setManualEntry(true)}>
            ✎ Ingresar manual
          </button>
          <button className="sim-btn" onClick={handleSkip}>
            ⏭ Saltar
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the CSS**

Create `src/components/SimulatorView.css`:

```css
.simulator-view {
  padding: 24px;
  max-width: 700px;
  margin: 0 auto;
  color: #ffffff;
}

.simulator-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.simulator-header h2 { font-size: 20px; margin: 0; }
.simulator-header-actions { display: flex; gap: 8px; }

.simulator-match {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  margin-bottom: 20px;
}
.simulator-match-meta {
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  margin-bottom: 16px;
}
.simulator-match-teams {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  font-size: 16px;
}
.sim-team { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.sim-team-flag { font-size: 36px; }
.sim-team-name { font-weight: 600; }
.sim-vs { color: rgba(255, 255, 255, 0.4); font-size: 14px; }

.simulator-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}
.sim-btn {
  padding: 10px 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.sim-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.15); }
.sim-btn:disabled { opacity: 0.4; cursor: default; }
.sim-btn.primary { background: rgba(255, 255, 255, 0.18); }
.sim-btn.primary:hover:not(:disabled) { background: rgba(255, 255, 255, 0.28); }
.sim-btn.danger {
  border-color: rgba(255, 80, 80, 0.3);
  color: #ff6b6b;
}
.sim-btn.danger:hover { background: rgba(255, 80, 80, 0.1); }

.simulator-manual {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 16px;
  text-align: center;
}
.simulator-manual p {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  margin: 0 0 12px;
}

.simulator-empty {
  text-align: center;
  padding: 40px 20px;
}
.simulator-empty h2 { font-size: 20px; margin: 0 0 12px; }
.simulator-empty p { color: rgba(255, 255, 255, 0.6); margin: 0 0 20px; }
```

- [ ] **Step 3: Verify build**

```bash
pnpm build
```

Expected: PASS (the view isn't wired up yet so it won't render, but should compile).

- [ ] **Step 4: Commit**

```bash
git add src/components/SimulatorView.tsx src/components/SimulatorView.css
git commit -m "feat: add SimulatorView base component with pre-match state"
```

---

### Task 10: Add predictions panel to pre-match state

**Files:**
- Modify: `src/components/SimulatorView.tsx`

- [ ] **Step 1: Add helper to build the predictions panel**

Open `src/components/SimulatorView.tsx`. Before the `return` statement in the component, add a predictions list:

```typescript
const matchId = match.id;
const localName = state.playerName.trim() || "Yo";
const localPrediction: Score | null = match.prediction;
type PredRow = { name: string; isLocal: boolean; score: Score | null };
const predictionRows: PredRow[] = [
  { name: localName, isLocal: true, score: localPrediction },
  ...state.rivals.map((r) => ({
    name: r.name,
    isLocal: false,
    score:
      pending.kind === "group"
        ? (r.groupPredictions[matchId] ?? null)
        : (r.knockoutPredictions[matchId] ?? null),
  })),
];
```

Also add `Score` to the imports at the top if not already there.

- [ ] **Step 2: Render the panel in the non-manual branch**

In the `return` JSX, replace the `simulator-actions` block (the non-manual branch) with a wrapped version that includes the predictions panel. Find this block:

```tsx
) : (
  <div className="simulator-actions">
    <button className="sim-btn primary" onClick={handleSimulate}>
      ▶ Simular random
    </button>
    <button className="sim-btn" onClick={() => setManualEntry(true)}>
      ✎ Ingresar manual
    </button>
    <button className="sim-btn" onClick={handleSkip}>
      ⏭ Saltar
    </button>
  </div>
)}
```

Replace with:

```tsx
) : (
  <>
    <div className="simulator-predictions">
      <h3>Predicciones del prode</h3>
      {predictionRows.length === 0 ? (
        <p className="simulator-predictions-empty">Nadie predijo este partido.</p>
      ) : (
        <table className="simulator-predictions-table">
          <tbody>
            {predictionRows.map((row) => (
              <tr key={row.name} className={row.isLocal ? "local" : ""}>
                <td>{row.name}{row.isLocal && <span className="local-tag"> (vos)</span>}</td>
                <td className="pred-score">
                  {row.score ? `${row.score.home} - ${row.score.away}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
    <div className="simulator-actions">
      <button className="sim-btn primary" onClick={handleSimulate}>
        ▶ Simular random
      </button>
      <button className="sim-btn" onClick={() => setManualEntry(true)}>
        ✎ Ingresar manual
      </button>
      <button className="sim-btn" onClick={handleSkip}>
        ⏭ Saltar
      </button>
    </div>
  </>
)}
```

- [ ] **Step 3: Add CSS for the predictions panel**

Open `src/components/SimulatorView.css`. Append:

```css
.simulator-predictions {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 16px;
}
.simulator-predictions h3 {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.simulator-predictions-empty {
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
  margin: 0;
  text-align: center;
}
.simulator-predictions-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.simulator-predictions-table td {
  padding: 8px 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.simulator-predictions-table tr:last-child td { border-bottom: none; }
.simulator-predictions-table tr.local td { font-weight: 600; }
.simulator-predictions-table .local-tag {
  font-weight: 400;
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}
.simulator-predictions-table .pred-score {
  text-align: right;
  font-family: monospace;
  color: rgba(255, 255, 255, 0.9);
}
```

- [ ] **Step 4: Verify build**

```bash
pnpm build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SimulatorView.tsx src/components/SimulatorView.css
git commit -m "feat: show rivals' predictions panel in simulator pre-match state"
```

---

### Task 11: Add post-match state with deltas and ranking

**Files:**
- Modify: `src/components/SimulatorView.tsx`
- Modify: `src/components/SimulatorView.css`

- [ ] **Step 1: Add lastResult and rankingBefore state + transition logic**

Open `src/components/SimulatorView.tsx`. Add imports and state:

```typescript
import { computeRanking } from "../utils/scoring";
import type { RankedPlayer } from "../utils/scoring";
import { scoreMatch } from "../utils/scoring";
```

Inside the component, after the existing `useState` lines, add:

```typescript
const [lastResult, setLastResult] = useState<{
  matchId: string;
  kind: "group" | "knockout";
  score: Score;
  rankingBefore: RankedPlayer[];
} | null>(null);
```

Modify `handleSimulate` to snapshot the ranking first and set `lastResult`:

```typescript
function handleSimulate() {
  if (!pending) return;
  const { homeTeamId, awayTeamId } = pending.match;
  if (!homeTeamId || !awayTeamId) return;
  const score =
    pending.kind === "group"
      ? generateGroupResult(homeTeamId, awayTeamId)
      : generateKnockoutResult(homeTeamId, awayTeamId);
  const rankingBefore = computeRanking(state);
  dispatchResult(pending, score);
  setLastResult({ matchId: pending.match.id, kind: pending.kind, score, rankingBefore });
}
```

Do the same for `handleManualSubmit`:

```typescript
function handleManualSubmit() {
  if (!pending || !manualScore) return;
  const rankingBefore = computeRanking(state);
  dispatchResult(pending, manualScore);
  setLastResult({ matchId: pending.match.id, kind: pending.kind, score: manualScore, rankingBefore });
  setManualEntry(false);
  setManualScore(null);
}
```

Also clear `lastResult` on reset:

```typescript
function handleReset() {
  dispatch({ type: "RESET_SIMULATION" });
  setSkipped(new Set());
  setManualEntry(false);
  setManualScore(null);
  setLastResult(null);
}
```

- [ ] **Step 2: Render post-match state when `lastResult` is set**

At the start of the JSX return (before the `if (!pending)` branch), handle the post-match state:

```tsx
if (lastResult) {
  const rankingAfter = computeRanking(state);
  const prevMatch =
    lastResult.kind === "group"
      ? state.groupMatches.find((m) => m.id === lastResult.matchId)
      : resolvedKnockout.find((m) => m.id === lastResult.matchId);

  const prevHomeTeam = state.teams.find((t) => t.id === prevMatch?.homeTeamId);
  const prevAwayTeam = state.teams.find((t) => t.id === prevMatch?.awayTeamId);

  const winnerText = getWinnerText(lastResult.score, prevHomeTeam?.name, prevAwayTeam?.name);

  // Per-player deltas for this match
  const deltas = rankingAfter.map((after) => {
    const before = lastResult.rankingBefore.find((p) => p.name === after.name);
    const delta = before ? after.total - before.total : 0;
    const posBefore = lastResult.rankingBefore.findIndex((p) => p.name === after.name);
    const posAfter = rankingAfter.findIndex((p) => p.name === after.name);
    let predScore: Score | null = null;
    if (after.isLocal) {
      predScore = prevMatch?.prediction ?? null;
    } else {
      const rival = state.rivals.find((r) => r.name === after.name);
      if (rival) {
        predScore =
          lastResult.kind === "group"
            ? (rival.groupPredictions[lastResult.matchId] ?? null)
            : (rival.knockoutPredictions[lastResult.matchId] ?? null);
      }
    }
    const matchPoints = scoreMatch(lastResult.score, predScore);
    return { player: after, delta, matchPoints, predScore, posBefore, posAfter };
  });

  return (
    <div className="simulator-view">
      <div className="simulator-header">
        <h2>Simulación</h2>
        <div className="simulator-header-actions">
          <button className="sim-btn" onClick={handleReset}>Resetear</button>
          <button className="sim-btn danger" onClick={handleExit}>Salir</button>
        </div>
      </div>

      <div className="simulator-match">
        <div className="simulator-match-teams">
          <div className="sim-team">
            <span className="sim-team-flag">{prevHomeTeam?.flag}</span>
            <span className="sim-team-name">{prevHomeTeam?.name}</span>
          </div>
          <span className="sim-final-score">
            {lastResult.score.home} - {lastResult.score.away}
            {lastResult.score.penalties && (
              <span className="sim-pen">
                {" "}(pen {lastResult.score.penalties.home}-{lastResult.score.penalties.away})
              </span>
            )}
          </span>
          <div className="sim-team">
            <span className="sim-team-flag">{prevAwayTeam?.flag}</span>
            <span className="sim-team-name">{prevAwayTeam?.name}</span>
          </div>
        </div>
        <div className="simulator-winner">{winnerText}</div>
      </div>

      <div className="simulator-deltas">
        <h3>Puntos de este partido</h3>
        <table className="simulator-predictions-table">
          <tbody>
            {deltas.map((d) => (
              <tr key={d.player.name} className={d.player.isLocal ? "local" : ""}>
                <td>{d.player.name}{d.player.isLocal && <span className="local-tag"> (vos)</span>}</td>
                <td className="pred-score">
                  {d.predScore ? `${d.predScore.home}-${d.predScore.away}` : "—"}
                </td>
                <td className="sim-symbol">{symbolFor(d.matchPoints)}</td>
                <td className="sim-delta">+{d.matchPoints}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="simulator-deltas">
        <h3>Ranking actual</h3>
        <table className="simulator-predictions-table">
          <tbody>
            {deltas.map((d) => {
              const diff = d.posBefore >= 0 ? d.posBefore - d.posAfter : 0;
              const arrow = diff > 0 ? `↑${diff}` : diff < 0 ? `↓${-diff}` : "";
              return (
                <tr key={d.player.name} className={d.player.isLocal ? "local" : ""}>
                  <td>{d.posAfter + 1}.</td>
                  <td>{d.player.name}{d.player.isLocal && <span className="local-tag"> (vos)</span>}</td>
                  <td className="pred-score">{d.player.total} pts</td>
                  <td className="sim-arrow">{arrow}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="simulator-actions">
        <button className="sim-btn primary" onClick={() => setLastResult(null)}>
          ▶ Siguiente partido
        </button>
      </div>
    </div>
  );
}
```

Add the two small helpers at the bottom of the file, outside the component:

```typescript
function symbolFor(points: number): string {
  if (points === 3) return "✓";
  if (points === 1) return "½";
  return "✗";
}

function getWinnerText(
  score: Score,
  homeName: string | undefined,
  awayName: string | undefined,
): string {
  if (score.home > score.away) return `Gana ${homeName ?? "local"}`;
  if (score.away > score.home) return `Gana ${awayName ?? "visitante"}`;
  if (score.penalties) {
    const winner = score.penalties.home > score.penalties.away ? homeName : awayName;
    return `Empatan ${score.home}-${score.away}, ${winner} pasa por penales`;
  }
  return "Empatan";
}
```

- [ ] **Step 3: Add CSS for the post-match state**

Open `src/components/SimulatorView.css`. Append:

```css
.sim-final-score {
  font-size: 32px;
  font-weight: 700;
  font-family: monospace;
  color: #ffffff;
  padding: 0 12px;
}
.sim-pen {
  font-size: 13px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.5);
}
.simulator-winner {
  margin-top: 10px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
}
.simulator-deltas {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 12px;
}
.simulator-deltas h3 {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.sim-symbol {
  text-align: center;
  width: 30px;
  font-weight: 700;
}
.sim-delta {
  text-align: right;
  color: #4caf50;
  font-weight: 600;
  width: 50px;
}
.sim-arrow {
  text-align: right;
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
  width: 40px;
}
```

- [ ] **Step 4: Verify build**

```bash
pnpm build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SimulatorView.tsx src/components/SimulatorView.css
git commit -m "feat: add simulator post-match state with per-player deltas and ranking"
```

---

### Task 12: Wire simulator into Sidebar, TopBar, and App routing

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/TopBar.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add conditional "Simulación" item to Sidebar**

Open `src/components/Sidebar.tsx`. After the existing "Salas" item (or the last `sidebar-item`), add:

```tsx
{state.simulationActive && (
  <div
    className={`sidebar-item ${activeView.type === "simulator" ? "active" : ""}`}
    onClick={() => navigate({ type: "simulator" })}>
    <span className="sim-dot">●</span> Simulación
  </div>
)}
```

Open `src/components/Sidebar.css` and append a small style for the dot:

```css
.sim-dot {
  color: #f5a623;
  margin-right: 4px;
  animation: sim-pulse 2s ease-in-out infinite;
}
@keyframes sim-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

- [ ] **Step 2: Add Simulación section to TopBar dropdown**

Open `src/components/TopBar.tsx`. In the dropdown markup, add a new section before the "Fixture" section. The handler:

```tsx
function handleStartSimulation() {
  dispatch({ type: "ENTER_SIMULATION" });
  dispatch({ type: "SET_VIEW", view: { type: "simulator" } });
  setMenuOpen(false);
}

function handleExitSimulation() {
  dispatch({ type: "EXIT_SIMULATION" });
  if (state.activeView.type === "simulator") {
    dispatch({ type: "SET_VIEW", view: { type: "ranking" } });
  }
  setMenuOpen(false);
}
```

And in the dropdown JSX, before the "Fixture" section (before `<div className="dropdown-section">Fixture</div>`):

```tsx
<div className="dropdown-divider" />
<div className="dropdown-section">Simulación</div>
{!state.simulationActive ? (
  <button className="dropdown-item" onClick={handleStartSimulation}>
    <span className="dropdown-icon">▶</span> Iniciar simulación
  </button>
) : (
  <button className="dropdown-item" onClick={handleExitSimulation}>
    <span className="dropdown-icon">■</span> Salir de simulación
  </button>
)}
```

- [ ] **Step 3: Route the simulator view in App**

Open `src/App.tsx`. Add the import at the top:

```tsx
import { SimulatorView } from "./components/SimulatorView";
```

In the main content switch, add one line:

```tsx
{activeView.type === "simulator" && <SimulatorView />}
```

- [ ] **Step 4: Verify build**

```bash
pnpm build
```

Expected: PASS.

- [ ] **Step 5: Manual smoke test**

Run `pnpm dev` and verify:
1. TopBar menu shows "Iniciar simulación"
2. Clicking it navigates to the simulator view
3. Sidebar shows "● Simulación" item (pulsing)
4. Clicking "Simular random" generates a result, switches to post-match state
5. Clicking "Siguiente partido" moves to the next match
6. Clicking "Salir" returns to ranking view
7. After exiting, localStorage state is unchanged from before entering

- [ ] **Step 6: Commit**

```bash
git add src/components/Sidebar.tsx src/components/Sidebar.css src/components/TopBar.tsx src/App.tsx
git commit -m "feat: wire simulator into sidebar, topbar menu, and app routing"
```

---

### Task 13: Reducer tests for simulation actions

**Files:**
- Create: `src/context/__tests__/fixtureReducer.simulation.test.ts`

- [ ] **Step 1: Export the reducer for testing**

Open `src/context/FixtureContext.tsx`. Find the `fixtureReducer` function declaration and add `export` to it:

```typescript
export function fixtureReducer(state: FixtureState, action: FixtureAction): FixtureState {
```

- [ ] **Step 2: Write reducer tests**

Create `src/context/__tests__/fixtureReducer.simulation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { fixtureReducer } from "../FixtureContext";
import type { FixtureState, GroupMatch, KnockoutMatch } from "../../types";

function makeState(overrides: Partial<FixtureState> = {}): FixtureState {
  const groupMatch: GroupMatch = {
    id: "G-A-1", group: "A", homeTeamId: "ARG", awayTeamId: "MAR",
    dateUtc: "2026-06-11T18:00:00Z", venue: "Test",
    result: null, prediction: { home: 2, away: 1 },
  };
  const knockoutMatch: KnockoutMatch = {
    id: "R32-1", round: "R32",
    homeSlot: { type: "group", group: "A", position: 1 },
    awaySlot: { type: "group", group: "B", position: 2 },
    homeTeamId: null, awayTeamId: null,
    dateUtc: "2026-07-01T18:00:00Z", venue: "Test",
    result: null, prediction: null,
  };
  return {
    mode: "predictions",
    teams: [],
    groupMatches: [groupMatch],
    knockoutMatches: [knockoutMatch],
    activeView: { type: "ranking" },
    playerName: "test",
    rivals: [],
    simulationActive: false,
    simulationSnapshot: null,
    ...overrides,
  };
}

describe("ENTER_SIMULATION", () => {
  it("sets simulationActive and snapshots match arrays", () => {
    const state = makeState();
    const next = fixtureReducer(state, { type: "ENTER_SIMULATION" });
    expect(next.simulationActive).toBe(true);
    expect(next.simulationSnapshot).not.toBeNull();
    expect(next.simulationSnapshot!.groupMatches).toBe(state.groupMatches);
    expect(next.simulationSnapshot!.knockoutMatches).toBe(state.knockoutMatches);
  });

  it("forces mode to results", () => {
    const state = makeState({ mode: "predictions" });
    const next = fixtureReducer(state, { type: "ENTER_SIMULATION" });
    expect(next.mode).toBe("results");
  });
});

describe("EXIT_SIMULATION", () => {
  it("restores matches from snapshot and clears simulationActive", () => {
    const entered = fixtureReducer(makeState(), { type: "ENTER_SIMULATION" });
    // Simulate some results by mutating state through a score action
    const withResult = fixtureReducer(entered, {
      type: "SET_GROUP_SCORE", matchId: "G-A-1", score: { home: 3, away: 0 },
    });
    expect(withResult.groupMatches[0].result).toEqual({ home: 3, away: 0 });

    const exited = fixtureReducer(withResult, { type: "EXIT_SIMULATION" });
    expect(exited.simulationActive).toBe(false);
    expect(exited.simulationSnapshot).toBeNull();
    expect(exited.groupMatches[0].result).toBeNull();
    expect(exited.groupMatches[0].prediction).toEqual({ home: 2, away: 1 });
  });

  it("is a no-op when no snapshot exists", () => {
    const state = makeState();
    const next = fixtureReducer(state, { type: "EXIT_SIMULATION" });
    expect(next).toBe(state);
  });
});

describe("RESET_SIMULATION", () => {
  it("restores matches but keeps simulationActive and the snapshot", () => {
    const entered = fixtureReducer(makeState(), { type: "ENTER_SIMULATION" });
    const withResult = fixtureReducer(entered, {
      type: "SET_GROUP_SCORE", matchId: "G-A-1", score: { home: 3, away: 0 },
    });
    const reset = fixtureReducer(withResult, { type: "RESET_SIMULATION" });
    expect(reset.simulationActive).toBe(true);
    expect(reset.simulationSnapshot).not.toBeNull();
    expect(reset.groupMatches[0].result).toBeNull();
  });

  it("is a no-op when no snapshot exists", () => {
    const state = makeState();
    const next = fixtureReducer(state, { type: "RESET_SIMULATION" });
    expect(next).toBe(state);
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
pnpm vitest run src/context/__tests__/fixtureReducer.simulation.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/context/FixtureContext.tsx src/context/__tests__/fixtureReducer.simulation.test.ts
git commit -m "test: add reducer tests for simulation actions"
```

---

### Task 14: Full test suite, lint, and final smoke test

**Files:** None (verification only).

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Expected: All tests pass. Expected count: existing tests + poisson (4) + penalties (3) + resultGenerator (5) + matchOrder (6) + reducer simulation (6) = at least 24 new tests added.

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: No new lint errors introduced. (Pre-existing lint errors may still appear — compare count to prior baseline. New code should be lint-clean.)

- [ ] **Step 3: Run production build**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 4: Manual smoke test**

Run `pnpm dev`. Verify the complete flow:

1. Load predictions in predictions mode for several matches (groups + any early knockout the groups resolve to).
2. Open TopBar menu → "Iniciar simulación". View switches to simulator.
3. Pre-match state shows the first chronological match, predictions panel, and three buttons.
4. Click "Simular random" — post-match state shows result, deltas, ranking with arrows.
5. Click "Siguiente partido" — moves to the next match.
6. Click "Ingresar manual" — ScoreInput appears, enter `2-1`, confirm. Post-match state reflects it.
7. For a knockout match, test a draw scenario via manual entry — verify penalties input appears and the result includes `penalties`.
8. Click "Saltar" — moves past the current match without dispatching.
9. Click "Resetear" — simulation restarts from the pre-simulation state but stays in simulator view.
10. Click "Salir" — exits simulator and navigates to ranking. State matches pre-simulation (verify a few standings).
11. Refresh the browser mid-simulation — should return to the pre-simulation state (ephemeral verification).

- [ ] **Step 5: If any issues found during smoke test, fix and commit**

Only commit if actual fixes were made. Use a targeted commit message describing the fix.
