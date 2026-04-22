# Business Rules Reference

World Cup 2026 tournament logic as implemented in this codebase. For fixture design rationale, see [`../superpowers/specs/2026-04-12-world-cup-fixture-design.md`](../superpowers/specs/2026-04-12-world-cup-fixture-design.md).

## Tournament shape

- **48 teams**, 12 groups of 4 (groups A–L).
- **72 group matches** (6 per group, full round-robin).
- **32 knockout matches**: 32avos (16 matches, R32) → Octavos (8, R16) → Cuartos (4, QF) → Semis (2, SF) → 3rd-place (1, 3P) → Final (1, F) = **32 total** (104 with group stage).
- **Top 2 of each group** (24 teams) + **best 8 of the 12 third-placed teams** (8 teams) = 32 qualifiers to R32.

## Group standings

[`src/utils/standings.ts`](../../src/utils/standings.ts).

Signature: `calculateStandings(matches, teamIds, scoreField = "result")`.

Computes a per-team `StandingRow` (played/won/drawn/lost/GF/GA/GD/points) by scanning matches. Can run against `"result"` (real) or `"prediction"` (prode mode) — that's how the UI recomputes standings based on predictions without mutating real match data.

### Points

- Win: 3. Draw: 1. Loss: 0.

### Tiebreakers (sort order)

1. `points` (desc)
2. `goalDifference` (desc)
3. `goalsFor` (desc)

No further tiebreakers. In real FIFA rules there are more (head-to-head, fair play, drawing of lots), but they'd require data the app doesn't have, and the simplification is acceptable for a prode.

## Best thirds

The algorithm that decides which 8 of the 12 third-placed teams advance to R32.

### Ranking the thirds

[`src/utils/bestThirds.ts#rankThirdPlacedTeams`](../../src/utils/bestThirds.ts):

1. `points` (desc)
2. `goalDifference` (desc)
3. `goalsFor` (desc)
4. **Group letter (asc)** as a deterministic final tiebreaker (`a.group.localeCompare(b.group)`). In real FIFA this is drawing of lots; we use alphabetical for determinism so the simulator and the UI agree.

`selectBestThirds` takes the top 8 as `qualifying`, the rest as `eliminated`.

### Assigning thirds to R32 slots

This is the tricky part. Each R32 match with a "best_third" slot only accepts thirds from a specific subset of groups (FIFA's rule to avoid same-confederation rematches). The 8 slots and their eligibility:

| R32 slot | Eligible third-placed groups |
|---|---|
| R32-2 | A, B, C, D, F |
| R32-5 | C, D, F, G, H |
| R32-7 | C, E, F, H, I |
| R32-8 | E, H, I, J, K |
| R32-9 | B, E, F, I, J |
| R32-10 | A, E, H, I, J |
| R32-13 | E, F, G, I, J |
| R32-15 | D, E, I, J, L |

Source: [`src/data/thirdPlaceMapping.ts`](../../src/data/thirdPlaceMapping.ts). The algorithm:

1. Sort qualifying groups alphabetically.
2. Iteratively pick the group with **fewest remaining eligible slots** (most constrained first — "constraint propagation").
3. Assign it to the slot that has **fewest remaining eligible groups** (again most constrained first).
4. Mark the slot used, remove the group from the pool, repeat.

This greedy algorithm always terminates with a valid assignment when the qualifying-groups set is consistent with the eligibility table. It does NOT reproduce FIFA's official assignment table (which is a lookup by "which groups qualified" — all 495 cases precomputed). Our greedy matches FIFA in common cases; in pathological cases it may differ but will always be self-consistent.

### Group → R32 assignment lookup

Output of `assignThirdPlaceSlots(qualifyingGroups)` is `Record<group, matchId>` — "if the third from group X qualifies, they play R32 match Y".

## Knockout bracket resolution

[`src/utils/knockout.ts#resolveKnockoutTeams`](../../src/utils/knockout.ts) walks rounds in order (R32 → R16 → QF → SF → 3P → F) and fills `homeTeamId` / `awayTeamId` on each match based on its `homeSlot` / `awaySlot` definition:

| Slot type | Resolution |
|---|---|
| `{ type: "group", group, position: 1 \| 2 }` | Current standings of that group at that position (based on prediction or result mode) |
| `{ type: "best_third", possibleGroups }` | Map from the best-thirds assignment: if one of `possibleGroups` qualified AND was assigned to this match, use its 3rd-place team |
| `{ type: "winner", matchId }` | Winner of the referenced earlier match (by regulation goals, then penalties if defined) |
| `{ type: "loser", matchId }` | Loser — only used for 3rd-place match |

### `getWinner` logic

```ts
// score.home > score.away  → home wins
// score.home < score.away  → away wins
// tied + penalties present → compare penalties.home vs penalties.away
// tied + no penalties      → null (unresolved, prediction incomplete)
```

### Prediction cascade side effect

When `resolveKnockoutTeams` runs and detects that a match's `homeTeamId` or `awayTeamId` **changed** from the previous resolution (because an earlier match's result changed, rippling downstream), it **clears that match's `result` and `prediction`**. Rationale: a prediction about "Argentina vs Brazil" makes no sense if the bracket now says it's "France vs Germany" — so we drop it. The user re-enters.

This is why you see predictions disappear in the bracket when you edit a group result that changes who qualifies.

## Match lock (1h before kickoff)

[`src/utils/lockTime.ts`](../../src/utils/lockTime.ts):

