# Match Simulator for Prode Testing

**Date**: 2026-04-18
**Status**: Approved

## Overview

Add a match-by-match simulator so users can playtest the prode before the World Cup starts. Each user loads their predictions, exchanges them as rivals (via JSON export/import or Nostr rooms), then one device drives a simulation: for each pending match in chronological order, they see all rivals' predictions, generate a realistic result (or enter one manually), and observe how standings, knockout resolution, and ranking update step by step. Simulation is ephemeral — exiting restores the real state untouched.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Where simulated results live | Snapshot + overwrite `match.result` | Reuses the full existing pipeline (standings, knockout resolution, scoring) with zero duplication |
| Persistence | Ephemeral (not persisted to localStorage) | Guarantees the real prode state is never corrupted by a simulation accidentally left active |
| Mode during simulation | Forced `mode: "results"` | Clear mental boundary — during simulation you play the future; outside you load/view the real tournament |
| Result distribution | Poisson with per-team ratings | Produces realistic scorelines where favorites usually win but upsets happen |
| Ratings source | Hardcoded tiers (6 levels) | 48 teams is too many for individual values; tiers are maintainable |
| Home advantage | Ignored | No real home team in the World Cup except for host-country group matches |
| Extra time | Not modeled explicitly | The data model (`Score`) doesn't distinguish regular/extra time — scoring only cares about final `home`/`away` counts |
| Penalties | Generated only on draws in knockout | Matches the existing `Score.penalties` field semantics (only present on draws that went to shootouts) |
| UX | Dedicated sidebar view ("Simulación") | Rich enough to show rivals' predictions side-by-side, per-match deltas, and live ranking changes |
| Entry point | TopBar dropdown menu | Real feature, not dev-only — expected to be used by non-technical users |

## 1. State Model

Two new fields on `FixtureState`:

```typescript
interface FixtureState {
  // ... existing fields
  simulationActive: boolean;
  simulationSnapshot: {
    groupMatches: GroupMatch[];
    knockoutMatches: KnockoutMatch[];
  } | null;
}
```

Three new actions on `FixtureAction`:

```typescript
type FixtureAction =
  // ... existing actions
  | { type: "ENTER_SIMULATION" }
  | { type: "EXIT_SIMULATION" }
  | { type: "RESET_SIMULATION" };
```

**Reducer behavior:**

- `ENTER_SIMULATION`: sets `simulationActive: true`, stores the current `groupMatches` + `knockoutMatches` in `simulationSnapshot`, forces `mode: "results"`. No match data is modified; subsequent `SET_GROUP_SCORE`/`SET_KNOCKOUT_SCORE` dispatches will overwrite `match.result` in place.
- `EXIT_SIMULATION`: restores `groupMatches` and `knockoutMatches` from `simulationSnapshot`, sets `simulationActive: false`, clears `simulationSnapshot`.
- `RESET_SIMULATION`: restores from `simulationSnapshot` but keeps `simulationActive: true` and the snapshot intact. Use case: start the simulation over from the same pre-simulation state.

**Initial state** (`buildInitialState`): always starts with `simulationActive: false` and `simulationSnapshot: null`, regardless of localStorage contents.

## 2. Persistence

The existing persistence effect that saves `{ groupMatches, knockoutMatches }` to `localStorage` with a 500ms debounce is gated by `simulationActive`:

```typescript
useEffect(() => {
  if (state.simulationActive) return;
  // ... existing debounced save
}, [state.groupMatches, state.knockoutMatches, state.simulationActive]);
```

This means:
- During simulation, localStorage stays frozen at the last non-simulated state.
- If the user refreshes the browser mid-simulation, they return to that pre-simulation state (simulation is lost).
- Predictions and rivals are unaffected — their persistence runs independently.

**Invariant**: the contents of localStorage never reflect a simulated result. A user exporting their prode JSON during simulation always exports their real predictions (predictions are never mutated during simulation, only `result` fields).

## 3. Result Generation

### Ratings (`src/simulator/ratings.ts`)

Six tiers covering all 48 teams. Rating is a float in `[0, 1]` representing overall team strength:

| Tier | Rating | Teams (approximate) |
|------|--------|---------------------|
| S | 0.92 | ARG, BRA, FRA, ESP, ENG |
| A | 0.82 | GER, POR, NED, ITA, BEL, URU, CRO |
| B | 0.70 | COL, MEX, USA, MAR, SUI, DEN, JPN, SEN, KOR, POL, AUT, ECU, AUS |
| C | 0.58 | CZE, TUR, PAR, CAN, SCO, NOR, EGY, HUN, NGA, SRB, GHA, CMR |
| D | 0.46 | HAI, BIH, CUW, QAT, RSA, PAN, NZL, UZB, VEN, BOL |
| E | 0.34 | MOZ, PNG, SUR, CPV |

