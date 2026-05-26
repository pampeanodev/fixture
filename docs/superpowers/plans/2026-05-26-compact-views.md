# Compact Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **User preference for this session:** **Do not commit between tasks.** All commit steps in this plan are deferred to a single final commit at Task 12. Stay in the working tree until the user signs off.

**Goal:** Add a global `compact` / `expanded` view-mode toggle for Schedule, Groups, and Knockout views, with a bracket-tree visualization (with collapsible past rounds) replacing the round tabs in compact mode.

**Architecture:** A new local-only preference (`localStorage["viewMode"]`) exposed via a tiny `ViewModeContext` provider that wraps `NostrProvider` in `main.tsx`. Each of the three views branches internally on the mode. Compact rows for Schedule and Groups share a new `CompactMatchRow` component. The compact bracket renders a new `BracketTree` that reuses `ScoreInput` with a CSS-only `compact` variant. Manual collapse overrides for bracket rounds use `sessionStorage`.

**Tech Stack:** React 19, TypeScript 6, Vitest, vanilla CSS, `localStorage` / `sessionStorage`.

**Spec:** `docs/superpowers/specs/2026-05-26-compact-views-design.md`

---

## File map

| Path | Status | Purpose |
|---|---|---|
| `src/utils/viewMode.ts` | NEW | `loadViewMode` / `saveViewMode` + `ViewMode` type |
| `src/utils/__tests__/viewMode.test.ts` | NEW | Unit tests for `viewMode.ts` |
| `src/context/ViewModeContext.tsx` | NEW | Provider + `useViewMode()` hook |
| `src/main.tsx` | MOD | Add `<ViewModeProvider>` between `LocaleProvider` and `NostrProvider` |
| `src/i18n/locales/es.ts` | MOD | Add `viewMode`, `bracket.collapse`, `groups.standings.expand/collapse`, `bracket.round.completed` keys |
| `src/i18n/locales/en.ts` | MOD | Same keys in EN |
| `src/i18n/locales/pt.ts` | MOD | Same keys in PT |
| `src/components/TopBar.tsx` | MOD | Add view-mode toggle button |
| `src/components/TopBar.css` | MOD | Style toggle button |
| `src/components/CompactMatchRow.tsx` | NEW | Single-line match row used by Schedule + Groups compact mode |
| `src/components/CompactMatchRow.css` | NEW | Styles |
| `src/components/ScheduleView.tsx` | MOD | Branch on `useViewMode().mode` |
| `src/components/ScheduleView.css` | MOD | Inline day separator for compact mode |
| `src/components/CompactStandings.tsx` | NEW | Collapsible 4-column standings (Eq/PJ/DG/Pts) |
| `src/components/CompactStandings.css` | NEW | Styles |
| `src/components/GroupView.tsx` | MOD | Branch on `useViewMode().mode`; use `CompactStandings` + `CompactMatchRow` |
| `src/components/GroupView.css` | MOD | Minor — most styles come from the new components |
| `src/utils/bracketAutoCollapse.ts` | NEW | Pure function `computeAutoCollapsedRounds` |
| `src/utils/__tests__/bracketAutoCollapse.test.ts` | NEW | Unit tests |
| `src/components/BracketTree.tsx` | NEW | Compact bracket renderer |
| `src/components/BracketTree.css` | NEW | Bracket tree grid, collapsed columns, compact ScoreInput overrides |
| `src/components/BracketView.tsx` | MOD | In compact mode, render `<BracketTree />` instead of the round tabs + per-round cards |

---

## Task 1: viewMode utility — load/save preference

**Files:**
- Create: `src/utils/viewMode.ts`
- Test: `src/utils/__tests__/viewMode.test.ts`

- [ ] **Step 1.1: Write the failing test**

Create `src/utils/__tests__/viewMode.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { loadViewMode, saveViewMode } from "../viewMode";

describe("viewMode", () => {
  beforeEach(() => { localStorage.clear(); });

  it("loadViewMode returns 'expanded' when localStorage is empty", () => {
    expect(loadViewMode()).toBe("expanded");
  });

  it("loadViewMode returns 'expanded' when stored value is invalid", () => {
    localStorage.setItem("viewMode", "garbage");
    expect(loadViewMode()).toBe("expanded");
  });

  it("loadViewMode returns the stored value when valid", () => {
    localStorage.setItem("viewMode", "compact");
    expect(loadViewMode()).toBe("compact");
  });

  it("saveViewMode writes to localStorage under 'viewMode'", () => {
    saveViewMode("compact");
    expect(localStorage.getItem("viewMode")).toBe("compact");
  });

  it("saveViewMode swallows localStorage errors", () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("quota"); };
    expect(() => saveViewMode("compact")).not.toThrow();
    Storage.prototype.setItem = orig;
  });
});
```

- [ ] **Step 1.2: Run the test to verify it fails**

Run: `pnpm test src/utils/__tests__/viewMode.test.ts`
Expected: FAIL with `Cannot find module '../viewMode'`.

- [ ] **Step 1.3: Implement `viewMode.ts`**

Create `src/utils/viewMode.ts`:

```ts
export type ViewMode = "expanded" | "compact";

const KEY = "viewMode";
const VALID: readonly ViewMode[] = ["expanded", "compact"];

function isViewMode(v: string | null): v is ViewMode {
  return v !== null && (VALID as readonly string[]).includes(v);
}

export function loadViewMode(): ViewMode {
  try {
    const raw = localStorage.getItem(KEY);
    return isViewMode(raw) ? raw : "expanded";
  } catch {
    return "expanded";
  }
}

export function saveViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* ignore quota / disabled storage */
  }
}
```

- [ ] **Step 1.4: Run the test to verify it passes**

Run: `pnpm test src/utils/__tests__/viewMode.test.ts`
Expected: PASS — 5 tests pass.

- [ ] **Step 1.5: Lint check**

Run: `pnpm lint src/utils/viewMode.ts src/utils/__tests__/viewMode.test.ts`
Expected: no new errors. (User preference: no commits between tasks — skip the commit step here.)

---

## Task 2: ViewModeContext provider

**Files:**
- Create: `src/context/ViewModeContext.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 2.1: Write `ViewModeContext.tsx`**

Create `src/context/ViewModeContext.tsx`:

```tsx
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { loadViewMode, saveViewMode, type ViewMode } from "../utils/viewMode";

interface ViewModeContextValue {
  mode: ViewMode;
  toggle: () => void;
  setMode: (m: ViewMode) => void;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>(() => loadViewMode());

  const setMode = useCallback((next: ViewMode) => {
    saveViewMode(next);
    setModeState(next);
  }, []);

  const toggle = useCallback(() => {
    setModeState((prev) => {
      const next: ViewMode = prev === "compact" ? "expanded" : "compact";
      saveViewMode(next);
      return next;
    });
  }, []);

