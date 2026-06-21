# Group Real/Projected Standings Toggle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Real | Proyectada` toggle to the Group view so users can see the real current standings (only played matches) in addition to the existing projected standings, in both compact and expanded view modes.

**Architecture:** The projected table is already computed in `FixtureContext` via `calculateStandings(..., "hybrid")`. We add a symmetric memo `realStandingsByGroup` using the `"result"` source (counts only played matches, ignores predictions), expose it from the context, and let `GroupView` swap which array it renders based on a local toggle (default `real`). A small presentational `GroupStandingsToggle` component holds the segmented control so `GroupView` stays under its size limit. No new ranking algorithm, no reducer changes, no persistence.

**Tech Stack:** React 19, TypeScript 6, Vite, Vitest, vanilla CSS. i18n via the project's `es`/`en`/`pt` bundles (ES is source of truth, EN/PT widened from it).

## Global Constraints

- **Types:** never use `any`. Use `unknown` at boundaries and narrow; prefer `satisfies` over assertions. (copied from CLAUDE.md hard rules)
- **No UI libraries:** vanilla CSS only — no Tailwind/MUI/Radix.
- **Team names:** resolve via `` t(`teams.${team.id}`) `` — never hardcode. (already followed by existing rows; new code touches none.)
- **i18n:** every new user-facing string must exist in all three locales (`es`, `en`, `pt`); the locale-consistency test fails otherwise. ES is the source of truth.
- **Component size:** `.tsx` files in `src/components/` have a 200-line soft limit (enforced by `.claude/hooks/check-component-size.sh`). `GroupView.tsx` is ~144 lines; keep it under 200 by extracting the toggle into its own component.
- **Commits:** only when the user asks. Never `Co-Authored-By`, never `--amend` a pushed commit, never `--no-verify`. (The commit steps below are written out, but only run them once the user has asked to commit.)
- **Lint:** `pnpm lint` has 9 pre-existing errors; do not add new ones.

---

### Task 1: Expose `realStandingsByGroup` from FixtureContext

Add a second standings memo that always reads the `"result"` source, and surface it on the context value. The underlying `calculateStandings(matches, teamIds, "result")` path is already unit-tested in `src/utils/__tests__/standings.test.ts` (the "uses prediction scores…" / "hybrid uses real results…" cases cover the source switch), so this task's deliverable is verified by type-check + build rather than a new unit test, per the project convention that context/components are integration-verified.

**Files:**
- Modify: `src/context/FixtureContext.tsx` (interface `FixtureContextValue` ~line 191-202; add memo after the existing `standingsByGroup` memo ~line 217-225; add to the `value` memo ~line 345-348)

**Interfaces:**
- Consumes: existing `calculateStandings(matches, teamIds, scoreField)` from `src/utils/standings.ts`, `GROUPS` and `TEAMS` from `src/data/teams`, `state.groupMatches`.
- Produces: `realStandingsByGroup: Record<string, StandingRow[]>` on the value returned by `useFixture()`. Same shape as `standingsByGroup`; difference is it is computed with a fixed `"result"` source (NOT `state.simulationActive ? "result" : "hybrid"`).

- [ ] **Step 1: Add the field to the context interface**

In the `FixtureContextValue` interface, add the field right after `standingsByGroup`:

```ts
interface FixtureContextValue {
  state: FixtureState;
  dispatch: React.Dispatch<FixtureAction>;
  standingsByGroup: Record<string, StandingRow[]>;
  // Standings counting ONLY played matches (real results, predictions ignored).
  // The "real current table" surfaced behind the Group view toggle (f5.3).
  realStandingsByGroup: Record<string, StandingRow[]>;
  resolvedKnockout: KnockoutMatch[];
  knockoutConfirmation: Record<string, { home: boolean; away: boolean }>;
  groupSeedsConfirmed: Record<string, Set<string>>;
  bestThirds: { qualifying: ThirdPlaceEntry[]; eliminated: ThirdPlaceEntry[] };
}
```

- [ ] **Step 2: Add the memo**

Immediately after the existing `standingsByGroup` memo (the one ending `}, [state.groupMatches, scoreField]);`), add:

```ts
  // "Real" table for the Group view toggle (f5.3): always the result-only
  // source, independent of simulation. Predictions never leak in, so teams
  // show only the matches actually played.
  const realStandingsByGroup = useMemo(() => {
    const result: Record<string, StandingRow[]> = {};
    for (const group of GROUPS) {
      const groupMatches = state.groupMatches.filter((m) => m.group === group);
      const teamIds = TEAMS.filter((t) => t.group === group).map((t) => t.id);
      result[group] = calculateStandings(groupMatches, teamIds, "result");
    }
    return result;
  }, [state.groupMatches]);
```

- [ ] **Step 3: Add it to the exposed value**

Update the `value` memo (currently `{ state, dispatch, standingsByGroup, resolvedKnockout, ... }`) to include the new field and its dependency:

```ts
  const value = useMemo(
    () => ({ state, dispatch, standingsByGroup, realStandingsByGroup, resolvedKnockout, knockoutConfirmation, groupSeedsConfirmed, bestThirds }),
    [state, standingsByGroup, realStandingsByGroup, resolvedKnockout, knockoutConfirmation, groupSeedsConfirmed, bestThirds]
  );
```

- [ ] **Step 4: Type-check**

Run: `pnpm exec tsc -b`
Expected: no new errors (clean build of the TS project references).

- [ ] **Step 5: Run the standings tests to confirm nothing regressed**

Run: `pnpm test -- standings`
Expected: PASS (the existing `calculateStandings` "result"/"prediction"/"hybrid" cases still pass).

- [ ] **Step 6: Commit** *(only if the user has asked to commit)*

```bash
git add src/context/FixtureContext.tsx
git commit -m "feat(groups): expose real (result-only) standings from context"
```

---

### Task 2: Add the toggle i18n strings to all three locales

Add the segmented-control labels and an accessibility label under `groups.standings`. ES is the source of truth; EN and PT are widened from it, so all three must carry the keys or the locale-consistency test fails.

**Files:**
- Modify: `src/i18n/locales/es.ts` (the `groups.standings` object, ~line 76-82)
- Modify: `src/i18n/locales/en.ts` (same object, `compactTeam` at line 83)
- Modify: `src/i18n/locales/pt.ts` (same object, `compactTeam` at line 83)

**Interfaces:**
- Produces: keys `groups.standings.source.label`, `groups.standings.source.real`, `groups.standings.source.projected`, consumed by Task 3's `GroupStandingsToggle` via `t(...)`.

- [ ] **Step 1: Add the keys to ES (`src/i18n/locales/es.ts`)**

Inside `groups.standings`, after `compactTeam: "Eq",`:

```ts
      compactTeam: "Eq",
      source: {
        label: "Tipo de tabla",
        real: "Real",
        projected: "Proyectada",
      },
```

- [ ] **Step 2: Add the keys to EN (`src/i18n/locales/en.ts`)**

Inside `groups.standings`, after `compactTeam: "Team",`:

```ts
      compactTeam: "Team",
      source: {
        label: "Table type",
        real: "Actual",
        projected: "Projected",
      },
```

- [ ] **Step 3: Add the keys to PT (`src/i18n/locales/pt.ts`)**

Inside `groups.standings`, after `compactTeam: "Eq",`:

```ts
      compactTeam: "Eq",
      source: {
        label: "Tipo de tabela",
        real: "Real",
        projected: "Projetada",
      },
```

- [ ] **Step 4: Run the i18n consistency tests**

Run: `pnpm test -- i18n`
Expected: PASS — no "missing key in EN/PT vs ES" failures.

- [ ] **Step 5: Commit** *(only if the user has asked to commit)*

```bash
git add src/i18n/locales/es.ts src/i18n/locales/en.ts src/i18n/locales/pt.ts
git commit -m "i18n(groups): add real/projected standings toggle strings"
```

---

### Task 3: Add the `GroupStandingsToggle` component

A small, presentational segmented control: two buttons, controlled by the parent. Kept as its own component so `GroupView` stays under the 200-line limit and the control can sit in both the compact and expanded branches without duplication.

**Files:**
- Create: `src/components/group/GroupStandingsToggle.tsx`
- Create: `src/components/group/GroupStandingsToggle.css`

**Interfaces:**
- Consumes: `useLocale` from `../../i18n` for the `groups.standings.source.*` strings (Task 2).
- Produces: `export type StandingsSource = "real" | "projected";` and `export function GroupStandingsToggle({ value, onChange }: { value: StandingsSource; onChange: (next: StandingsSource) => void; }): JSX.Element` — consumed by Task 4's `GroupView`.

- [ ] **Step 1: Write the component**

`src/components/group/GroupStandingsToggle.tsx`:

```tsx
import { useLocale } from "../../i18n";
import "./GroupStandingsToggle.css";

export type StandingsSource = "real" | "projected";

const OPTIONS: { value: StandingsSource; key: "real" | "projected" }[] = [
  { value: "real", key: "real" },
  { value: "projected", key: "projected" },
];

export function GroupStandingsToggle({
  value,
  onChange,
}: {
  value: StandingsSource;
  onChange: (next: StandingsSource) => void;
}) {
  const { t } = useLocale();
  return (
    <div className="standings-source-toggle" role="group" aria-label={t("groups.standings.source.label")}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`standings-source-option ${value === opt.value ? "active" : ""}`}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {t(`groups.standings.source.${opt.key}`)}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write the CSS**

`src/components/group/GroupStandingsToggle.css` — match the existing pill/tab look used by `.group-tab` (small, rounded, green active state). Adjust the active color to the project's green if it differs:

```css
.standings-source-toggle {
  display: inline-flex;
  gap: 0;
  margin: 0 auto 0.75rem;
  border: 1px solid var(--border, #d0d7cf);
  border-radius: 999px;
  overflow: hidden;
}

.standings-source-option {
  border: none;
  background: transparent;
  padding: 0.3rem 0.9rem;
  font-size: 0.85rem;
  cursor: pointer;
  color: var(--text, #1c2a1c);
}

.standings-source-option.active {
  background: var(--accent, #1f7a3d);
  color: #fff;
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc -b`
Expected: no new errors.

- [ ] **Step 4: Commit** *(only if the user has asked to commit)*

```bash
git add src/components/group/GroupStandingsToggle.tsx src/components/group/GroupStandingsToggle.css
git commit -m "feat(groups): add Real/Proyectada standings toggle control"
```

---

### Task 4: Wire the toggle into GroupView

Add the toggle state, render the control above the standings in both view modes, and select which standings array to display.

**Files:**
- Modify: `src/components/GroupView.tsx`

**Interfaces:**
- Consumes: `realStandingsByGroup` from `useFixture()` (Task 1); `GroupStandingsToggle` + `StandingsSource` (Task 3).
- Produces: nothing downstream — this is the top of the render tree for this feature.

- [ ] **Step 1: Add the imports**

Add to the import block at the top of `GroupView.tsx`:

```tsx
import { useState } from "react";
import { GroupStandingsToggle, type StandingsSource } from "./group/GroupStandingsToggle";
```

- [ ] **Step 2: Read the real standings and add toggle state**

Change the `useFixture()` destructure to also pull `realStandingsByGroup`, and pick the displayed array. Replace:

```tsx
  const { state, dispatch, standingsByGroup, groupSeedsConfirmed } = useFixture();
  const { t } = useLocale();
  const { mode: viewMode } = useViewMode();
  const standings = standingsByGroup[group] ?? [];
```

with:

```tsx
  const { state, dispatch, standingsByGroup, realStandingsByGroup, groupSeedsConfirmed } = useFixture();
  const { t } = useLocale();
  const { mode: viewMode } = useViewMode();
  const [source, setSource] = useState<StandingsSource>("real");
  const standings =
    (source === "real" ? realStandingsByGroup[group] : standingsByGroup[group]) ?? [];
```

- [ ] **Step 3: Render the toggle in the compact branch**

In the `viewMode === "compact"` branch, place the toggle directly above `<CompactStandings ... />`:

```tsx
      {viewMode === "compact" ? (
        <>
          <GroupStandingsToggle value={source} onChange={setSource} />
          <CompactStandings standings={standings} confirmedTeamIds={confirmedTeamIds} />
```

- [ ] **Step 4: Render the toggle in the expanded branch**

In the `else` branch, place the toggle directly above `<table className="standings-table" ...>`:

```tsx
      ) : (
        <>
          <GroupStandingsToggle value={source} onChange={setSource} />
          <table className="standings-table" data-tour="standings-table">
```

- [ ] **Step 5: Type-check and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no new TS errors; no new lint errors beyond the 9 pre-existing.

- [ ] **Step 6: Confirm GroupView is still under the size limit**

Run: `wc -l src/components/GroupView.tsx`
Expected: under 200 lines (adding ~6 lines to ~144 keeps it well under). If the size hook would fail, that is a blocker — re-check the extraction in Task 3 absorbed the markup.

- [ ] **Step 7: Build**

Run: `pnpm run build`
Expected: `tsc -b && vite build` succeeds, writes to `dist/`.

- [ ] **Step 8: Commit** *(only if the user has asked to commit)*

```bash
git add src/components/GroupView.tsx
git commit -m "feat(groups): toggle Group standings between real and projected"
```

---

### Task 5: Manual smoke test

Per project convention, components are verified manually in dev rather than by component unit tests.

**Files:** none.

- [ ] **Step 1: Start the dev server**

Run: `pnpm run dev`
Open `http://localhost:5173`.

- [ ] **Step 2: Verify the default and the switch**

Open a group that has some played matches but not all (e.g. Group H in the screenshot scenario). Confirm:
1. The toggle shows above the standings, defaulting to **Real**.
2. In **Real**, teams show only matches actually played (lower `PJ`, e.g. 1 instead of 3) and no prediction-derived points.
3. Switching to **Proyectada** restores the current behavior (every team `PJ = 3`, prediction-filled).
4. Switching groups keeps the selected toggle; a full page reload resets it to **Real**.

- [ ] **Step 3: Verify both view modes**

Toggle the app's compact/expanded view mode (TopBar) and repeat Step 2 in each — the control and the table swap work in both.

- [ ] **Step 4: Verify the clinched marker still renders**

In a group/scenario where a seed is clinched, confirm the `✓` marker and qualify/maybe-qualify row coloring still appear correctly in both Real and Proyectada tables.

---

## Notes for the implementer

- **Why default `real`:** a deliberate product decision (spec f5.3 §5). The projection is one tap away; do not change the default to `projected` without confirming with the user.
- **Simulation:** during simulation the projected memo already uses `"result"`, so the two tables coincide. This is expected — no special handling.
- **Do not touch** scoring, knockout/bracket resolution, ranking, or the reducer. This feature is display-only inside `GroupView`.