Exact team lists verified against `src/data/teams.ts` during implementation. Fallback rating of `0.55` for any team not in the tiers.

### Poisson (`src/simulator/poisson.ts`)

Standard Knuth algorithm. Given `lambda` (expected goals), return a non-negative integer sample:

```typescript
function samplePoisson(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}
```

### Group result (`src/simulator/resultGenerator.ts`)

```typescript
const BASE_GOALS = 1.3;

function expectedGoals(attackRating: number, defenseRating: number): number {
  const delta = attackRating - defenseRating;
  return Math.max(0.1, BASE_GOALS * (1 + delta));
}

function generateGroupResult(homeTeamId: string, awayTeamId: string): Score {
  const homeR = getRating(homeTeamId);
  const awayR = getRating(awayTeamId);
  return {
    home: samplePoisson(expectedGoals(homeR, awayR)),
    away: samplePoisson(expectedGoals(awayR, homeR)),
  };
}
```

### Knockout result

Same as group result, but if the sampled scoreline is a draw, a penalty shootout is generated. The final `Score` has `penalties` set only in that case.

```typescript
function generateKnockoutResult(homeTeamId: string, awayTeamId: string): Score {
  const base = generateGroupResult(homeTeamId, awayTeamId);
  if (base.home !== base.away) return base;
  const penalties = simulatePenalties();
  return { ...base, penalties };
}
```

### Penalty shootout (`src/simulator/penalties.ts`)

Five kicks each with 70% conversion rate, then sudden death until one misses:

```typescript
function simulatePenalties(): { home: number; away: number } {
  let home = 0, away = 0;
  const kick = () => Math.random() < 0.70;
  for (let i = 0; i < 5; i++) {
    if (kick()) home++;
    if (kick()) away++;
  }
  while (home === away) {
    const h = kick(), a = kick();
    if (h) home++;
    if (a) away++;
  }
  return { home, away };
}
```

## 4. Match Ordering

`src/simulator/matchOrder.ts` exports `nextPendingMatch(groupMatches, resolvedKnockout)`:

1. Collect all group matches with `result === null`.
2. Collect all resolved knockout matches with `result === null` AND `homeTeamId !== null` AND `awayTeamId !== null` (teams must be resolved).
3. Sort by `dateUtc` ascending.
4. Return the first element, or `null` if empty.