  const value = useMemo<ViewModeContextValue>(
    () => ({ mode, toggle, setMode }),
    [mode, toggle, setMode],
  );

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

export function useViewMode(): ViewModeContextValue {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error("useViewMode must be used within ViewModeProvider");
  return ctx;
}
```

- [ ] **Step 2.2: Wire provider into `main.tsx`**

Modify `src/main.tsx`. Replace the existing render block so the provider stack reads:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LocaleProvider } from "./i18n";
import { ViewModeProvider } from "./context/ViewModeContext";
import { FixtureProvider } from "./context/FixtureContext";
import { NostrProvider } from "./context/NostrContext";
import App from "./App";
import "./styles/tokens.css";
import "./styles/modal.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LocaleProvider>
      <ViewModeProvider>
        <NostrProvider>
          <FixtureProvider>
            <App />
          </FixtureProvider>
        </NostrProvider>
      </ViewModeProvider>
    </LocaleProvider>
  </StrictMode>
);
```

- [ ] **Step 2.3: Verify build**

Run: `pnpm run build`
Expected: succeeds with no TS errors.

---

## Task 3: i18n keys for view-mode and collapses

**Files:**
- Modify: `src/i18n/locales/es.ts`, `src/i18n/locales/en.ts`, `src/i18n/locales/pt.ts`

- [ ] **Step 3.1: Add ES keys**

In `src/i18n/locales/es.ts`, just before the closing `}` of the bundle (line ~448, before `export type Messages = …`), add this block. **Important:** place it **alphabetically** correctly within the existing top-level keys, or as a sibling block. Concretely, insert the `viewMode` block after the `topbar` block, and extend the existing `knockout`, `groups`, and `bracket` blocks.

Add new top-level block `viewMode`:

```ts
  viewMode: {
    toggleCompactAria: "Cambiar a vista compacta",
    toggleExpandedAria: "Cambiar a vista expandida",
  },
```

Extend `knockout` (inside the existing `knockout: { … }`):

```ts
    bracket: {
      collapseAria: "Colapsar {round}",
      expandAria: "Expandir {round}",
      roundCompleted: "✓",
    },
```

Extend `groups.standings` to add (alongside existing keys like `team`, `played`, …):

```ts
      expandAria: "Mostrar tabla",
      collapseAria: "Ocultar tabla",
      compactTeam: "Eq",
```

- [ ] **Step 3.2: Add EN keys (mirror structure exactly)**

In `src/i18n/locales/en.ts`, add equivalent blocks:

```ts
  viewMode: {
    toggleCompactAria: "Switch to compact view",
    toggleExpandedAria: "Switch to expanded view",
  },
```

In `knockout`:

```ts
    bracket: {
      collapseAria: "Collapse {round}",
      expandAria: "Expand {round}",
      roundCompleted: "✓",
    },
```

In `groups.standings`:

```ts
      expandAria: "Show table",
      collapseAria: "Hide table",
      compactTeam: "Team",
```

- [ ] **Step 3.3: Add PT keys**

In `src/i18n/locales/pt.ts`, add:

```ts
  viewMode: {
    toggleCompactAria: "Mudar para visão compacta",
    toggleExpandedAria: "Mudar para visão expandida",
  },
```

In `knockout`:

```ts
    bracket: {
      collapseAria: "Recolher {round}",
      expandAria: "Expandir {round}",
      roundCompleted: "✓",
    },
```

In `groups.standings`:

```ts
      expandAria: "Mostrar tabela",
      collapseAria: "Ocultar tabela",
      compactTeam: "Eq",
```

- [ ] **Step 3.4: Run i18n consistency tests**

Run: `pnpm test src/i18n/__tests__/locales.consistency.test.ts`
Expected: PASS. If FAIL, the test prints exactly which keys are missing — fix and rerun.

- [ ] **Step 3.5: Run full type check**

Run: `pnpm run build`
Expected: PASS. (TS infers `MessageKey` from `Messages = typeof es`, so new keys are typed.)

---

## Task 4: TopBar toggle button

**Files:**
- Modify: `src/components/TopBar.tsx`, `src/components/TopBar.css`

- [ ] **Step 4.1: Add toggle button to TopBar**

In `src/components/TopBar.tsx`:

Add this import near the existing imports (after `useLocale`):

```ts
import { useViewMode } from "../context/ViewModeContext";
```

In the component body, after the existing `const { t } = useLocale();` line, add:

```ts
  const { mode: viewMode, toggle: toggleViewMode } = useViewMode();
```

Then inside `<div className="topbar-right" ref={menuRef}>`, **before** the existing `<button className="topbar-menu-btn">`, add the toggle:

```tsx
        <button
          className="topbar-viewmode-btn"
          onClick={toggleViewMode}
          aria-label={viewMode === "compact" ? t("viewMode.toggleExpandedAria") : t("viewMode.toggleCompactAria")}
          title={viewMode === "compact" ? t("viewMode.toggleExpandedAria") : t("viewMode.toggleCompactAria")}
        >
          {viewMode === "compact" ? "▦" : "≡"}
        </button>
```

(`≡` = expanded → suggests "switch to compact"; `▦` = compact → suggests "switch back to expanded".)

- [ ] **Step 4.2: Add CSS**

Append to `src/components/TopBar.css`:

```css
.topbar-viewmode-btn {
  width: 36px; height: 36px; margin-right: 6px;
  border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;
  background: rgba(255,255,255,0.08); color: #ffffff; font-size: 16px;
  cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.topbar-viewmode-btn:hover { background: rgba(255,255,255,0.15); }
.topbar-right { display: inline-flex; align-items: center; }
```

- [ ] **Step 4.3: Verify build + dev**

Run: `pnpm run build` — expected PASS.

Manual: `pnpm run dev`, open `http://localhost:5173`, confirm the new icon appears next to `⋯` in the TopBar, clicking it does nothing visible yet (no view branches on the mode), but does not crash. (You can verify state by opening DevTools → Application → localStorage → `viewMode` toggles between `expanded` and `compact`.)

---

## Task 5: CompactMatchRow component

**Files:**
- Create: `src/components/CompactMatchRow.tsx`, `src/components/CompactMatchRow.css`

This component renders one match as a single horizontal row. It is reused by both Schedule (compact) and Groups (compact).

- [ ] **Step 5.1: Create `CompactMatchRow.tsx`**

Create `src/components/CompactMatchRow.tsx`:

```tsx
import { useState, useEffect } from "react";
import { getTeam } from "../data/teams";
import { useLocale } from "../i18n";
import type { Score } from "../types";
import "./CompactMatchRow.css";

export interface CompactMatchRowProps {
  homeTeamId: string | null;
  awayTeamId: string | null;
  dateUtc: string;
  badgeLabel: string;
  badgeKind: "group" | "knockout";
  currentScore: Score | null;
  realScore: Score | null;        // for prediction-mode comparison only
  isPrediction: boolean;
  locked?: boolean;
  synced?: boolean;
  disabled?: boolean;
  lockedReason?: string;
  autoSyncTooltip?: string;
  pendingLabel?: string;          // shown when a team slot is unresolved (knockouts only)
  onScoreChange: (score: Score | null) => void;
}

export function CompactMatchRow(props: CompactMatchRowProps) {
  const {
    homeTeamId, awayTeamId, dateUtc, badgeLabel, badgeKind, currentScore,
    realScore, isPrediction, locked, synced, disabled, lockedReason,
    autoSyncTooltip, pendingLabel, onScoreChange,
  } = props;
  const { t, formatTime } = useLocale();
  const [homeStr, setHomeStr] = useState(currentScore?.home?.toString() ?? "");
  const [awayStr, setAwayStr] = useState(currentScore?.away?.toString() ?? "");

  useEffect(() => {
    setHomeStr(currentScore?.home?.toString() ?? "");
    setAwayStr(currentScore?.away?.toString() ?? "");
  }, [currentScore]);

  function commitScore(hStr: string, aStr: string) {
    const h = parseInt(hStr, 10);
    const a = parseInt(aStr, 10);
    if (!isNaN(h) && !isNaN(a) && h >= 0 && a >= 0) {
      onScoreChange({ home: h, away: a });
    } else if (hStr === "" && aStr === "") {
      onScoreChange(null);
    }
  }

  const homeTeam = homeTeamId ? getTeam(homeTeamId) : null;
  const awayTeam = awayTeamId ? getTeam(awayTeamId) : null;
  const bothKnown = homeTeamId !== null && awayTeamId !== null;
  const time = formatTime(dateUtc);
  const effectiveDisabled = locked || disabled;
  const inputTitle = effectiveDisabled
    ? (locked ? undefined : (lockedReason ?? autoSyncTooltip))
    : autoSyncTooltip;

  let indicator: { className: string; text: string } | null = null;
  if (isPrediction && realScore && currentScore) {
    if (realScore.home === currentScore.home && realScore.away === currentScore.away) {
      indicator = { className: "exact", text: "✓" };
    } else if (Math.sign(realScore.home - realScore.away) === Math.sign(currentScore.home - currentScore.away)) {
      indicator = { className: "winner", text: "½" };
    } else {
      indicator = { className: "wrong", text: "✗" };
    }
  }

  return (
    <div className={`compact-match-row ${badgeKind} ${synced ? "synced" : ""}`}>
      <span className={`compact-badge ${badgeKind}`}>
        <span className="badge-label">{badgeLabel}</span>
        <span className="badge-time">{time}</span>
      </span>
      <span className="compact-team home">
        {homeTeam ? (
          <>
            <span className="compact-team-name">{t(`teams.${homeTeam.id}`)}</span>
            <span className="team-flag">{homeTeam.flag}</span>
          </>
        ) : (
          <span className="compact-team-name pending">{pendingLabel ?? ""}</span>
        )}
      </span>
      <span className="compact-scores">
        {bothKnown ? (
          <>
            <input type="number" min="0" max="99"
              className={`compact-score-input ${isPrediction ? "prediction" : ""} ${locked ? "locked" : ""}`}
              disabled={effectiveDisabled}
              title={inputTitle}
              value={homeStr}
              onChange={(e) => { setHomeStr(e.target.value); commitScore(e.target.value, awayStr); }} />
            <span className="compact-score-sep">–</span>
            <input type="number" min="0" max="99"
              className={`compact-score-input ${isPrediction ? "prediction" : ""} ${locked ? "locked" : ""}`}
              disabled={effectiveDisabled}
              title={inputTitle}
              value={awayStr}
              onChange={(e) => { setAwayStr(e.target.value); commitScore(homeStr, e.target.value); }} />
          </>
        ) : (
          <span className="compact-score-sep">{t("knockout.vs")}</span>
        )}
      </span>
      <span className="compact-team away">
        {awayTeam ? (
          <>
            <span className="team-flag">{awayTeam.flag}</span>
            <span className="compact-team-name">{t(`teams.${awayTeam.id}`)}</span>
          </>
        ) : (
          <span className="compact-team-name pending">{pendingLabel ?? ""}</span>
        )}
      </span>
      {indicator && <span className={`compact-indicator ${indicator.className}`}>{indicator.text}</span>}
      {locked && !indicator && <span className="compact-status locked" title={lockedReason}>🔒</span>}
      {synced && !indicator && <span className="compact-status synced" title={t("scoreInput.syncedTitle")}>↻</span>}
    </div>
  );
}
```

- [ ] **Step 5.2: Create `CompactMatchRow.css`**

Create `src/components/CompactMatchRow.css`:

```css
.compact-match-row {
  display: grid;
  grid-template-columns: 78px minmax(0, 1fr) auto minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding: 6px 8px;
  border-bottom: 1px solid var(--card-border, rgba(0,0,0,0.06));
  font-size: 13px;
}
.compact-match-row:last-child { border-bottom: none; }

.compact-badge {
  display: inline-flex; flex-direction: column; align-items: flex-start;
  background: var(--accent-qualify); color: var(--accent-green);
  padding: 3px 6px; border-radius: 4px; line-height: 1.1;
  font-size: 9px; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase;
}
.compact-badge.knockout { background: var(--accent-maybe); color: #f57f17; }
.compact-badge .badge-time { font-size: 10px; font-weight: 600; opacity: 0.8; }

.compact-team { display: flex; align-items: center; gap: 5px; min-width: 0; }
.compact-team.home { justify-content: flex-end; text-align: right; }
.compact-team .team-flag { font-size: 16px; flex-shrink: 0; }
.compact-team-name {
  font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.compact-team-name.pending { font-style: italic; color: #999; font-weight: 400; font-size: 11px; }

.compact-scores { display: inline-flex; align-items: center; gap: 4px; }
.compact-score-input {
  width: 28px; height: 26px; text-align: center; font-size: 14px; font-weight: 700;
  border: 1px solid var(--card-border); border-radius: 4px; background: var(--card-bg);
  color: var(--content-text); outline: none;
  -moz-appearance: textfield;
}
.compact-score-input::-webkit-inner-spin-button,
.compact-score-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.compact-score-input:focus { border-color: var(--accent-green); }
.compact-score-input.prediction { border-color: var(--prediction-blue); color: var(--prediction-blue); }
.compact-score-input.locked, .compact-score-input:disabled {
  background: #f2f2f2; color: #999; cursor: not-allowed; opacity: 0.7;
}
.compact-score-sep { font-size: 12px; color: #999; font-weight: 700; }

.compact-indicator { font-size: 14px; padding-left: 4px; }
.compact-indicator.exact { color: #2e7d32; }
.compact-indicator.winner { color: #f9a825; }
.compact-indicator.wrong { color: #c62828; }

.compact-status { font-size: 12px; padding-left: 4px; }
.compact-status.synced { color: var(--accent-green, #2e7d32); }

@media (max-width: 420px) {
  .compact-match-row { grid-template-columns: 60px minmax(0, 1fr) auto minmax(0, 1fr) auto; gap: 5px; font-size: 12px; padding: 5px 6px; }
  .compact-team .team-flag { font-size: 14px; }
  .compact-badge { font-size: 8px; padding: 2px 4px; }
  .compact-score-input { width: 24px; height: 24px; font-size: 12px; }
}
```

- [ ] **Step 5.3: Verify build**

Run: `pnpm run build`
Expected: PASS. The component is not yet used anywhere — that's fine.

---

## Task 6: ScheduleView compact mode

**Files:**
- Modify: `src/components/ScheduleView.tsx`, `src/components/ScheduleView.css`

- [ ] **Step 6.1: Add view-mode branch to ScheduleView**

In `src/components/ScheduleView.tsx`:

Add imports at the top:

```ts
import { useViewMode } from "../context/ViewModeContext";
import { CompactMatchRow } from "./CompactMatchRow";
```

After the existing `const { t, locale } = useLocale();` line, add:

```ts
  const { mode: viewMode } = useViewMode();
```

Replace the entire JSX return block (`return ( <div className="schedule-view">...</div> );`) so the per-day rendering branches on `viewMode`:

```tsx
  return (
    <div className={`schedule-view ${viewMode}`}>
      <h2>{t("schedule.title")}</h2>
      {matchesByDay.length === 0 ? (
        <p>{t("schedule.empty")}</p>
      ) : matchesByDay.map(({ day, matches }) => (
        <div key={day}>
          {viewMode === "compact" ? (
            <div className="schedule-day-header-compact"><span>{day}</span></div>
          ) : (
            <div className="schedule-day-header">{day}</div>
          )}
          {viewMode === "compact" ? (
            <div className="schedule-day-matches-compact">
              {matches.map((match) => {
                const ts = autoSyncMeta.autoSyncedAt[match.id];
                const autoSyncTooltip = ts
                  ? t("autoSync.autoSyncedTooltip", { datetime: new Date(ts).toLocaleString() })
                  : undefined;
                return (
                  <CompactMatchRow
                    key={match.id}
                    homeTeamId={match.homeTeamId}
                    awayTeamId={match.awayTeamId}
                    dateUtc={match.dateUtc}
                    badgeLabel={stageLabelFor(match)}
                    badgeKind={match.isKnockout ? "knockout" : "group"}
                    currentScore={match.currentScore}
                    realScore={match.realScore}
                    isPrediction={isPrediction}
                    locked={isPrediction && isMatchLocked(match.dateUtc)}
                    synced={!isPrediction && state.syncedResultIds.includes(match.id)}
                    disabled={!match.editable && !isPrediction}
                    lockedReason={t("autoSync.waitingResult")}
                    autoSyncTooltip={autoSyncTooltip}
                    pendingLabel={match.id}
                    onScoreChange={(score) => handleScoreChange(match.id, match.isKnockout, score)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="schedule-day-matches">
              {matches.map((match) => {
                const ts = autoSyncMeta.autoSyncedAt[match.id];
                const autoSyncTooltip = ts
                  ? t("autoSync.autoSyncedTooltip", { datetime: new Date(ts).toLocaleString() })
                  : undefined;
                return (
                  <ScheduleMatchCard
                    key={match.id}
                    match={match}
                    label={stageLabelFor(match)}
                    isPrediction={isPrediction}
                    locked={isPrediction && isMatchLocked(match.dateUtc)}
                    synced={!isPrediction && state.syncedResultIds.includes(match.id)}
                    disabled={!match.editable && !isPrediction}
                    lockedReason={t("autoSync.waitingResult")}
                    autoSyncTooltip={autoSyncTooltip}
                    onScoreChange={(score) => handleScoreChange(match.id, match.isKnockout, score)}
                  />
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
```

- [ ] **Step 6.2: Add CSS for compact schedule day separator**

Append to `src/components/ScheduleView.css`:

```css
.schedule-day-header-compact {
  display: flex; align-items: center; gap: 8px;
  margin: 14px 0 4px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.6px;
  color: var(--accent-green); text-transform: uppercase;
}
.schedule-day-header-compact::before,
.schedule-day-header-compact::after {
  content: ""; flex: 1; height: 1px; background: var(--accent-green); opacity: 0.4;
}
.schedule-day-header-compact:first-of-type { margin-top: 0; }

.schedule-day-matches-compact {
  display: flex; flex-direction: column;
  background: var(--card-bg); border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06); overflow: hidden;
}
```

- [ ] **Step 6.3: Verify**

Run: `pnpm run build` — PASS.

Manual: `pnpm run dev`, toggle the TopBar button. Schedule view should switch between compact rows and expanded cards. Scores should be editable in both, day separator should be inline-with-hairlines in compact.

---

## Task 7: GroupView compact mode

**Files:**
- Create: `src/components/CompactStandings.tsx`, `src/components/CompactStandings.css`
- Modify: `src/components/GroupView.tsx`, `src/components/GroupView.css`

- [ ] **Step 7.1: Create `CompactStandings.tsx`**

Create `src/components/CompactStandings.tsx`:

```tsx
import { useState } from "react";
import { getTeam } from "../data/teams";
import { useLocale } from "../i18n";
import type { StandingRow } from "../types";
import "./CompactStandings.css";

export function CompactStandings({ standings }: { standings: StandingRow[] }) {
  const { t } = useLocale();
  const initialMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;
  const [collapsed, setCollapsed] = useState(initialMobile);
  return (
    <div className={`compact-standings ${collapsed ? "collapsed" : ""}`}>
      <button
        type="button"
        className="compact-standings-header"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? t("groups.standings.expandAria") : t("groups.standings.collapseAria")}
      >
        <span>{t("groups.standings.compactTeam")} · PJ · {t("groups.standings.goalDifference")} · {t("groups.standings.points")}</span>
        <span className="chev">{collapsed ? "▸" : "▾"}</span>
      </button>
      {!collapsed && (
        <table className="compact-standings-table">
          <thead>
            <tr>
              <th>{t("groups.standings.compactTeam")}</th>
              <th>{t("groups.standings.played")}</th>
              <th>{t("groups.standings.goalDifference")}</th>
              <th>{t("groups.standings.points")}</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => {
              const team = getTeam(row.teamId);
              return (
                <tr key={row.teamId} className={i < 2 ? "qualify" : i === 2 ? "maybe-qualify" : ""}>
                  <td>
                    <span className="team-flag">{team?.flag}</span>
                    <span>{team ? t(`teams.${team.id}`) : row.teamId}</span>
                  </td>
                  <td>{row.played}</td>
                  <td>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                  <td><strong>{row.points}</strong></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 7.2: Create `CompactStandings.css`**

Create `src/components/CompactStandings.css`:

```css
.compact-standings {
  background: var(--card-bg); border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06); overflow: hidden;
  margin-bottom: 14px;
}
.compact-standings-header {
  width: 100%; display: flex; justify-content: space-between; align-items: center;
  padding: 8px 12px;
  background: var(--accent-green); color: white;
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
  border: none; cursor: pointer; text-align: left;
}
.compact-standings-header .chev { font-size: 13px; }
.compact-standings-table {
  width: 100%; border-collapse: collapse; font-size: 12px;
}
.compact-standings-table th {
  font-size: 10px; padding: 6px 4px; text-align: center;
  color: #888; text-transform: uppercase; letter-spacing: 0.3px; border-bottom: 1px solid #eee;
}
.compact-standings-table th:first-child { text-align: left; padding-left: 10px; }
.compact-standings-table td { padding: 6px 4px; text-align: center; font-size: 12px; border-bottom: 1px solid #f4f4f4; }
.compact-standings-table td:first-child { text-align: left; padding-left: 10px; display: flex; align-items: center; gap: 6px; }
.compact-standings-table td:first-child .team-flag { font-size: 14px; flex-shrink: 0; }
.compact-standings-table tr.qualify { background: var(--accent-qualify); }
.compact-standings-table tr.maybe-qualify { background: var(--accent-maybe); }
.compact-standings-table tr:last-child td { border-bottom: none; }
```

- [ ] **Step 7.3: Branch GroupView on view mode**

In `src/components/GroupView.tsx`, add imports near the top:

```ts
import { useViewMode } from "../context/ViewModeContext";
import { CompactMatchRow } from "./CompactMatchRow";
import { CompactStandings } from "./CompactStandings";
```

After `const { t } = useLocale();`, add:

```ts
  const { mode: viewMode } = useViewMode();
```

Replace the body of the returned JSX (everything after the `<div className="group-tabs">…</div>` block) with a branch. Concretely, the new returned JSX is:

```tsx
  return (
    <div className={`group-view ${viewMode}`}>
      <div className="group-tabs" data-tour="group-tabs">
        {GROUPS.map((g) => (
          <button key={g}
            className={`group-tab ${g === group ? "active" : ""}`}
            onClick={() => dispatch({ type: "SET_VIEW", view: { type: "groups", group: g } })}>
            {g}
          </button>
        ))}
      </div>
      <h2>{t("groups.title", { group })}</h2>

      {viewMode === "compact" ? (
        <>
          <CompactStandings standings={standings} />
          <div className="group-matches-title">{t("groups.matches")}</div>
          <div className="group-matches-compact" data-tour="match-cards">
            {matches.map((match) => {
              const editable = isMatchEditable(match, {
                autoSyncEnabled,
                circuitBreakerTripped: breakerState.tripped,
                now,
              });
              const ts = autoSyncMeta.autoSyncedAt[match.id];
              const autoSyncTooltip = ts
                ? t("autoSync.autoSyncedTooltip", { datetime: new Date(ts).toLocaleString() })
                : undefined;
              return (
                <CompactMatchRow
                  key={match.id}
                  homeTeamId={match.homeTeamId}
                  awayTeamId={match.awayTeamId}
                  dateUtc={match.dateUtc}
                  badgeLabel={t("schedule.stage.group", { group: match.group })}
                  badgeKind="group"
                  currentScore={isPrediction ? match.prediction : match.result}
                  realScore={match.result}
                  isPrediction={isPrediction}
                  locked={isPrediction && isMatchLocked(match.dateUtc)}
                  synced={!isPrediction && state.syncedResultIds.includes(match.id)}
                  disabled={!editable && !isPrediction}
                  lockedReason={t("autoSync.waitingResult")}
                  autoSyncTooltip={autoSyncTooltip}
                  onScoreChange={(score) => dispatch({ type: "SET_GROUP_SCORE", matchId: match.id, score })}
                />
              );
            })}
          </div>
        </>
      ) : (
        <>
          <table className="standings-table" data-tour="standings-table">
            <thead>
              <tr>
                <th>{t("groups.standings.team")}</th>
                <th>{t("groups.standings.played")}</th>
                <th>{t("groups.standings.won")}</th>
                <th>{t("groups.standings.drawn")}</th>
                <th>{t("groups.standings.lost")}</th>
                <th>{t("groups.standings.goalsFor")}</th>
                <th>{t("groups.standings.goalsAgainst")}</th>
                <th>{t("groups.standings.goalDifference")}</th>
                <th>{t("groups.standings.points")}</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row, i) => {
                const team = getTeam(row.teamId);
                return (
                  <tr key={row.teamId} className={i < 2 ? "qualify" : i === 2 ? "maybe-qualify" : ""}>
                    <td><div className="team-cell"><span className="team-flag">{team?.flag}</span><span>{team ? t(`teams.${team.id}`) : row.teamId}</span></div></td>
                    <td>{row.played}</td><td>{row.won}</td><td>{row.drawn}</td><td>{row.lost}</td>
                    <td>{row.goalsFor}</td><td>{row.goalsAgainst}</td>
                    <td>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                    <td><strong>{row.points}</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="group-matches-title">{t("groups.matches")}</div>
          <div className="group-matches-grid" data-tour="match-cards">
            {matches.map((match) => {
              const editable = isMatchEditable(match, {
                autoSyncEnabled,
                circuitBreakerTripped: breakerState.tripped,
                now,
              });
              const ts = autoSyncMeta.autoSyncedAt[match.id];
              const autoSyncTooltip = ts
                ? t("autoSync.autoSyncedTooltip", { datetime: new Date(ts).toLocaleString() })
                : undefined;
              return (
                <MatchCard
                  key={match.id}
                  homeTeamId={match.homeTeamId}
                  awayTeamId={match.awayTeamId}
                  dateUtc={match.dateUtc}
                  result={match.result}
                  prediction={match.prediction}
                  isPrediction={isPrediction}
                  locked={isPrediction && isMatchLocked(match.dateUtc)}
                  synced={!isPrediction && state.syncedResultIds.includes(match.id)}
                  disabled={!editable && !isPrediction}
                  lockedReason={t("autoSync.waitingResult")}
                  autoSyncTooltip={autoSyncTooltip}
                  onScoreChange={(score) => dispatch({ type: "SET_GROUP_SCORE", matchId: match.id, score })}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
```

- [ ] **Step 7.4: Add compact match list container styling**

Append to `src/components/GroupView.css`:

```css
.group-matches-compact {
  background: var(--card-bg); border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06); overflow: hidden;
}
```

- [ ] **Step 7.5: Verify**

Run: `pnpm run build` — PASS.

Manual: in `pnpm run dev`, toggle the TopBar button. The group view should show: compact standings (collapsed by default on mobile, expanded on desktop) + compact match rows. Switching back to expanded restores the original 9-column table + card grid.

---

## Task 8: Bracket auto-collapse pure function

**Files:**
- Create: `src/utils/bracketAutoCollapse.ts`, `src/utils/__tests__/bracketAutoCollapse.test.ts`

- [ ] **Step 8.1: Write the failing test**

Create `src/utils/__tests__/bracketAutoCollapse.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeAutoCollapsedRounds } from "../bracketAutoCollapse";
import type { KnockoutMatch } from "../../types";

function mkMatch(id: string, round: KnockoutMatch["round"], result: { home: number; away: number } | null, prediction: { home: number; away: number } | null): KnockoutMatch {
  return {
    id, round,
    homeTeamId: null, awayTeamId: null,
    homeSlot: { type: "group", group: "A", position: 1 },
    awaySlot: { type: "group", group: "A", position: 2 },
    dateUtc: "2026-06-12T19:00:00.000Z", venue: "X",
    result, prediction,
  };
}

describe("computeAutoCollapsedRounds", () => {
  it("returns empty set when no matches have a score", () => {
    const matches = [mkMatch("R32-1", "R32", null, null), mkMatch("R16-1", "R16", null, null)];
    const collapsed = computeAutoCollapsedRounds(matches, "actual");
    expect(collapsed).toEqual(new Set());
  });

  it("collapses a round when all its matches have results (actual mode)", () => {
    const matches = [
      mkMatch("R32-1", "R32", { home: 1, away: 0 }, null),
      mkMatch("R32-2", "R32", { home: 2, away: 1 }, null),
      mkMatch("R16-1", "R16", null, null),
    ];
    const collapsed = computeAutoCollapsedRounds(matches, "actual");
    expect(collapsed.has("R32")).toBe(true);
    expect(collapsed.has("R16")).toBe(false);
  });

  it("uses prediction field in predictions mode", () => {
    const matches = [
      mkMatch("R32-1", "R32", null, { home: 1, away: 0 }),
      mkMatch("R32-2", "R32", null, { home: 2, away: 1 }),
    ];
    const collapsedActual = computeAutoCollapsedRounds(matches, "actual");
    const collapsedPred = computeAutoCollapsedRounds(matches, "predictions");
    expect(collapsedActual.has("R32")).toBe(false);
    expect(collapsedPred.has("R32")).toBe(true);
  });

  it("treats F+3P as one column: F collapses only when both have scores", () => {
    const matches = [
      mkMatch("F-1", "F", { home: 2, away: 1 }, null),
      mkMatch("3P-1", "3P", null, null),
    ];
    const collapsed = computeAutoCollapsedRounds(matches, "actual");
    expect(collapsed.has("F")).toBe(false);
    expect(collapsed.has("3P")).toBe(false);

    const matchesBoth = [
      mkMatch("F-1", "F", { home: 2, away: 1 }, null),
      mkMatch("3P-1", "3P", { home: 0, away: 0 }, null),
    ];
    const collapsedBoth = computeAutoCollapsedRounds(matchesBoth, "actual");
    expect(collapsedBoth.has("F")).toBe(true);
    expect(collapsedBoth.has("3P")).toBe(true);
  });

  it("returns empty set when a round has no matches", () => {
    const collapsed = computeAutoCollapsedRounds([], "actual");
    expect(collapsed).toEqual(new Set());
  });
});
```

- [ ] **Step 8.2: Run the test to verify it fails**

Run: `pnpm test src/utils/__tests__/bracketAutoCollapse.test.ts`
Expected: FAIL with `Cannot find module '../bracketAutoCollapse'`.

- [ ] **Step 8.3: Implement the function**

Create `src/utils/bracketAutoCollapse.ts`:

```ts
import type { KnockoutMatch, KnockoutRound } from "../types";

export type ScoringMode = "predictions" | "actual";

const F_COLUMN_ROUNDS: readonly KnockoutRound[] = ["F", "3P"];

export function computeAutoCollapsedRounds(
  matches: readonly KnockoutMatch[],
  mode: ScoringMode,
): Set<KnockoutRound> {
  const field = mode === "predictions" ? "prediction" : "result";
  const byRound = new Map<KnockoutRound, KnockoutMatch[]>();
  for (const m of matches) {
    const list = byRound.get(m.round);
    if (list) list.push(m);
    else byRound.set(m.round, [m]);
  }

  const result = new Set<KnockoutRound>();

  for (const [round, list] of byRound) {
    if (F_COLUMN_ROUNDS.includes(round)) continue;
    if (list.length > 0 && list.every((m) => m[field] !== null)) {
      result.add(round);
    }
  }

  const fMatches = [...(byRound.get("F") ?? []), ...(byRound.get("3P") ?? [])];
  if (fMatches.length > 0 && fMatches.every((m) => m[field] !== null)) {
    result.add("F");
    result.add("3P");
  }

  return result;
}
```

- [ ] **Step 8.4: Run the test to verify it passes**

Run: `pnpm test src/utils/__tests__/bracketAutoCollapse.test.ts`
Expected: PASS — 5 tests pass.

---

## Task 9: BracketTree component

**Files:**
- Create: `src/components/BracketTree.tsx`, `src/components/BracketTree.css`

This is the largest component. It renders 5 columns (R32, R16, QF, SF, F+3P) with auto-collapse support and manual `sessionStorage`-backed override.

- [ ] **Step 9.1: Create `BracketTree.tsx`**

Create `src/components/BracketTree.tsx`:

```tsx
import { useMemo, useState, useEffect } from "react";
import { useFixture } from "../context/FixtureContext";
import { ScoreInput } from "./ScoreInput";
import { getTeam } from "../data/teams";
import { isMatchLocked } from "../utils/lockTime";
import { isMatchEditable } from "../espn/graceLock";
import { loadAutoSyncEnabled, loadAutoSyncMeta } from "../espn/autoSyncMeta";
import { loadBreakerState } from "../espn/circuitBreaker";
import { getEffectiveNow } from "../utils/devClock";
import { useLocale } from "../i18n";
import { computeAutoCollapsedRounds } from "../utils/bracketAutoCollapse";
import type { KnockoutMatch, KnockoutRound } from "../types";
import type { TFunction } from "../i18n/translate";
import "./BracketTree.css";

const COLUMN_ORDER: readonly KnockoutRound[] = ["R32", "R16", "QF", "SF", "F"];
const OVERRIDE_KEY = "bracketCollapseOverrides";

type Override = "expanded" | "collapsed";

function loadOverrides(): Partial<Record<KnockoutRound, Override>> {
  try {
    const raw = sessionStorage.getItem(OVERRIDE_KEY);
    return raw ? JSON.parse(raw) as Partial<Record<KnockoutRound, Override>> : {};
  } catch { return {}; }
}

function saveOverrides(o: Partial<Record<KnockoutRound, Override>>): void {
  try { sessionStorage.setItem(OVERRIDE_KEY, JSON.stringify(o)); } catch { /* ignore */ }
}

function slotLabel(t: TFunction, match: KnockoutMatch, side: "home" | "away"): string {
  const slot = side === "home" ? match.homeSlot : match.awaySlot;
  switch (slot.type) {
    case "group":
      return slot.position === 1
        ? t("knockout.slot.groupWinner", { group: slot.group })
        : t("knockout.slot.groupRunnerUp", { group: slot.group });
    case "best_third":
      return t("knockout.slot.bestThird", { groups: slot.possibleGroups.join("/") });
    case "winner": return t("knockout.slot.winnerOf", { matchId: slot.matchId });
    case "loser": return t("knockout.slot.loserOf", { matchId: slot.matchId });
  }
}

export function BracketTree() {
  const { state, dispatch, resolvedKnockout } = useFixture();
  const { t, formatDate } = useLocale();
  const isPrediction = state.mode === "predictions";
  const autoSyncEnabled = loadAutoSyncEnabled();
  const breakerState = loadBreakerState();
  const now = getEffectiveNow();
  const autoSyncMeta = loadAutoSyncMeta();

  const autoCollapsed = useMemo(
    () => computeAutoCollapsedRounds(resolvedKnockout, isPrediction ? "predictions" : "actual"),
    [resolvedKnockout, isPrediction],
  );

  const [overrides, setOverridesState] = useState<Partial<Record<KnockoutRound, Override>>>(() => loadOverrides());

  useEffect(() => { saveOverrides(overrides); }, [overrides]);

  function isCollapsed(round: KnockoutRound): boolean {
    const ovr = overrides[round];
    if (ovr) return ovr === "collapsed";
    return autoCollapsed.has(round);
  }

  function toggle(round: KnockoutRound) {
    const next: Override = isCollapsed(round) ? "expanded" : "collapsed";
    setOverridesState((prev) => ({ ...prev, [round]: next }));
  }

  const matchesByRound = useMemo(() => {
    const map: Record<KnockoutRound, KnockoutMatch[]> = { R32: [], R16: [], QF: [], SF: [], "3P": [], F: [] };
    for (const m of resolvedKnockout) map[m.round].push(m);
    for (const r of Object.keys(map) as KnockoutRound[]) {
      map[r].sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));
    }
    return map;
  }, [resolvedKnockout]);

  function renderMatchCard(match: KnockoutMatch, opts: { thirdPlace?: boolean } = {}) {
    const homeTeam = match.homeTeamId ? getTeam(match.homeTeamId) : null;
    const awayTeam = match.awayTeamId ? getTeam(match.awayTeamId) : null;
    const currentScore = isPrediction ? match.prediction : match.result;
    const readonlyScore = isPrediction ? match.result : undefined;
    const bothKnown = match.homeTeamId !== null && match.awayTeamId !== null;
    const editable = isMatchEditable(match, { autoSyncEnabled, circuitBreakerTripped: breakerState.tripped, now });
    return (
      <div key={match.id} className={`bracket-tree-card ${opts.thirdPlace ? "third-place" : ""}`}>
        <div className="bracket-tree-card-header">
          <span className="bracket-tree-card-id">{opts.thirdPlace ? t("knockout.rounds.3P") : match.id}</span>
          <span className="bracket-tree-card-date">{formatDate(match.dateUtc)}</span>
        </div>
        <div className="bracket-tree-card-team">
          {homeTeam ? (
            <>
              <span className="team-flag">{homeTeam.flag}</span>
              <span className="bracket-tree-card-name">{t(`teams.${homeTeam.id}`)}</span>
            </>
          ) : <span className="bracket-tree-card-name pending">{slotLabel(t, match, "home")}</span>}
        </div>
        <div className="bracket-tree-card-team">
          {awayTeam ? (
            <>
              <span className="team-flag">{awayTeam.flag}</span>
              <span className="bracket-tree-card-name">{t(`teams.${awayTeam.id}`)}</span>
            </>
          ) : <span className="bracket-tree-card-name pending">{slotLabel(t, match, "away")}</span>}
        </div>
        <div className="bracket-tree-card-score">
          {bothKnown ? (
            <ScoreInput score={currentScore}
              onScoreChange={(score) => dispatch({ type: "SET_KNOCKOUT_SCORE", matchId: match.id, score })}
              isPrediction={isPrediction} readonlyScore={readonlyScore ?? undefined} allowPenalties
              locked={isPrediction && isMatchLocked(match.dateUtc)}
              synced={!isPrediction && state.syncedResultIds.includes(match.id)}
              disabled={!editable && !isPrediction}
              lockedReason={t("autoSync.waitingResult")}
              autoSyncedAt={autoSyncMeta.autoSyncedAt[match.id]}
              homeTeam={homeTeam ?? undefined} awayTeam={awayTeam ?? undefined} />
          ) : <span className="bracket-tree-vs">{t("knockout.vs")}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="bracket-tree">
      {COLUMN_ORDER.map((round) => {
        const collapsed = isCollapsed(round);
        const matches = matchesByRound[round];
        const includesThird = round === "F";
        const thirdMatches = includesThird ? matchesByRound["3P"] : [];
        const completed = (includesThird ? autoCollapsed.has("F") : autoCollapsed.has(round));
        return (
          <div key={round} className={`bracket-tree-col ${collapsed ? "collapsed" : ""}`}>
            <button
              type="button"
              className="bracket-tree-col-header"
              onClick={() => toggle(round)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? t("knockout.bracket.expandAria", { round: t(`knockout.rounds.${round}`) }) : t("knockout.bracket.collapseAria", { round: t(`knockout.rounds.${round}`) })}
            >
              <span className="bracket-tree-col-label">{t(`knockout.rounds.${round}`)}</span>
              {completed && <span className="bracket-tree-col-check">{t("knockout.bracket.roundCompleted")}</span>}
              <span className="bracket-tree-col-chev">{collapsed ? "▸" : "▾"}</span>
            </button>
            {!collapsed && (
              <div className="bracket-tree-col-body">
                {matches.map((m) => renderMatchCard(m))}
                {includesThird && thirdMatches.map((m) => renderMatchCard(m, { thirdPlace: true }))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 9.2: Create `BracketTree.css`**

Create `src/components/BracketTree.css`:

```css
.bracket-tree {
  display: grid;
  grid-template-columns: repeat(5, minmax(120px, 1fr));
  gap: 10px;
  overflow-x: auto;
  padding: 4px 0 12px;
}

.bracket-tree-col {
  display: flex; flex-direction: column;
  background: var(--card-bg); border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  min-width: 120px;
  transition: width 200ms ease, min-width 200ms ease;
}
.bracket-tree-col.collapsed { width: 36px; min-width: 36px; max-width: 36px; }
.bracket-tree-col.collapsed .bracket-tree-col-label {
  writing-mode: vertical-rl; transform: rotate(180deg);
  padding: 8px 0; text-align: center;
}
.bracket-tree-col.collapsed .bracket-tree-col-chev { display: none; }
.bracket-tree-col.collapsed .bracket-tree-col-check { display: none; }
.bracket-tree-col.collapsed .bracket-tree-col-header { padding: 4px 0; flex-direction: column; }

.bracket-tree-col-header {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 10px;
  background: var(--accent-green); color: white;
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
  border: none; cursor: pointer; border-radius: 8px 8px 0 0;
  text-align: left;
}
.bracket-tree-col-header:hover { filter: brightness(1.08); }
.bracket-tree-col-label { flex: 1; }
.bracket-tree-col-check { font-size: 12px; }
.bracket-tree-col-chev { font-size: 12px; opacity: 0.85; }

.bracket-tree-col-body {
  display: flex; flex-direction: column;
  padding: 8px; gap: 8px;
  flex: 1;
}

.bracket-tree-card {
  background: white; border-radius: 6px;
  padding: 6px 8px;
  border-left: 3px solid var(--accent-green);
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  font-size: 11px;
}
.bracket-tree-card.third-place { border-left-color: var(--accent-gold); }
.bracket-tree-card-header { display: flex; justify-content: space-between; font-size: 9px; color: #888; margin-bottom: 4px; }
.bracket-tree-card-team { display: flex; align-items: center; gap: 4px; padding: 2px 0; font-weight: 600; min-width: 0; }
.bracket-tree-card-team .team-flag { font-size: 13px; flex-shrink: 0; }
.bracket-tree-card-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 11px; }
.bracket-tree-card-name.pending { color: #aaa; font-weight: 400; font-style: italic; font-size: 10px; }
.bracket-tree-card-score { display: flex; justify-content: center; padding-top: 4px; }
.bracket-tree-vs { font-size: 10px; color: #aaa; }

/* Compact ScoreInput variant when used inside the bracket tree */
.bracket-tree .score-input-wrapper { gap: 2px; flex-wrap: nowrap; }
.bracket-tree .score-with-pen { gap: 2px; }
.bracket-tree .score-row { gap: 2px; }
.bracket-tree .score-field { width: 26px; height: 22px; font-size: 12px; font-weight: 700; }
.bracket-tree .score-separator { font-size: 11px; }
.bracket-tree .score-readonly { font-size: 11px; min-width: 16px; }
.bracket-tree .penalties-label { font-size: 8px; }
.bracket-tree .penalties-pick { font-size: 11px; padding: 1px 4px; min-width: 22px; }
.bracket-tree .locked-badge { font-size: 9px; margin-left: 4px; }
.bracket-tree .synced-badge { font-size: 10px; }
.bracket-tree .prediction-indicator { font-size: 11px; margin-left: 4px; }

@media (prefers-reduced-motion: reduce) {
  .bracket-tree-col { transition: none; }
}

@media (max-width: 768px) {
  .bracket-tree { grid-template-columns: repeat(5, 130px); }
  .bracket-tree-col.collapsed { width: 30px; min-width: 30px; max-width: 30px; }
}
```

- [ ] **Step 9.3: Verify build**

Run: `pnpm run build`
Expected: PASS. `BracketTree` is not used yet — that's fine.

---

## Task 10: Wire BracketTree into BracketView

**Files:**
- Modify: `src/components/BracketView.tsx`, `src/components/BracketView.css`

- [ ] **Step 10.1: Branch BracketView on mode**

In `src/components/BracketView.tsx`, add imports:

```ts
import { useViewMode } from "../context/ViewModeContext";
import { BracketTree } from "./BracketTree";
```

Inside the `BracketView` component, after `const { t, formatDate } = useLocale();` add:

```ts
  const { mode: viewMode } = useViewMode();
```

Then replace the existing `return` block so:

```tsx
  return (
    <div className={`bracket-view ${viewMode}`}>
      {viewMode === "compact" ? (
        <>
          <h2>{t("knockout.roundTitle.F")}</h2>
          <BracketTree />
        </>
      ) : (
        <>
          <div className="round-tabs" data-tour="round-tabs">
            {ROUND_TABS.map((r) => (
              <button key={r}
                className={`round-tab ${r === round ? "active" : ""}`}
                onClick={() => dispatch({ type: "SET_VIEW", view: { type: "knockout", round: r } })}>
                {t(`knockout.rounds.${r}`)}
              </button>
            ))}
          </div>
          <h2>{t(`knockout.roundTitle.${round}`)}</h2>
          {roundsToShow.map((r) => {
            const matches = resolvedKnockout.filter((m) => m.round === r).sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));
            return (
              <div key={r}>
                {roundsToShow.length > 1 && <div className="bracket-round-label">{t(`knockout.roundTitle.${r}`)}</div>}
                <div className="bracket-matches">
                  {matches.map((match) => {
                    const homeTeam = match.homeTeamId ? getTeam(match.homeTeamId) : null;
                    const awayTeam = match.awayTeamId ? getTeam(match.awayTeamId) : null;
                    const currentScore = isPrediction ? match.prediction : match.result;
                    const readonlyScore = isPrediction ? match.result : undefined;
                    const bothKnown = match.homeTeamId !== null && match.awayTeamId !== null;
                    const editable = isMatchEditable(match, {
                      autoSyncEnabled,
                      circuitBreakerTripped: breakerState.tripped,
                      now,
                    });
                    return (
                      <div key={match.id} className={`bracket-match-card ${r === "3P" ? "third-place" : ""}`}>
                        <div className="bracket-match-header">
                          <span className="bracket-match-id">{match.id}</span>
                          <span className="bracket-match-date">{formatDate(match.dateUtc)}</span>
                        </div>
                        <div className="bracket-match-teams">
                          <div className={`bracket-team home ${!homeTeam ? "pending" : ""}`}>
                            {homeTeam ? (<><span>{t(`teams.${homeTeam.id}`)}</span><span className="team-flag">{homeTeam.flag}</span></>) : <span>{slotLabel(t, match, "home")}</span>}
                          </div>
                          {bothKnown ? (
                            <ScoreInput score={currentScore}
                              onScoreChange={(score) => dispatch({ type: "SET_KNOCKOUT_SCORE", matchId: match.id, score })}
                              isPrediction={isPrediction} readonlyScore={readonlyScore ?? undefined} allowPenalties
                              locked={isPrediction && isMatchLocked(match.dateUtc)}
                              synced={!isPrediction && state.syncedResultIds.includes(match.id)}
                              disabled={!editable && !isPrediction}
                              lockedReason={t("autoSync.waitingResult")}
                              autoSyncedAt={autoSyncMeta.autoSyncedAt[match.id]}
                              homeTeam={homeTeam ?? undefined} awayTeam={awayTeam ?? undefined} />
                          ) : <span className="score-separator">{t("knockout.vs")}</span>}
                          <div className={`bracket-team ${!awayTeam ? "pending" : ""}`}>
                            {awayTeam ? (<><span className="team-flag">{awayTeam.flag}</span><span>{t(`teams.${awayTeam.id}`)}</span></>) : <span>{slotLabel(t, match, "away")}</span>}
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
        </>
      )}
    </div>
  );
```

- [ ] **Step 10.2: Verify**

Run: `pnpm run build` — PASS.

Manual: `pnpm run dev`, toggle to compact mode. The round tabs disappear. The bracket-tree shows 5 columns. Click a column header — it collapses to a thin vertical bar with rotated label. Refresh the page (no close/reopen of tab) and the manual override survives. Close the tab and reopen — overrides are gone (sessionStorage clears).

Test penalty editing: in `predictions` mode, tie a knockout match in the bracket-tree (e.g. 1-1) → the penalty picker (two flag buttons) appears below the inputs.

---

## Task 11: Test the full suite + lint + build

- [ ] **Step 11.1: Full test run**

Run: `pnpm test`
Expected: all tests pass. Including the two new test files (`viewMode.test.ts`, `bracketAutoCollapse.test.ts`) and the i18n consistency tests.

- [ ] **Step 11.2: Lint**

Run: `pnpm lint`
Expected: at most the 9 pre-existing errors documented in `CLAUDE.md`. No new errors.

- [ ] **Step 11.3: Build**

Run: `pnpm run build`
Expected: succeeds, writes to `dist/`.

- [ ] **Step 11.4: Manual smoke (dev server)**

`pnpm run dev`. Walk through this checklist:

- TopBar toggle icon visible; click switches mode; `localStorage.viewMode` flips.
- Reload — mode persists.
- **Schedule compact**: each match is one row; day separator is an inline hairline; editing a score updates state immediately; prediction indicator (✓/½/✗) shows when applicable.
- **Groups compact**: standings collapsible (starts collapsed on viewports <768px, expanded otherwise); match rows compact; tab between groups still works.
- **Bracket compact**: round tabs hidden; 5 columns visible; click a column header to collapse/expand; refresh → manual overrides persist (same browser session); close tab + reopen → overrides gone, auto-collapse takes over for completed rounds.
- **Bracket score editing**: tie a knockout match in predictions mode → penalty picker appears, can pick a flag winner; clicking it sets the penalty score.
- **Prediction indicator in bracket**: in predictions mode with a real result, the indicator (✓/½/✗) shows next to the score.
- **DevTools mobile viewport (375×667)**: all three views remain usable; bracket has horizontal scroll; nothing overflows the screen.
- **Switch back to expanded**: every view returns to its original layout (tabs, large cards).

---

## Task 12: Final commit (deferred for user approval)

> Per the user's session preference, no commits should land before this point. The plan ends with a single commit step the user explicitly opts into.

- [ ] **Step 12.1: Review diff**

Run: `git status` and `git diff --stat` to confirm what's changed.

- [ ] **Step 12.2: Stage changes**

Run:
```bash
git add \
  src/utils/viewMode.ts \
  src/utils/__tests__/viewMode.test.ts \
  src/utils/bracketAutoCollapse.ts \
  src/utils/__tests__/bracketAutoCollapse.test.ts \
  src/context/ViewModeContext.tsx \
  src/main.tsx \
  src/i18n/locales/es.ts \
  src/i18n/locales/en.ts \
  src/i18n/locales/pt.ts \
  src/components/TopBar.tsx \
  src/components/TopBar.css \
  src/components/CompactMatchRow.tsx \
  src/components/CompactMatchRow.css \
  src/components/CompactStandings.tsx \
  src/components/CompactStandings.css \
  src/components/ScheduleView.tsx \
  src/components/ScheduleView.css \
  src/components/GroupView.tsx \
  src/components/GroupView.css \
  src/components/BracketTree.tsx \
  src/components/BracketTree.css \
  src/components/BracketView.tsx \
  docs/superpowers/specs/2026-05-26-compact-views-design.md \
  docs/superpowers/plans/2026-05-26-compact-views.md
```

- [ ] **Step 12.3: Commit with a single message**

Run:
```bash
git commit -m "$(cat <<'EOF'
feat(views): global compact mode with bracket tree

Adds a TopBar toggle for compact vs expanded views. Schedule and Groups
render single-line match rows with an inline day separator. Groups gets
a collapsible 4-column standings table. Knockouts replace the round tabs
with a bracket tree that auto-collapses past rounds (manual override
persists per session).
EOF
)"
```

---

## Self-review checklist (run after implementing)

- [ ] Every spec requirement maps to at least one task (see §3 decisions table in the spec).
- [ ] No "TODO" / "TBD" / placeholder strings in any new file.
- [ ] `loadViewMode` / `saveViewMode` names match between `viewMode.ts` and consumers.
- [ ] `useViewMode()` returns `{ mode, toggle, setMode }` — same shape used in every consumer.
- [ ] `CompactMatchRow` props match what `ScheduleView` and `GroupView` pass.
- [ ] All three locales have identical key sets (the consistency test enforces it; verify locally).
- [ ] `BracketTree` reuses `ScoreInput` without modifying its API.
- [ ] `sessionStorage` (not `localStorage`) is used for bracket collapse overrides.