```ts
LOCK_OFFSET_MS = 60 * 60 * 1000  // 1 hour

isMatchLocked(dateUtc) === getEffectiveNow() >= (dateUtc - 1h)
```

Once locked:

- `ScoreInput` becomes read-only, shows a lock badge.
- In a room context, `useNostrSync` publishes the commit-reveal **reveal** for the locked match (see [nostr-sync reference](./nostr-sync.md)).
- Predictions can't be edited; real results can still be entered (the admin enters them post-match).

### `getEffectiveNow` indirection

[`src/utils/devClock.ts`](../../src/utils/devClock.ts) lets dev/QA time-travel. In production, `getEffectiveNow() === Date.now()`. The dev clock overrides it via a localStorage value so you can test "what the UI looks like 30 minutes before Mexico vs South Africa" without waiting for June 2026. Never call `Date.now()` directly for business logic — use `getEffectiveNow()`.

## Modes: Results vs Predictions

`FixtureState.mode` is `"results" | "predictions"`. Default is `"predictions"` (commit [`61bc63d`](https://github.com/pampeanodev/fixture/commit/61bc63d)).

- **Predictions mode**: `ScoreInput` writes to `match.prediction`. Standings and knockout resolve against `prediction`. This is what users see when they're filling out their prode.
- **Results mode**: `ScoreInput` writes to `match.result`. Standings resolve against `result`. This is the "real tournament" view.

Both fields coexist on every match — entering one doesn't touch the other. Switching modes is pure UI.

**Admin-pushed results** (creator's published real results) always go to `match.result`, regardless of the local user's mode. The local user's predictions are untouched.

## Simulation

Ephemeral mode where you play the entire tournament before it starts. [`src/simulator/`](../../src/simulator/):

1. On `ENTER_SIMULATION`, snapshot current `groupMatches` + `knockoutMatches` into `state.simulationSnapshot`.
2. User simulates matches one at a time (random via Poisson ratings, manual, or skip).
3. Each sim dispatch is a normal `SET_*_SCORE` — the cascade (standings, knockout resolution, scoring) runs as always.
4. On `EXIT_SIMULATION`, restore from snapshot.
5. **Reloading the browser also exits simulation** — `simulationSnapshot` is in-memory state (`FixtureContext` provider state), not persisted to localStorage. This is deliberate: simulations shouldn't ever leak into real data.

### Simulator match order

[`src/simulator/matchOrder.ts#nextPendingMatch`](../../src/simulator/matchOrder.ts) picks the next match to simulate, in chronological order by `dateUtc`, skipping matches the user chose to skip in this session. Knockout matches only become available when both slots resolve to actual teams (group results are in).

### Random result generation

[`src/simulator/resultGenerator.ts`](../../src/simulator/resultGenerator.ts) uses a Poisson model with team strength tiers from [`src/simulator/ratings.ts`](../../src/simulator/ratings.ts). Tiers are hand-assigned (S/A/B/C/D based on FIFA ranking at time of writing) — adjust `TEAM_RATINGS` if a team surges/slumps before the tournament.

Knockouts requiring a winner: if a draw is generated, penalties are sampled via [`src/simulator/penalties.ts`](../../src/simulator/penalties.ts) (sudden-death coin flips).

## Invariants worth knowing

- **Every group match has exactly 2 team IDs** (known at tournament start — the draw happened). They never change.
- **Knockout matches have teams only after resolution.** `homeTeamId`/`awayTeamId` are `string | null`. Before group results, many are `null`.
- **A prediction lives on the match record.** There is no separate "predictions" table. `match.prediction = null` means "not predicted".
- **Rivals live on `state.rivals`.** They're imports — the local user adds a rival via the rooms/sync flow or via JSON import. Rivals don't have their own fixture state; they're just `{ name, groupPredictions: Record<matchId, Score>, knockoutPredictions: Record<matchId, Score> }`.
- **`state.members`** is distinct from `state.rivals`. Members are pubkeys in the active room (for display in the member list). Rivals are players with predictions to score against. They overlap but aren't the same set — a member who hasn't revealed any prediction yet is a member but not a rival.

## Gotchas

- **`assignThirdPlaceSlots` depends on which groups qualified.** If your test setup forgets to compute standings before calling it, you get an empty assignment. The flow is: standings → bestThirds.selectBestThirds → qualifyingGroups → assignThirdPlaceSlots → knockout resolution.
- **The knockout structure in [`src/data/knockoutStructure.ts`](../../src/data/knockoutStructure.ts) encodes 32 matches with slot definitions.** If FIFA changes the format (adds/removes a round), this file and the `KnockoutRound` union in `types.ts` both need updating, plus `knockout.rounds.*` and `knockout.roundTitle.*` translation keys in all 3 locales.
- **Standings sort stability matters for best thirds.** If two teams tie on all three criteria within a group, the current sort is not stable-by-teamId — it depends on match iteration order. In practice this never happens at the world cup level, but if you hit it during testing, add `teamId` as a final tiebreaker.
- **Prediction cascade is destructive.** Editing a group result that flips who finishes 1st vs 2nd will null out downstream knockout predictions. Warn the user before edits in Predictions mode if you ever add a "bulk edit" feature.
- **`simulationActive` guards many dispatches.** When true, don't persist to localStorage; this is how simulation stays ephemeral. Check `FixtureContext.tsx` for the exact boundary if you add new dispatch handlers.