**Key point**: the function takes `resolvedKnockout` (the `useMemo`'d array from `FixtureContext` that has team IDs filled in by `resolveKnockoutTeams`), not `state.knockoutMatches` directly. This ensures knockout matches whose feeding group matches haven't been played yet are automatically skipped — they'll become eligible once upstream results are available.

## 5. Simulator View

`src/components/SimulatorView.tsx` is the dedicated simulation surface. It has three states:

### State A — Pre-match

Displays:
- Header: "Simulación · Partido N/88" with `[Salir]` and `[Resetear]` buttons
- Match info: stage (group X or knockout round), date, venue, team flags and names
- Predictions panel: local player's prediction + each rival's prediction for this match (or "—" if missing)
- Actions: `[▶ Simular random]`, `[✎ Ingresar manual]`, `[⏭ Saltar]`

**Saltar** uses a local `skippedMatches: Set<string>` in the component state. Skipped match IDs are passed to `nextPendingMatch` as an additional exclusion filter. Skips are lost on view unmount or simulation exit — they're purely navigational.

**Ingresar manual** expands an inline `ScoreInput` (reuses the existing component). For knockout matches that would be a draw, the component also renders penalty inputs (the existing `allowPenalties` prop already handles this).

### State B — Post-match

After `Simular random` or `Ingresar manual` submit, the view snapshots the ranking, dispatches `SET_GROUP_SCORE` / `SET_KNOCKOUT_SCORE`, and transitions to State B. Displays:

- Match with final score prominently
- Winner/draw statement ("¡Gana Argentina!", "Empatan", "Pasa a penales Argentina 5-4")
- Per-player delta table: what each rival predicted, their symbol (`✓` / `½` / `✗`), and points earned this match
- Ranking table with up/down arrows showing movement since the previous state
- `[▶ Siguiente partido]` button

Computing the per-match delta requires knowing each player's points before and after. The simplest approach: call `calculatePlayerScore` on both `rankingBefore` (local snapshot) and the live state, then subtract totals.

### State C — Finished

Reached when `nextPendingMatch` returns `null` (plus no skipped matches remain). Displays:
- Trophy banner
- Final ranking
- Summary stats: matches simulated, champion (winner of `matches.find(m => m.round === "F")`)
- `[✓ Salir y volver al prode real]`, `[⟲ Simular de nuevo]`

## 6. Navigation & Entry Point

### Sidebar

A new item, conditional on `simulationActive`:

```tsx
{state.simulationActive && (
  <div className={`sidebar-item ${activeView.type === "simulator" ? "active" : ""}`}
       onClick={() => navigate({ type: "simulator" })}>
    <span className="sim-dot">●</span> Simulación
  </div>
)}
```

The `●` is a colored dot (amber) indicating active simulation.

### TopBar dropdown

A new section in the dropdown menu:

```
Cuenta
  └── Mi cuenta
Simulación                    ← new
  └── Iniciar simulación      ← only when !simulationActive
  └── Salir de simulación     ← only when simulationActive
Fixture
  ├── Exportar todo
  └── Importar todo
```

Clicking "Iniciar simulación":
1. `dispatch({ type: "ENTER_SIMULATION" })`
2. `dispatch({ type: "SET_VIEW", view: { type: "simulator" } })`

Clicking "Salir de simulación" (from anywhere):
1. `dispatch({ type: "EXIT_SIMULATION" })`
2. If `activeView.type === "simulator"`, also dispatch `{ type: "SET_VIEW", view: { type: "ranking" } }`

### ViewTarget extension

```typescript
export type ViewTarget =
  | // ... existing variants
  | { type: "simulator" };
```

### Routing

`App.tsx` adds one line in the main content area:

```tsx
{activeView.type === "simulator" && <SimulatorView />}
```

## 7. Extracted Ranking Helper

`SimulatorView` needs to compute the full ranking (same logic as `RankingView`) for the pre/post delta comparison. To avoid duplication, the computation is extracted to `src/utils/scoring.ts`:

```typescript
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
  // ... logic currently inside RankingView's useMemo
}
```

`RankingView` is refactored to call `computeRanking(state)`.

## 8. File Structure

```
src/
├── simulator/
│   ├── types.ts                  — PendingMatch type
│   ├── ratings.ts                — TEAM tiers + getRating()
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
├── utils/scoring.ts              — MODIFY (extract computeRanking)
├── components/RankingView.tsx    — MODIFY (use computeRanking)
├── components/Sidebar.tsx        — MODIFY (conditional item)
├── components/TopBar.tsx         — MODIFY (Simulación menu section)
├── types.ts                      — MODIFY (state/action/ViewTarget)
└── App.tsx                       — MODIFY (route simulator view)
```

## 9. Testing Strategy

**Unit tests:**
- `samplePoisson`: empirical mean of 10,000 samples for λ=1.3 is within ±0.05 of 1.3
- `simulatePenalties`: never returns a tie; 1000 runs verify both always produce a winner
- `generateGroupResult`: with seeded `Math.random`, distribution over 1000 runs shows stronger team wins majority when rating gap is large
- `generateKnockoutResult`: every returned `Score` with `home === away` has `penalties` defined, and every one with `home !== away` has `penalties` undefined
- `nextPendingMatch`:
  - Returns chronologically earliest unplayed match
  - Skips knockout matches with null team IDs
  - Returns null when nothing pending
  - Respects the skippedMatches filter

**Reducer tests:**
- `ENTER_SIMULATION` forces `mode: "results"` and populates `simulationSnapshot`
- `EXIT_SIMULATION` restores match data from snapshot and clears `simulationActive`
- `RESET_SIMULATION` restores match data but keeps `simulationActive: true`
- Snapshot immutability: modifying `state.groupMatches` after entering simulation doesn't alter `simulationSnapshot.groupMatches`

**Integration test:**
- Enter simulation → simulate 5 group matches → exit simulation → verify `state.groupMatches` deep-equals the pre-simulation array (nothing mutated)

**Existing tests:** standings, bestThirds, knockout resolution, scoring, lockTime — all remain unchanged and must continue to pass.

## 10. Out of Scope

- **Deterministic seeding**: `Math.random()` is used directly. A seeded RNG would make simulations reproducible but adds complexity with limited value for manual playtesting.
- **Replay history**: no record of past simulations. Each `RESET_SIMULATION` starts fresh.
- **Multiplayer simulation**: only one user drives the simulation. Rivals' predictions are read-only; their devices would run their own local simulations if they wanted.
- **Goleador / tournament stats**: would require tracking goals per team/player. Not needed for the core use case of testing prode scoring.
- **Dev-only gating**: this is a real user-facing feature, not hidden behind `import.meta.env.DEV`.
- **Seeded scenarios**: no "what if Argentina loses to Morocco" preset simulations. Manual entry covers this use case.

## 11. Bundle Impact

Estimated additions:
- `ratings.ts`: ~1 KB (team tier arrays)
- `poisson.ts`, `penalties.ts`, `resultGenerator.ts`, `matchOrder.ts`: ~0.5 KB combined
- `SimulatorView.tsx` + CSS: ~3 KB

Total: ~4-5 KB gzipped. No new dependencies.
