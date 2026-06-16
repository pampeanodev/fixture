# Unified Match View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement spec f5.2 — a single match view that shows prediction + real result together with a non-shifting points indicator, no Predicciones/Resultados toggle, and the ranking integrated into the room context.

**Architecture:** Three independent, separately-committable phases. Phase A decouples the score-write field from `state.mode` in the reducer (the only pure-logic change, TDD'd). Phase B makes the indicator a fixed-width column. Phase C builds the unified row (prediction inputs + read-only result badge, inline-editable only in fallback) and removes the mode toggle. Phase D removes the standalone ranking nav and surfaces the ranking inside rooms.

**Tech Stack:** React 19 + TypeScript, vanilla CSS, Vitest. Reducer in `src/context/FixtureContext.tsx`; match rows in `src/components/`.

**Conventions for this codebase (read before starting):**
- Components are NOT unit-tested; integration is verified via `pnpm run build` (runs `tsc -b`) + manual smoke in `pnpm run dev`. Only pure logic (reducer/utils) gets Vitest tests. This plan follows that: TDD for Phase A, build+smoke for the rest.
- Never use `any`. Use `satisfies` over assertions.
- Files in `src/components/` have a 200-line soft limit enforced by `.claude/hooks/check-component-size.sh`. `ScheduleView.tsx` (~286) and `GroupView.tsx` (~248) are already over — this plan EXTRACTS their inline card components into `src/components/<feature>/` sub-files so the change doesn't grow the over-limit files.
- i18n: any ES key added/removed must be mirrored in `en.ts` and `pt.ts`; the `Messages = Widen<typeof es>` check fails the build otherwise.
- Commit only the files listed per task. Never `--no-verify`.

---

## Phase A — Decouple score-write field from `state.mode` (reducer, TDD)

Today `SET_GROUP_SCORE` / `SET_KNOCKOUT_SCORE` choose the target field (`prediction` vs `result`) from `state.mode`. The unified row writes predictions and (fallback) results from the *same* screen, so the caller must say which field. Add an optional `field` to both actions; when absent, keep the `state.mode` behavior so the simulator (which dispatches under `mode: "results"`) is unaffected.

### Task A1: Add `field` to the score actions (type + reducer + test)

**Files:**
- Modify: `src/types.ts` (the `SET_GROUP_SCORE` / `SET_KNOCKOUT_SCORE` members of `FixtureAction`)
- Modify: `src/context/FixtureContext.tsx:23-53` (the two reducer cases)
- Test: `src/context/__tests__/fixtureReducer.scoreField.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `src/context/__tests__/fixtureReducer.scoreField.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fixtureReducer } from "../FixtureContext";
import type { FixtureState, GroupMatch } from "../../types";
import { TEAMS } from "../../data/teams";

function state(groupMatches: GroupMatch[], mode: "results" | "predictions"): FixtureState {
  return {
    mode, teams: TEAMS, groupMatches, knockoutMatches: [],
    activeView: { type: "schedule" }, playerName: "", rivals: [], members: [],
    syncedResultIds: [], simulationActive: false, simulationSnapshot: null,
  };
}

function gm(id: string, overrides: Partial<GroupMatch> = {}): GroupMatch {
  return {
    id, group: "A", homeTeamId: "ARG", awayTeamId: "MEX",
    dateUtc: "2026-06-15T18:00:00Z", venue: "Test", result: null, prediction: null, ...overrides,
  };
}

