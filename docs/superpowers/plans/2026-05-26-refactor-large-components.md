# Plan — Refactor Components Over 200 Lines

**Date**: 2026-05-26
**Status**: Draft
**Trigger**: New `check-component-size.sh` PreToolUse hook blocks growth on `.tsx` files in `src/components/` already over 200 lines.
**Files affected (current line counts)**:

| File | Lines | Inline sub-components | Helpers |
|---|---|---|---|
| `SimulatorView.tsx` | 357 | (none) | `symbolFor` (l.353) |
| `ScheduleView.tsx` | 285 | `ScheduleMatchCard` (l.179) | — |
| `AutoSyncInspector.tsx` | 283 | `EventRow` (l.84) | `findRawEvent`, `formatScore`, `formatDate`, `kindIcon`, `normalizedJson` |
| `GroupView.tsx` | 251 | `MatchCard` (l.175), `ScoreField` (l.18) | — |

## Why now

CLAUDE.md now declares 200 lines a soft limit. The hook enforces "no growth" for these 4 files, so adding features to them requires extracting first. This plan unblocks that.

## Strategy

For each file, the pattern is the same:

1. **Move inline sub-components to their own files** (`src/components/<feature>/<SubComponent>.tsx` + matching `.css`).
2. **Extract helpers** to either the matching `<feature>/utils.ts` or to `src/utils/` if generic.
3. **Keep the top-level component as the orchestrator** — props plumbing + composition only.

No behavioral changes. No new features. Tests should still pass without modification (pure-logic helpers move into `__tests__/` coverage where possible).

## Per-file proposal

### 1. `SimulatorView.tsx` (357 → target ~150)

```
src/components/simulator/
├── SimulatorView.tsx          (~150)  orchestrator: state + dispatch wiring
├── SimulatorControls.tsx      (~60)   "Iniciar / Pausar / Salir" controls
├── SimulatorTimeline.tsx      (~70)   match-by-match playback timeline
├── SimulatorScoreboard.tsx    (~80)   current group standings preview
└── symbol.ts                  (~10)   the `symbolFor(points)` helper
```

`symbolFor` is pure — consider colocating its test as `src/components/simulator/__tests__/symbol.test.ts`.

### 2. `ScheduleView.tsx` (285 → target ~140)

```
src/components/schedule/
├── ScheduleView.tsx           (~140)  outer view: filters + day grouping
├── ScheduleDay.tsx            (~60)   groups matches by date with header
└── ScheduleMatchCard.tsx      (~90)   the inline component currently at l.179
```

The day-grouping logic inside `ScheduleView` (the loops that bucket matches by date) is the main reduction target after extracting the inline `ScheduleMatchCard`.

### 3. `AutoSyncInspector.tsx` (283 → target ~130)

```
src/components/autoSync/
├── AutoSyncInspector.tsx      (~130)  orchestrator
├── EventRow.tsx               (~80)   inline component at l.84
└── inspectorUtils.ts          (~40)   findRawEvent, formatScore, kindIcon, normalizedJson
```

`formatDate` already conflicts with `useLocale().formatDate` — verify if the local one can be replaced by the locale-aware version. If yes, delete it (don't move).

### 4. `GroupView.tsx` (251 → target ~140)

```
src/components/group/
├── GroupView.tsx              (~140)  orchestrator
├── MatchCard.tsx              (~70)   inline at l.175
└── ScoreField.tsx             (~30)   inline at l.18
```

`ScoreField` is the smallest — extract it first as a smoke test of the migration pattern, then `MatchCard`, then trim the orchestrator.

## Ordering

Do these in increasing order of risk:

1. **GroupView** (smallest, two extracts, contained scope)
2. **ScheduleView** (one extract + day-grouping reduction)
3. **AutoSyncInspector** (helpers spread out, `formatDate` cleanup)
4. **SimulatorView** (largest, no existing sub-components to extract — pure decomposition)

## Verification

After each file:

```
pnpm tsc -b --noEmit       # types still pass
pnpm test                  # 32 test files still green
pnpm run build             # production build works
pnpm run dev               # smoke-test the view in browser
```

For the SimulatorView refactor specifically, also click through:
- Start → run → exit
- Verify `ENTER_SIMULATION` / `EXIT_SIMULATION` reducer flow still snapshots/restores correctly
- Reload mid-sim → state should NOT persist (per CLAUDE.md gotcha)

## Out of scope

- Adding tests where there were none (components are intentionally not unit-tested per CLAUDE.md — keep that policy)
- Restructuring `src/components/` flat list as part of this work (other ~30 components stay where they are — only create subdirs for the 4 being split)
- Changing prop names or component contracts — pure file-level moves
