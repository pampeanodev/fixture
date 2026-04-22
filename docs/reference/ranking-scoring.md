# Ranking & Scoring Reference

How points are computed, how the ranking is ordered, and how the simulator shows deltas. For the full simulator design, see [`../superpowers/specs/2026-04-18-simulator-design.md`](../superpowers/specs/2026-04-18-simulator-design.md).

## TL;DR

- **Per match**: 3 points exact score, 1 point correct winner/draw, 0 otherwise.
- **Ranking tiebreaker**: total → exact → correct-winners.
- **No negative points, no dropped matches.** Missing a prediction = 0, counted as "wrong".
- All the logic lives in [`src/utils/scoring.ts`](../../src/utils/scoring.ts). Pure functions, no React.

## `scoreMatch` — the core formula

```ts
// src/utils/scoring.ts
export function scoreMatch(result: Score | null, prediction: Score | null): number {
  if (!result || !prediction) return 0;
  if (result.home === prediction.home && result.away === prediction.away) return 3;
  if (Math.sign(result.home - result.away) === Math.sign(prediction.home - prediction.away)) return 1;
  return 0;
}
```

Notes:

- **`Math.sign` is the outcome check.** `sign(2-1) === sign(3-1) === 1` → same winner. `sign(0-0) === sign(1-1) === 0` → both draws. `sign(1-2) === -1` → away wins.
- **No prediction = 0 points.** A player who skipped the match gets a zero, not a null. In the ranking it counts toward "wrong" and not toward "pending".
- **Penalties are ignored for scoring.** Only `home`/`away` in regulation matter. The `penalties` field on `Score` exists for knockout propagation ([`src/utils/knockout.ts`](../../src/utils/knockout.ts)) but `scoreMatch` doesn't look at it. A 1-1 prediction with penalties = 1-1 result with penalties is 3 pts; 2-1 prediction vs 1-1 pen-4-3 result is 0 pts.

## `calculatePlayerScore` — aggregates per player

Walks every group match + every knockout match, calls `scoreMatch` for each, accumulates:

```ts
{ total, exact, winner, wrong, pending }
```

- `total` = sum of points (= 3 * exact + 1 * winner).
- `exact` = count of 3-point matches.
- `winner` = count of 1-point matches.
- `wrong` = count of 0-point matches **where a result exists** (i.e., the player had a chance to score). A missing prediction against a played match is `wrong`, not `pending`.
- `pending` = count of matches without a result (not played yet or not entered).

`exact + winner + wrong + pending = total matches`.

## `computeRanking` — the list

```ts
computeRanking(state: FixtureState, localNameFallback?: string): RankedPlayer[]
```

Builds one `RankedPlayer` for the local player (from `state.groupMatches[*].prediction` and `state.knockoutMatches[*].prediction`) plus one for every rival in `state.rivals` (from their imported `groupPredictions`/`knockoutPredictions` maps).

**Sort order** (descending for the first two, ascending for the third only as a positional rule):

1. `total` — more points first.
2. `exact` — more exact scores first (tiebreaker 1).
3. `winner` — more correct winners first (tiebreaker 2).

If all three are equal, players stay in insertion order (local first, then rivals in the order they were added). There is no further deterministic tiebreaker by design — the UI treats such ties as genuinely tied.

### `localNameFallback`

The local player's row needs a display name. If `state.playerName` is empty, the fallback is used. Views pass `t("common.youFallback")` (localized "Yo"/"Me"/"Eu"); non-view callers (there aren't any today) can omit and get `"Yo"`.

## The data flow, end to end

```
Local user edits a prediction in a GroupView / BracketView ScoreInput
          │
          ▼
  dispatch(SET_GROUP_SCORE | SET_KNOCKOUT_SCORE) to FixtureReducer
          │
          ▼
  FixtureContext persists the updated match array to localStorage
          │
          ├────── If in a room: useNostrSync publishes a new commitment
          │       (see docs/reference/nostr-sync.md)
          ▼
  RankingView / SimulatorView useMemo(() => computeRanking(state, t(fallback)))
          │
          ▼
  Render the ranking table

Real results arrive via:
  (a) creator admin push → APPLY_SYNCED_RESULTS → same dispatch pipeline
  (b) manual entry in "Results" mode → SET_*_SCORE → same
  (c) JSON import → IMPORT_STATE → same
```

`computeRanking` is called on every relevant render. It's a pure tree-walk over `state.groupMatches` + `state.knockoutMatches` + `state.rivals`. At 104 matches × ~5 rivals = ~500 scoring ops, which is sub-millisecond — no memoization gymnastics needed beyond the `useMemo` at call sites.

## Simulator deltas

The simulator needs to show "how much did each player move because of this match?". In [`src/components/SimulatorView.tsx`](../../src/components/SimulatorView.tsx):

1. Before dispatching the result, capture `rankingBefore = computeRanking(state, t("common.youFallback"))`.
2. Dispatch the result.
3. On the next render, compute `rankingAfter = computeRanking(state, t("common.youFallback"))`.
4. For each player in `rankingAfter`, find their counterpart in `rankingBefore` by name. `delta = after.total - before.total`. Also derive `posBefore`/`posAfter` from array indices.
5. `scoreMatch(thisMatchResult, thisPlayerPrediction)` gives the per-match points earned, rendered in the delta row.

Matching is by **`name`**, not by pubkey or some stable ID. Two players with the same display name would collide; that's a known limitation of the current `Rival` shape.

## Pending state mechanics

`pending` is different from `wrong`:

- `pending` = **we haven't played yet**. No result exists.
- `wrong` = **we played, and the player didn't predict** (or predicted incorrectly).

A tricky case: if a match has a `prediction` but no `result`, it's `pending` — we don't score what hasn't been decided. This means you can edit your prediction freely until the match has a result (or the 1h lock kicks in, see [business-rules](./business-rules.md)).

## Touchpoints to know

- [`src/components/RankingView.tsx`](../../src/components/RankingView.tsx) — main ranking UI, also shows rules panel explaining scoring.
- [`src/components/SimulatorView.tsx`](../../src/components/SimulatorView.tsx) — delta table + live ranking post-simulation.
- [`src/utils/__tests__/standings.test.ts`](../../src/utils/__tests__/standings.test.ts) — group-stage standings tests (related but different: league points, not prode points).
- There is no dedicated `scoring.test.ts` today. If you change `scoreMatch` or `computeRanking`, add one.

## Gotchas

- **Adding a new scoring category means updating `RankedPlayer`, `calculatePlayerScore`, `RankingView` column headers, and all 3 locale files under `ranking.*`.** The consistency test will catch the locale miss. The columns are manually listed in `RankingView` — there's no auto-schema.
- **Don't add a tiebreaker silently** without updating the "how it works" text under `ranking.rule*` and `ranking.tiebreak*`. Users read that panel.
- **The local player's name can contain spaces and emojis.** Don't normalize; the matching by name is exact-string equality.
- **Simulation doesn't touch scoring logic.** It produces synthetic results that flow through the same `SET_*_SCORE` → `computeRanking` path. Ranking differences between real and sim are purely due to the results being synthetic; the math is identical.