describe("SET_GROUP_SCORE field selection", () => {
  it("explicit field:'result' writes result even in predictions mode", () => {
    const next = fixtureReducer(state([gm("G-A-1")], "predictions"), {
      type: "SET_GROUP_SCORE", matchId: "G-A-1", score: { home: 2, away: 1 }, field: "result",
    });
    expect(next.groupMatches[0].result).toEqual({ home: 2, away: 1 });
    expect(next.groupMatches[0].prediction).toBeNull();
  });

  it("explicit field:'prediction' writes prediction even in results mode", () => {
    const next = fixtureReducer(state([gm("G-A-1")], "results"), {
      type: "SET_GROUP_SCORE", matchId: "G-A-1", score: { home: 3, away: 0 }, field: "prediction",
    });
    expect(next.groupMatches[0].prediction).toEqual({ home: 3, away: 0 });
    expect(next.groupMatches[0].result).toBeNull();
  });

  it("no field falls back to mode-derived field (results mode -> result)", () => {
    const next = fixtureReducer(state([gm("G-A-1")], "results"), {
      type: "SET_GROUP_SCORE", matchId: "G-A-1", score: { home: 1, away: 1 },
    });
    expect(next.groupMatches[0].result).toEqual({ home: 1, away: 1 });
  });

  it("explicit field:'prediction' on a locked match in predictions mode is ignored", () => {
    const past = "2000-01-01T00:00:00Z"; // long locked
    const next = fixtureReducer(state([gm("G-A-1", { dateUtc: past })], "predictions"), {
      type: "SET_GROUP_SCORE", matchId: "G-A-1", score: { home: 1, away: 0 }, field: "prediction",
    });
    expect(next.groupMatches[0].prediction).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/context/__tests__/fixtureReducer.scoreField.test.ts`
Expected: FAIL — `field` not a known property on the action (tsc) and result not written.

- [ ] **Step 3: Add `field` to the action types**

In `src/types.ts`, change the two members of `FixtureAction`:

```ts
  | { type: "SET_GROUP_SCORE"; matchId: string; score: Score | null; field?: "prediction" | "result" }
  | { type: "SET_KNOCKOUT_SCORE"; matchId: string; score: Score | null; field?: "prediction" | "result" }
```

- [ ] **Step 4: Use `field` in the reducer**

In `src/context/FixtureContext.tsx`, replace the `SET_GROUP_SCORE` case (around line 23) so the field is the explicit one when given:

```ts
    case "SET_GROUP_SCORE": {
      const match = state.groupMatches.find((m) => m.id === action.matchId);
      const field = action.field ?? (state.mode === "predictions" ? "prediction" : "result");
      if (field === "prediction" && match && isMatchLocked(match.dateUtc)) {
        return state;
      }
      // Manual edit of a result = local override; drop synced flag for this match.
      const syncedResultIds =
        field === "result"
          ? state.syncedResultIds.filter((id) => id !== action.matchId)
          : state.syncedResultIds;
      return { ...state, groupMatches: state.groupMatches.map((m) =>
        m.id === action.matchId ? { ...m, [field]: action.score } : m
      ), syncedResultIds };
    }
```

Apply the identical change to the `SET_KNOCKOUT_SCORE` case just below it (use `state.knockoutMatches`).

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/context/__tests__/fixtureReducer.scoreField.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the full suite + typecheck**

Run: `pnpm test && pnpm exec tsc -b`
Expected: all pass, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/context/FixtureContext.tsx src/context/__tests__/fixtureReducer.scoreField.test.ts
git commit -m "feat(reducer): optional explicit field on SET_*_SCORE (decouple from mode)"
```

---

## Phase B — Indicator as a fixed-width reserved column

Make the points indicator occupy a constant-width slot at the row's right edge, always rendered (neutral `·` when there is nothing to score), so its appearance never reflows the row. Smallest, isolated change — ship first within the UI work.

### Task B1: CompactMatchRow indicator column

**Files:**
- Modify: `src/components/CompactMatchRow.tsx` (the `indicator` block + the JSX where it renders)
- Modify: `src/components/CompactMatchRow.css` (`.compact-indicator` rules ~46-48)

- [ ] **Step 1: Always render the indicator slot**

In `src/components/CompactMatchRow.tsx`, the indicator is currently `{indicator && <span .../>}`. Replace the conditional render so the slot is always present:

```tsx
      <span className={`compact-indicator ${indicator ? indicator.className : "none"}`}>
        {indicator ? indicator.text : "·"}
      </span>
```

Keep the existing `scored`/`indicator` computation above it unchanged (it already uses `indicatorFor`).

- [ ] **Step 2: Reserve a fixed width in CSS**

In `src/components/CompactMatchRow.css`, replace the three `.compact-indicator.*` colour rules with a sized, always-present column:

```css
.compact-indicator {
  flex: 0 0 2.5rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}
.compact-indicator.exact { color: #2e7d32; }
.compact-indicator.winner { color: #f9a825; }
.compact-indicator.wrong { color: #c62828; }
.compact-indicator.none { color: var(--text-muted, #b0b0b0); font-weight: 400; }
```

- [ ] **Step 3: Verify build + smoke**

Run: `pnpm run build`
Expected: builds clean.
Manual smoke (`pnpm run dev`, a group with mixed scored/unscored matches): the right edge of every compact row lines up; rows with `+3/+1/0` do not shift the team names vs. rows showing `·`.

- [ ] **Step 4: Commit**

```bash
git add src/components/CompactMatchRow.tsx src/components/CompactMatchRow.css
git commit -m "fix(views): reserve fixed-width indicator column so scored rows don't reflow"
```

### Task B2: Same treatment in ScheduleView's compact path

`ScheduleView` renders `CompactMatchRow` (compact) — covered by B1 — and `ScheduleMatchCard` (non-compact). The non-compact indicator is handled in Phase C when that card is extracted. No separate work here; verify B1 covers the schedule compact list during the B1 smoke check (open Calendario in compact mode).

---

## Phase C — Unified match row (prediction + result badge), remove mode toggle

This is the bulk. The match row shows the user's prediction (editable until lock) AND the real result (read-only badge; inline-editable only when `isMatchEditable` is true — i.e. breaker tripped or grace elapsed). The Predicciones/Resultados toggle is removed; `state.mode` stays in the reducer for the simulator only.

### File structure for this phase

- `src/components/CompactMatchRow.tsx` — gains a read-only result badge + (fallback) inline result inputs; props change to carry both prediction and result.
- `src/components/group/GroupMatchCard.tsx` — NEW: the non-compact group card (moved out of `GroupView.tsx`'s inline `MatchCard`, extended with the result badge). Keeps `GroupView.tsx` under the size limit.
- `src/components/schedule/ScheduleMatchCard.tsx` — NEW: the non-compact schedule card (moved out of `ScheduleView.tsx`'s inline `ScheduleMatchCard`, extended).
- `src/components/ScoreInput.tsx` — used by `BracketView`; gains the read-only result badge alongside the prediction inputs.
- `src/components/TopBar.tsx` — remove the mode toggle and the `state.mode`-gated dropdown sections.
- `src/components/{GroupView,ScheduleView,BracketView}.tsx` — stop deriving `isPrediction` from `state.mode`; always render prediction + result; compute `resultEditable` from `isMatchEditable`.
- i18n `es/en/pt.ts` — drop the `topbar.mode.*` toggle usage; add `matchCard.resultBadge` label strings.

### Task C1: CompactMatchRow — dual prediction/result contract

**Files:**
- Modify: `src/components/CompactMatchRow.tsx`
- Modify: `src/components/CompactMatchRow.css`

- [ ] **Step 1: Replace the props interface**

Replace `CompactMatchRowProps` with the dual-field contract. The prediction is always editable until `predictionLocked`; the result is shown as a badge and only editable when `resultEditable`:

```tsx
export interface CompactMatchRowProps {
  homeTeamId: string | null;
  awayTeamId: string | null;
  dateUtc: string;
  badgeLabel: string;
  badgeKind: "group" | "knockout";
  prediction: Score | null;
  result: Score | null;
  predictionLocked: boolean;     // isMatchLocked -> prediction inputs read-only
  resultEditable: boolean;       // fallback -> result badge becomes inputs
  synced?: boolean;
  autoSyncTooltip?: string;
  pendingLabel?: string;
  onPredictionChange: (score: Score | null) => void;
  onResultChange: (score: Score | null) => void;
}
```

- [ ] **Step 2: Render prediction inputs + result badge + indicator**

Rework the body so it always shows the prediction inputs (disabled when `predictionLocked`), then a result region, then the fixed indicator column from Phase B. Keep the existing team/flag/badge markup and the pen-picker (the pen picker now operates on the *prediction*). The result region:

```tsx
  // indicator compares the real result to the prediction (unchanged helper)
  const scored = indicatorFor(result, prediction);
  const indicator = scored ? { className: scored.kind, text: scored.label } : null;

  // result region: read-only chip normally, inputs when in fallback
  const resultNode = resultEditable
    ? (
      <ResultInputs value={result} onChange={onResultChange} />   // small local subcomponent
    )
    : result
      ? <span className="compact-result-badge">{result.home}–{result.away}</span>
      : <span className="compact-result-badge none" aria-hidden="true" />;
```

Place `{resultNode}` immediately before the indicator `<span>`. Prediction inputs keep dispatching via `onPredictionChange` (rename the existing `onScoreChange` calls). Define a tiny `ResultInputs` component in the same file (two number inputs mirroring the existing prediction inputs, calling `onChange` with a parsed `Score | null`).

- [ ] **Step 3: CSS for the result badge**

In `src/components/CompactMatchRow.css` add:

```css
.compact-result-badge {
  flex: 0 0 3rem;
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-size: 0.85em;
  color: var(--text-strong, #222);
  background: var(--surface-2, #f0f0f0);
  border-radius: 4px;
  padding: 1px 4px;
}
.compact-result-badge.none { background: transparent; }
```

- [ ] **Step 4: Verify it compiles in isolation**

Run: `pnpm exec tsc -b`
Expected: FAIL only at the call sites (GroupView/ScheduleView still pass old props) — that is expected and fixed in C2/C3. CompactMatchRow itself must be type-clean.

- [ ] **Step 5: Commit (WIP, compiles after C2/C3)**

```bash
git add src/components/CompactMatchRow.tsx src/components/CompactMatchRow.css
git commit -m "feat(views): CompactMatchRow shows prediction + result badge (dual contract)"
```

### Task C2: Extract + extend GroupMatchCard, update GroupView

**Files:**
- Create: `src/components/group/GroupMatchCard.tsx` (move the inline `MatchCard` from `GroupView.tsx:172-248`, extend with result badge)
- Create: `src/components/group/GroupMatchCard.css` (move the `.group-match-*` rules used by the card from `GroupView.css`)
- Modify: `src/components/GroupView.tsx` (delete inline `MatchCard` + `ScoreField`; import the new card; update both CompactMatchRow and GroupMatchCard call sites to the new contracts; drop `isPrediction`)

- [ ] **Step 1: Create `src/components/group/GroupMatchCard.tsx`**

Move the existing inline `MatchCard` (and its helper `ScoreField`) here, renamed `GroupMatchCard`, and change its contract to dual-field. Prediction inputs are editable unless `predictionLocked`; show the real result row read-only, or inputs when `resultEditable`. Use `indicatorFor` for the indicator (replaces the hand-rolled `groups.matchCard.*` symbol logic):

```tsx
import { useState, useEffect } from "react";
import { getTeam } from "../../data/teams";
import { useLocale } from "../../i18n";
import { indicatorFor } from "../../utils/scoring";
import type { Score } from "../../types";
import "./GroupMatchCard.css";

interface GroupMatchCardProps {
  homeTeamId: string;
  awayTeamId: string;
  dateUtc: string;
  prediction: Score | null;
  result: Score | null;
  predictionLocked: boolean;
  resultEditable: boolean;
  synced?: boolean;
  autoSyncTooltip?: string;
  onPredictionChange: (score: Score | null) => void;
  onResultChange: (score: Score | null) => void;
}

export function GroupMatchCard(props: GroupMatchCardProps) {
  const { homeTeamId, awayTeamId, dateUtc, prediction, result,
    predictionLocked, resultEditable, synced, autoSyncTooltip,
    onPredictionChange, onResultChange } = props;
  const { t, formatDate } = useLocale();

  const [homeStr, setHomeStr] = useState(prediction?.home?.toString() ?? "");
  const [awayStr, setAwayStr] = useState(prediction?.away?.toString() ?? "");
  useEffect(() => {
    setHomeStr(prediction?.home?.toString() ?? "");
    setAwayStr(prediction?.away?.toString() ?? "");
  }, [prediction]);

  function commitPrediction(hStr: string, aStr: string) {
    const h = parseInt(hStr, 10);
    const a = parseInt(aStr, 10);
    if (!isNaN(h) && !isNaN(a) && h >= 0 && a >= 0) onPredictionChange({ home: h, away: a });
    else if (hStr === "" && aStr === "") onPredictionChange(null);
  }

  const homeTeam = getTeam(homeTeamId);
  const awayTeam = getTeam(awayTeamId);
  const scored = indicatorFor(result, prediction);

  return (
    <div className="group-match-card">
      <div className="group-match-date">{formatDate(dateUtc)}</div>

      <div className="group-match-team-row">
        <span className="team-flag">{homeTeam?.flag}</span>
        <span className="group-match-team-name">{homeTeam ? t(`teams.${homeTeam.id}`) : ""}</span>
        <input type="number" min="0" max="99"
          className={`group-match-score-input prediction ${predictionLocked ? "locked" : ""}`}
          disabled={predictionLocked} title={autoSyncTooltip}
          value={homeStr}
          onChange={(e) => { setHomeStr(e.target.value); commitPrediction(e.target.value, awayStr); }} />
      </div>
      <div className="group-match-team-row">
        <span className="team-flag">{awayTeam?.flag}</span>
        <span className="group-match-team-name">{awayTeam ? t(`teams.${awayTeam.id}`) : ""}</span>
        <input type="number" min="0" max="99"
          className={`group-match-score-input prediction ${predictionLocked ? "locked" : ""}`}
          disabled={predictionLocked} title={autoSyncTooltip}
          value={awayStr}
          onChange={(e) => { setAwayStr(e.target.value); commitPrediction(homeStr, e.target.value); }} />
      </div>

      {synced && <div className="group-match-synced" title={t("groups.matchCard.syncedTitle")}>{t("groups.matchCard.synced")}</div>}

      <ResultRow result={result} editable={resultEditable} onChange={onResultChange}
        label={t("groups.matchCard.real")}
        indicator={scored ? { className: scored.kind, text: scored.label } : null} />
    </div>
  );
}

function ResultRow({ result, editable, onChange, label, indicator }: {
  result: Score | null;
  editable: boolean;
  onChange: (score: Score | null) => void;
  label: string;
  indicator: { className: string; text: string } | null;
}) {
  const [h, setH] = useState(result?.home?.toString() ?? "");
  const [a, setA] = useState(result?.away?.toString() ?? "");
  useEffect(() => { setH(result?.home?.toString() ?? ""); setA(result?.away?.toString() ?? ""); }, [result]);
  function commit(hStr: string, aStr: string) {
    const hh = parseInt(hStr, 10), aa = parseInt(aStr, 10);
    if (!isNaN(hh) && !isNaN(aa) && hh >= 0 && aa >= 0) onChange({ home: hh, away: aa });
    else if (hStr === "" && aStr === "") onChange(null);
  }
  if (editable) {
    return (
      <div className="group-match-result-row editable">
        <span>{label}:</span>
        <input type="number" min="0" max="99" value={h}
          onChange={(e) => { setH(e.target.value); commit(e.target.value, a); }} />
        <span>–</span>
        <input type="number" min="0" max="99" value={a}
          onChange={(e) => { setA(e.target.value); commit(h, e.target.value); }} />
      </div>
    );
  }
  if (!result) return null;
  return (
    <div className="group-match-result-row">
      {label}: {result.home} - {result.away}
      {indicator && <span className={`prediction-indicator ${indicator.className}`}>{indicator.text}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/group/GroupMatchCard.css`**

Move the `.group-match-card`, `.group-match-date`, `.group-match-team-row`, `.group-match-team-name`, `.group-match-score-input`, `.group-match-synced`, and `.prediction-indicator` rules from `GroupView.css` into this file. Rename the old `.group-match-prediction-row` rule to `.group-match-result-row` and add an `.editable` variant (inline inputs). Remove the moved rules from `GroupView.css`.

- [ ] **Step 3: Update `GroupView.tsx`**

Delete the inline `MatchCard` and `ScoreField` (lines ~18-41 and ~172-248). Add `import { GroupMatchCard } from "./group/GroupMatchCard";`. Remove `const isPrediction = state.mode === "predictions";`. For BOTH the compact `CompactMatchRow` and the grid `GroupMatchCard` call sites, pass the new contract. Compact example:

```tsx
              const predictionLocked = isMatchLocked(match.dateUtc);
              const resultEditable = isMatchEditable(match, { circuitBreakerTripped: breakerState.tripped, now });
              return (
                <CompactMatchRow
                  key={match.id}
                  homeTeamId={match.homeTeamId}
                  awayTeamId={match.awayTeamId}
                  dateUtc={match.dateUtc}
                  badgeLabel={t("schedule.stage.group", { group: match.group })}
                  badgeKind="group"
                  prediction={match.prediction}
                  result={match.result}
                  predictionLocked={predictionLocked}
                  resultEditable={resultEditable}
                  synced={state.syncedResultIds.includes(match.id)}
                  autoSyncTooltip={autoSyncTooltip}
                  pendingLabel={match.id}
                  onPredictionChange={(score) => dispatch({ type: "SET_GROUP_SCORE", matchId: match.id, score, field: "prediction" })}
                  onResultChange={(score) => dispatch({ type: "SET_GROUP_SCORE", matchId: match.id, score, field: "result" })}
                />
              );
```

Grid `GroupMatchCard` call site: same props minus `badge*`/`pendingLabel`, with `homeTeamId={match.homeTeamId!}` etc. (the grid path already only renders matches with known teams; assert non-null as the old code did).

- [ ] **Step 4: Verify size + build**

Run: `pnpm exec tsc -b && pnpm run build`
Expected: clean. `GroupView.tsx` now well under 200 lines; the size hook does not fire.

- [ ] **Step 5: Smoke**

`pnpm run dev` → a group: predictions editable pre-lock; once a result exists it shows read-only "Real: x - y" with the `+3/+1/0` indicator; nothing reflows in compact.

- [ ] **Step 6: Commit**

```bash
git add src/components/group/ src/components/GroupView.tsx src/components/GroupView.css
git commit -m "refactor(group): extract GroupMatchCard; show prediction + result together"
```

### Task C3: Extract + extend ScheduleMatchCard, update ScheduleView

**Files:**
- Create: `src/components/schedule/ScheduleMatchCard.tsx` (move the inline `ScheduleMatchCard` from `ScheduleView.tsx:177+`, extend with result badge using the same dual contract as C1/C2)
- Create: `src/components/schedule/ScheduleMatchCard.css` (move the relevant `.schedule-match-*` rules from `ScheduleView.css`)
- Modify: `src/components/ScheduleView.tsx` (remove inline card; drop `isPrediction`/`scoreField`; pass dual contract to both compact `CompactMatchRow` and `ScheduleMatchCard`)

- [ ] **Step 1: Create the schedule card** mirroring `GroupMatchCard` (prediction inputs + `ResultRow`), reading `match.homeTeamId`/`awayTeamId` which may be null for unresolved knockouts — render the pending label when null, exactly as the current `ScheduleMatchCard` does. Keep its existing team/flag/time markup; replace the `scoreField`-based single input with prediction inputs + a `ResultRow`.

- [ ] **Step 2: Update `ScheduleView.tsx`** — remove `const isPrediction = ...` and `const scoreField = ...`; compute `predictionLocked = isMatchLocked(match.dateUtc)` and `resultEditable = isMatchEditable(...)` per match (the `ctx` is already built at line ~40); pass `prediction={match.prediction}` / `result={match.result}` and the two `onPredictionChange`/`onResultChange` dispatchers (`field: "prediction"` / `field: "result"`) to both the compact `CompactMatchRow` and the new `ScheduleMatchCard`. Delete the `UnifiedMatch.currentScore`/`hasResult`/`editable`-via-scoreField wiring that assumed a single field; carry `prediction`+`result` instead.

- [ ] **Step 3:** `pnpm exec tsc -b && pnpm run build` — clean; `ScheduleView.tsx` under the limit.

- [ ] **Step 4: Smoke** — Calendario in both compact and expanded: prediction + result + indicator render; no reflow.

- [ ] **Step 5: Commit**

```bash
git add src/components/schedule/ src/components/ScheduleView.tsx src/components/ScheduleView.css
git commit -m "refactor(schedule): extract ScheduleMatchCard; unified prediction + result row"
```

### Task C4: BracketView + ScoreInput

**Files:**
- Modify: `src/components/ScoreInput.tsx` (add a read-only result badge next to the prediction inputs; keep the existing indicator that already uses `indicatorFor`)
- Modify: `src/components/BracketView.tsx:39,75-98` (drop `isPrediction = state.mode === ...`; always edit prediction; pass `result` for the badge; compute `resultEditable`)

- [ ] **Step 1: ScoreInput** — it already takes `score` (current) and `readonlyScore`. Re-purpose to the dual model: `score` = prediction (editable until `locked`), add explicit `result?: Score | null` for the read-only badge, and `resultEditable?: boolean` for fallback inputs. The existing `getPredictionIndicator` already compares `readonlyScore`→ switch it to compare `result` to `score` via `indicatorFor` (consistent with C1/C2). Render a `result` badge (read-only chip or inputs when `resultEditable`) below/beside the inputs.

- [ ] **Step 2: BracketView** — replace:
```tsx
  const currentScore = isPrediction ? match.prediction : match.result;
  const readonlyScore = isPrediction ? match.result : undefined;
```
with always-prediction editing + result badge:
```tsx
  const predictionLocked = isMatchLocked(match.dateUtc);
  const resultEditable = isMatchEditable(match, { circuitBreakerTripped: breakerState.tripped, now });
```
and update the `<ScoreInput>` props: `score={match.prediction}` (prediction), `result={match.result}`, `locked={predictionLocked}`, `resultEditable={resultEditable}`, `onScoreChange={(score) => dispatch({ type: "SET_KNOCKOUT_SCORE", matchId: match.id, score, field: "prediction" })}`, and a new `onResultChange` dispatch with `field: "result"`. Remove `synced={!isPrediction && ...}` → `synced={state.syncedResultIds.includes(match.id)}`.

- [ ] **Step 3:** `pnpm exec tsc -b && pnpm run build` — clean.
- [ ] **Step 4: Smoke** — a knockout round with a resolved match: prediction editable, result badge + indicator shown.
- [ ] **Step 5: Commit**

```bash
git add src/components/ScoreInput.tsx src/components/ScoreInput.css src/components/BracketView.tsx
git commit -m "feat(bracket): unified prediction + result in ScoreInput; drop mode dependency"
```

### Task C5: Remove the mode toggle from TopBar + i18n

**Files:**
- Modify: `src/components/TopBar.tsx:90-101` (delete the `mode-toggle` block) and `:133-161` (the `state.mode ===` gated dropdown sections)
- Modify: `src/i18n/locales/{es,en,pt}.ts` (remove the now-unused `topbar.mode.*` references from components; the keys may stay if the simulator/tour reference them, otherwise delete)

- [ ] **Step 1: Delete the toggle** — remove the entire `<div className="topbar-center">…</div>` block (lines ~90-101) and the `data-tour="mode-toggle"` element. If the overview tour references `mode-toggle`, remove that tour step in `src/tour/steps.ts` (grep `mode-toggle`).

- [ ] **Step 2: Un-gate the dropdown** — the `{state.mode === "predictions" && (…Randomize…)}` section should now always show (randomize is a prediction action); delete the `{state.mode === "results" && (…fetchApi…)}` section entirely (the API fetch is automatic now). Result: Randomize always available; no results section.

- [ ] **Step 3: i18n** — grep `topbar.mode` across `src/`. If only the deleted toggle used it, remove `mode: { results, predictions }` from all three locales. If the tour or anything else references it, leave it. Run `pnpm test` (the i18n consistency tests must stay green).

- [ ] **Step 4:** `pnpm exec tsc -b && pnpm run build && pnpm test` — clean.
- [ ] **Step 5: Smoke** — no toggle in the TopBar; predictions editable; results show as badges; menu shows Randomize + simulation + export/import.
- [ ] **Step 6: Commit**

```bash
git add src/components/TopBar.tsx src/i18n/locales/ src/tour/steps.ts
git commit -m "feat(topbar): remove predicciones/resultados toggle (unified view)"
```

---

## Phase D — Ranking integrated into rooms, standalone nav removed

### Task D1: Remove the `ranking` view target + nav + route

**Files:**
- Modify: `src/types.ts:77` (remove `| { type: "ranking" }` from `ViewTarget`)
- Modify: `src/components/Sidebar.tsx:53-62` (remove the ranking `sidebar-item`)
- Modify: `src/App.tsx:104` (remove `{activeView.type === "ranking" && <RankingView />}` and the now-unused import on line 10 if RankingView is no longer referenced in App)

- [ ] **Step 1:** Remove `{ type: "ranking" }` from `ViewTarget` in `src/types.ts`.

- [ ] **Step 2:** Delete the ranking `<div className="sidebar-item …>` block in `Sidebar.tsx` (lines ~53-62). Keep the rivals-count badge logic out (it moves to the rooms context naturally; the count is visible in the ranking itself).

- [ ] **Step 3:** In `App.tsx`, delete the ranking route line. `RankingView` is still imported by `RoomDetail` and (next task) `RoomList`, so remove the now-unused `import { RankingView }` from `App.tsx` only if tsc flags it.

- [ ] **Step 4:** `pnpm exec tsc -b` — fix any remaining references to `{ type: "ranking" }` (e.g. `contextTour` switch in `App.tsx` has no ranking case — fine; grep `"ranking"` to be sure).

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/components/Sidebar.tsx src/App.tsx
git commit -m "refactor(nav): remove standalone ranking view"
```

### Task D2: Roomless ranking in RoomList; room header context

**Files:**
- Modify: `src/components/RoomList.tsx` (render `<RankingView />` when there is no active room, so solo/JSON-rival users still see their ranking)
- Verify: `src/components/RoomDetail.tsx` already renders `<RankingView />` under the room name — no change needed beyond confirming the header reads clearly.

- [ ] **Step 1:** In `RoomList.tsx`, import `RankingView` and the active-room state from `useNostr()` (`activeRoomId`). Below the room cards, when `activeRoomId == null`, render a section: a small heading (new i18n key `rooms.rankingSoloTitle`, e.g. ES "Tu ranking" / EN "Your ranking" / PT "Seu ranking") followed by `<RankingView />`. This covers the no-room case the spec calls out.

- [ ] **Step 2:** Add `rooms.rankingSoloTitle` to all three locales.

- [ ] **Step 3:** `pnpm exec tsc -b && pnpm run build && pnpm test` — clean (i18n consistency passes).

- [ ] **Step 4: Smoke** — with no active room, Salas shows "Tu ranking" + the table (you + any JSON rivals); inside a room, the ranking shows under the room name.

- [ ] **Step 5: Commit**

```bash
git add src/components/RoomList.tsx src/i18n/locales/
git commit -m "feat(rooms): show ranking in Salas when roomless; ranking now room-scoped only"
```

---

## Phase E — Final verification

### Task E1: Full gate + smoke checklist

- [ ] **Step 1: Full suite + types + build + lint**

Run:
```bash
pnpm test && pnpm exec tsc -b && pnpm run build && npx eslint .
```
Expected: all tests pass; tsc clean; build writes `dist/`; eslint shows the SAME 13 pre-existing errors and no new ones (capture the count; if >13, a new error was introduced — fix it).

- [ ] **Step 2: Manual smoke matrix** (`pnpm run dev`)

  - Calendario compact + expanded: prediction editable pre-lock; read-only result badge + `+3/+1/0` post-result; no row reflow; `·` placeholder aligns.
  - Grupos: same, plus standings still render.
  - Llave (bracket): a resolved knockout shows prediction + result badge + indicator; pen picker still works on the prediction for a predicted draw.
  - No mode toggle anywhere; menu = Randomize + simulation + export/import.
  - Fallback edit: with `?devClock` set past a match's grace window and no result (or trip the breaker via the inspector), the result badge becomes inline-editable; entering a score writes `result` (ranking updates).
  - Salas: roomless shows "Tu ranking"; inside a room shows ranking under the room name; sidebar has no "Ranking" item.
  - Simulator: start simulation → still works (writes results via mode), exit restores.

- [ ] **Step 3: Mark the spec approved**

Edit `docs/superpowers/specs/f5.2-unified-match-view.md` frontmatter `status: draft` → `status: implemented`.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/f5.2-unified-match-view.md
git commit -m "docs(spec): mark f5.2 unified-match-view implemented"
```

---

## Self-review (completed by plan author)

- **Spec coverage:** §4.1 indicator column → Phase B. §4.2 unified row + no toggle + fallback inline + `mode` kept for sim → Phase A (field decouple) + Phase C (C1-C5). §4.3 ranking integration → Phase D. ✅ all sections mapped.
- **Type consistency:** the dual contract names (`prediction`, `result`, `predictionLocked`, `resultEditable`, `onPredictionChange`, `onResultChange`) are used identically across CompactMatchRow (C1), GroupMatchCard (C2), ScheduleMatchCard (C3), ScoreInput/BracketView (C4). The action `field?: "prediction" | "result"` is defined in A1 and used in C2/C3/C4 dispatches. ✅
- **Placeholder scan:** no TBD/TODO; every code step shows real code; preserved-markup steps name exactly which existing block to keep. ✅
- **Risk note:** C2/C3 extractions are the largest steps; if a subagent struggles, split "move file verbatim" and "extend with result row" into two commits.
