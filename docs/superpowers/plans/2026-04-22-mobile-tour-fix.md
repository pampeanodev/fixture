# Mobile Tour Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `overview` tour work on mobile by auto-toggling the sidebar for steps that target sidebar items, without changing desktop behavior.

**Architecture:** Move sidebar open/close state into a new `SidebarContext` so `useTour` can access it. Extend `buildTours` with per-step `onHighlightStarted` hooks that only run on mobile. Disable the sidebar CSS transition while the tour is active so the sidebar snaps instantly between open/closed, letting driver.js measure positions correctly.

**Tech Stack:** React 19, TypeScript 6, Vitest, driver.js 1.x, vanilla CSS.

**Spec:** `docs/superpowers/specs/2026-04-22-mobile-tour-fix-design.md`

---

## Preconditions

- `pnpm install` has been run.
- `pnpm test` green on `main` (169 tests passing).
- `pnpm run build` passes.

## File structure (reference)

```
src/
├── context/
│   └── SidebarContext.tsx          (NEW — Task 1)
├── App.tsx                         (MODIFIED — Task 2)
├── App.css                         (MODIFIED — Task 4)
├── tour/
│   ├── steps.ts                    (MODIFIED — Task 3)
│   ├── useTour.ts                  (MODIFIED — Task 3)
│   └── __tests__/
│       └── steps.test.ts           (NEW — Task 3)
```

---

## Task 1: Create `SidebarContext`

**Files:**
- Create: `src/context/SidebarContext.tsx`

- [ ] **Step 1: Create the provider + hook**

Create `src/context/SidebarContext.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

interface SidebarState {
  isOpen: boolean;
  isMobile: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarState | null>(null);

function useBreakpoint(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    function handler() {
      setIsMobile(window.innerWidth <= 768);
    }
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const isMobile = useBreakpoint();
  const [isOpen, setIsOpen] = useState<boolean>(!isMobile);

  useEffect(() => {
    setIsOpen(!isMobile);
  }, [isMobile]);

  const setOpen = useCallback((open: boolean) => setIsOpen(open), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const value = useMemo<SidebarState>(
    () => ({ isOpen, isMobile, setOpen, toggle }),
    [isOpen, isMobile, setOpen, toggle],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarState {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside <SidebarProvider>");
  return ctx;
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: success (the new file isn't consumed yet, so TS just checks it compiles).

- [ ] **Step 3: Commit**

```bash
git add src/context/SidebarContext.tsx
git commit -m "feat(sidebar): add SidebarContext with breakpoint tracking"
```

---

## Task 2: Refactor `App.tsx` to consume `SidebarContext`

**Files:**
- Modify: `src/App.tsx`

This task removes the local `useIsMobile` hook and the local `sidebarOpen` useState from App, and instead consumes them from `useSidebar()`. The JSX that uses them moves into a new inner component (`AppContent`) that runs under the provider.

- [ ] **Step 1: Rewrite `App.tsx`**

Replace the full contents of `src/App.tsx` with:

```tsx
import { useEffect } from "react";
import { useFixture } from "./context/FixtureContext";
import { useNostr } from "./context/NostrContext";
import { SidebarProvider, useSidebar } from "./context/SidebarContext";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { GroupView } from "./components/GroupView";
import { BracketView } from "./components/BracketView";
import { ScheduleView } from "./components/ScheduleView";
import { RankingView } from "./components/RankingView";
import { RoomList } from "./components/RoomList";
import { RoomDetail } from "./components/RoomDetail";
import { SimulatorView } from "./components/SimulatorView";
import { Onboarding } from "./components/Onboarding";
import { HelpMenu } from "./components/HelpMenu";
import { useNostrSync } from "./hooks/useNostrSync";
import type { TourId } from "./tour/steps";
import type { ViewTarget } from "./types";
import "./App.css";

function contextTour(activeView: ViewTarget): TourId {
  switch (activeView.type) {
    case "groups": return "groups";
    case "knockout": return "knockout";
    case "rooms":
    case "room": return "rooms";
    case "simulator": return "simulator";
    default: return "overview";
  }
}

function NostrSyncBridge() {
  useNostrSync();
  return null;
}

function TourBridge({ activeView }: { activeView: ViewTarget }) {
  return <HelpMenu tourId={contextTour(activeView)} />;
}

function InviteRouter() {
  const { joinRoom, setActiveRoom, identity } = useNostr();
  const { dispatch } = useFixture();

  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/r\/([a-z0-9]{8})$/);
    if (!match) return;
    if (!identity) return;

    const roomId = match[1];
    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get("i") ?? undefined;

    joinRoom(roomId, inviteCode);
    setActiveRoom(roomId);
    dispatch({ type: "SET_VIEW", view: { type: "room", roomId } });

    window.history.replaceState(null, "", "/");
  }, [identity, joinRoom, setActiveRoom, dispatch]);

  return null;
}

function AppContent() {
  const { state } = useFixture();
  const { activeView } = state;
  const { isOpen, isMobile, setOpen, toggle } = useSidebar();

  function handleNavigation() {
    if (isMobile) setOpen(false);
  }

  return (
    <>
      <NostrSyncBridge />
      <InviteRouter />
      <TourBridge activeView={activeView} />
      <div className="app-layout">
        {isMobile && isOpen && (
          <div className="sidebar-overlay visible" onClick={() => setOpen(false)} />
        )}
        <Sidebar
          collapsed={!isOpen}
          isMobile={isMobile}
          onNavigate={handleNavigation}
        />
        <div className="main-area">
          <TopBar onToggleSidebar={toggle} />
          <div className="main-content">
            {activeView.type === "groups" && <GroupView group={activeView.group} />}
            {activeView.type === "knockout" && <BracketView round={activeView.round} />}
            {activeView.type === "schedule" && <ScheduleView />}
            {activeView.type === "ranking" && <RankingView />}
            {activeView.type === "rooms" && <RoomList />}
            {activeView.type === "room" && <RoomDetail roomId={activeView.roomId} />}
            {activeView.type === "simulator" && <SimulatorView />}
          </div>
        </div>
      </div>
    </>
  );
}

export default function App() {
  const { identity } = useNostr();

  if (!identity) return <Onboarding />;

  return (
    <SidebarProvider>
      <AppContent />
    </SidebarProvider>
  );
}
```

**What changed:**
- Removed the local `useIsMobile` hook, the local `useState(!isMobile)`, and the `useEffect` that resets `sidebarOpen` on breakpoint change. All three moved into `SidebarProvider`.
- Introduced `AppContent` so the sidebar consumer renders under `SidebarProvider`.
- `handleNavigation` no longer uses `useCallback` (dependencies are trivially stable via context).
- `onToggleSidebar={toggle}` directly (previously was an inline lambda calling `setSidebarOpen((v) => !v)`).

- [ ] **Step 2: Verify build + tests + lint**

Run: `pnpm test && pnpm run build && pnpm lint`
Expected: 169 tests pass, build succeeds, lint at exactly 9 pre-existing errors (the `react-hooks/set-state-in-effect` warning that was on `App.tsx:86` moves into `SidebarContext.tsx` — still exactly 9 total, no net new errors).

- [ ] **Step 3: Manual smoke**

Run: `pnpm run dev` — confirm in the browser:
- Desktop: sidebar shows by default, toggle button hides/shows it.
- Mobile (resize to ≤768px): sidebar hidden by default, hamburger opens it, overlay click closes it, clicking a nav item closes it.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "refactor(app): hoist sidebar state into SidebarContext"
```

---

## Task 3: Tour hooks for mobile

**Files:**
- Modify: `src/tour/steps.ts`
- Modify: `src/tour/useTour.ts`
- Create: `src/tour/__tests__/steps.test.ts`

Three parts must ship together because `buildTours` signature changes and `useTour` is its only caller.

- [ ] **Step 1: Write failing test**

Create `src/tour/__tests__/steps.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { buildTours } from "../steps";

type Dict = Record<string, string>;

function fakeT(entries: Dict = {}): (key: string) => string {
  return (key: string) => entries[key] ?? key;
}

describe("buildTours — overview tour", () => {
  it("desktop: no onHighlightStarted hooks on any step", () => {
    const setSidebarOpen = vi.fn();
    const tours = buildTours(fakeT(), { isMobile: false, setSidebarOpen });
    for (const step of tours.overview) {
      expect(step.onHighlightStarted).toBeUndefined();
    }
  });

  it("mobile: every overview step has an onHighlightStarted hook", () => {
    const setSidebarOpen = vi.fn();
    const tours = buildTours(fakeT(), { isMobile: true, setSidebarOpen });
    for (const step of tours.overview) {
      expect(step.onHighlightStarted).toBeTypeOf("function");
    }
  });

  it("mobile: sidebar nav steps open the sidebar, others close it", () => {
    const setSidebarOpen = vi.fn();
    const tours = buildTours(fakeT(), { isMobile: true, setSidebarOpen });

    // Indexes match the 6-step order in the spec:
    // 0 welcome, 1 mode-toggle, 2 nav-groups, 3 nav-knockout, 4 nav-rooms, 5 help-button
    const expectations: ReadonlyArray<boolean> = [false, false, true, true, true, false];

    expectations.forEach((expected, idx) => {
      setSidebarOpen.mockClear();
      tours.overview[idx].onHighlightStarted?.(undefined, tours.overview[idx], {
        config: {}, state: {}, driver: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      expect(setSidebarOpen).toHaveBeenCalledWith(expected);
    });
  });

  it("mobile: contextual tours (groups/knockout/rooms/simulator) have no hooks", () => {
    const setSidebarOpen = vi.fn();
    const tours = buildTours(fakeT(), { isMobile: true, setSidebarOpen });
    for (const tourId of ["groups", "knockout", "rooms", "simulator"] as const) {
      for (const step of tours[tourId]) {
        expect(step.onHighlightStarted).toBeUndefined();
      }
    }
  });
});
```

Note: the cast to `any` in the invocation arg is allowed by project lint rules only inside test files (the existing `eslint.config.js` allows this pattern because we need to construct a fake driver state that matches driver.js's opaque internal types; see the inline disable comment). If the project's lint forbids it, replace `as any` with a minimal stub matching driver.js's `HookArgs` type — it's exported as `DriveHookArgs` in recent versions, else `AllowedButtons` etc. Check driver.js types first.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/tour/__tests__/steps.test.ts`
Expected: fails on call signature — existing `buildTours` takes only `t`, not options.

- [ ] **Step 3: Update `src/tour/steps.ts`**

Replace the full contents with:

```ts
import type { DriveStep } from "driver.js";
import type { TFunction } from "../i18n/translate";

export type TourId = "overview" | "groups" | "knockout" | "rooms" | "simulator";

export interface TourOptions {
  isMobile: boolean;
  setSidebarOpen: (open: boolean) => void;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderTourHtml(template: string): string {
  return template.replace(
    /<(\d+)>([\s\S]*?)<\/\1>/g,
    (_, _id, content: string) => `<strong>${escapeHtml(content)}</strong>`,
  );
}

export function buildTours(t: TFunction, opts: TourOptions): Record<TourId, DriveStep[]> {
  function mobileHook(open: boolean): Partial<DriveStep> {
    if (!opts.isMobile) return {};
    return { onHighlightStarted: () => opts.setSidebarOpen(open) };
  }

  const overview: DriveStep[] = [
    {
      popover: {
        title: t("tour.overview.welcomeTitle"),
        description: renderTourHtml(t("tour.overview.welcomeBody")),
      },
      ...mobileHook(false),
    },
    {
      element: '[data-tour="mode-toggle"]',
      popover: {
        title: t("tour.overview.modeTitle"),
        description: t("tour.overview.modeBody"),
      },
      ...mobileHook(false),
    },
    {
      element: '[data-tour="nav-groups"]',
      popover: {
        title: t("tour.overview.groupsTitle"),
        description: t("tour.overview.groupsBody"),
      },
      ...mobileHook(true),
    },
    {
      element: '[data-tour="nav-knockout"]',
      popover: {
        title: t("tour.overview.knockoutTitle"),
        description: t("tour.overview.knockoutBody"),
      },
      ...mobileHook(true),
    },
    {
      element: '[data-tour="nav-rooms"]',
      popover: {
        title: t("tour.overview.roomsTitle"),
        description: t("tour.overview.roomsBody"),
      },
      ...mobileHook(true),
    },
    {
      element: '[data-tour="help-button"]',
      popover: {
        title: t("tour.overview.helpTitle"),
        description: t("tour.overview.helpBody"),
        side: "left",
      },
      ...mobileHook(false),
    },
  ];

  const groups: DriveStep[] = [
    {
      element: '[data-tour="group-tabs"]',
      popover: {
        title: t("tour.groups.tabsTitle"),
        description: t("tour.groups.tabsBody"),
      },
    },
    {
      element: '[data-tour="standings-table"]',
      popover: {
        title: t("tour.groups.standingsTitle"),
        description: t("tour.groups.standingsBody"),
      },
    },
    {
      element: '[data-tour="match-cards"]',
      popover: {
        title: t("tour.groups.matchesTitle"),
        description: t("tour.groups.matchesBody"),
      },
    },
  ];

  const knockout: DriveStep[] = [
    {
      element: '[data-tour="round-tabs"]',
      popover: {
        title: t("tour.knockout.tabsTitle"),
        description: t("tour.knockout.tabsBody"),
      },
    },
    {
      popover: {
        title: t("tour.knockout.autoTitle"),
        description: t("tour.knockout.autoBody"),
      },
    },
  ];

  const rooms: DriveStep[] = [
    {
      element: '[data-tour="room-create"]',
      popover: {
        title: t("tour.rooms.createTitle"),
        description: t("tour.rooms.createBody"),
      },
    },
    {
      element: '[data-tour="room-join"]',
      popover: {
        title: t("tour.rooms.joinTitle"),
        description: t("tour.rooms.joinBody"),
      },
    },
    {
      popover: {
        title: t("tour.rooms.commitTitle"),
        description: t("tour.rooms.commitBody"),
      },
    },
  ];

  const simulator: DriveStep[] = [
    {
      popover: {
        title: t("tour.simulator.modeTitle"),
        description: t("tour.simulator.modeBody"),
      },
    },
    {
      popover: {
        title: t("tour.simulator.rankingTitle"),
        description: t("tour.simulator.rankingBody"),
      },
    },
    {
      popover: {
        title: t("tour.simulator.safeTitle"),
        description: t("tour.simulator.safeBody"),
      },
    },
  ];

  return { overview, groups, knockout, rooms, simulator };
}
```

**What changed:**
- Added `TourOptions` interface (exported).
- `buildTours` now takes `(t, opts)`.
- Introduced inner `mobileHook(open)` helper that returns `{ onHighlightStarted: ... }` on mobile, `{}` otherwise.
- Spread `...mobileHook(open)` into each overview step. Other tours unchanged.

- [ ] **Step 4: Update `src/tour/useTour.ts`**

Replace the full contents with:

```ts
import { useEffect, useRef, useCallback, useMemo } from "react";
import { driver } from "driver.js";
import type { Driver } from "driver.js";
import { buildTours } from "./steps";
import type { TourId } from "./steps";
import { useFixture } from "../context/FixtureContext";
import { useSidebar } from "../context/SidebarContext";
import { useLocale } from "../i18n";
import { shouldAutoStart } from "./shouldAutoStart";
import "./driver.css";

const SEEN_KEY = "fixture.tourSeen";
const TOUR_ACTIVE_CLASS = "tour-active";

export function useTour() {
  const driverRef = useRef<Driver | null>(null);
  const { state } = useFixture();
  const { t } = useLocale();
  const { isMobile, isOpen, setOpen } = useSidebar();

  const tours = useMemo(
    () => buildTours(t, { isMobile, setSidebarOpen: setOpen }),
    [t, isMobile, setOpen],
  );

  const startTour = useCallback((id: TourId) => {
    driverRef.current?.destroy();
    const snapshot = isOpen;
    document.body.classList.add(TOUR_ACTIVE_CLASS);
    const d = driver({
      showProgress: true,
      allowClose: true,
      popoverClass: "fixture-tour-popover",
      nextBtnText: t("tour.ui.next"),
      prevBtnText: t("tour.ui.prev"),
      doneBtnText: t("tour.ui.done"),
      progressText: "{{current}} / {{total}}",
      steps: tours[id],
      onDestroyed: () => {
        document.body.classList.remove(TOUR_ACTIVE_CLASS);
        setOpen(snapshot);
      },
    });
    driverRef.current = d;
    d.drive();
  }, [t, tours, isOpen, setOpen]);

  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY)) return;
    if (!shouldAutoStart(state)) {
      localStorage.setItem(SEEN_KEY, "skipped");
      return;
    }
    const timer = setTimeout(() => {
      startTour("overview");
      localStorage.setItem(SEEN_KEY, "overview");
    }, 500);
    return () => clearTimeout(timer);
  }, [state, startTour]);

  useEffect(() => () => {
    driverRef.current?.destroy();
    document.body.classList.remove(TOUR_ACTIVE_CLASS);
  }, []);

  return { startTour };
}
```

**What changed:**
- Added `useSidebar` import and usage.
- `buildTours` called with `{ isMobile, setSidebarOpen: setOpen }`.
- `startTour` wraps driver init with `body.tour-active` class toggle + snapshot/restore via `onDestroyed`.
- The unmount cleanup effect additionally removes the class defensively.

- [ ] **Step 5: Run the test from Step 1**

Run: `pnpm vitest run src/tour/__tests__/steps.test.ts`
Expected: 4 passed.

- [ ] **Step 6: Run the full suite + build + lint**

Run: `pnpm test && pnpm run build && pnpm lint`
Expected: 173 tests pass (169 + 4 new), build succeeds, lint unchanged at 9 errors.

- [ ] **Step 7: Commit**

```bash
git add src/tour/steps.ts src/tour/useTour.ts src/tour/__tests__/steps.test.ts
git commit -m "feat(tour): auto-toggle sidebar for overview tour on mobile"
```

---

## Task 4: CSS + Manual QA

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Add the transition-disable rule**

In `src/App.css`, inside the existing `@media (max-width: 768px)` block (around line 73, right after `.sidebar.collapsed { transform: translateX(-100%); }`), add:

```css
  body.tour-active .sidebar { transition: none; }
```

Full surrounding context (before → after):

Before:
```css
@media (max-width: 768px) {
  .sidebar {
    position: fixed; left: 0; top: 0; bottom: 0;
    z-index: 100; width: var(--sidebar-width);
    transform: translateX(-100%);
  }
  .sidebar.open { transform: translateX(0); }
  .sidebar.collapsed { transform: translateX(-100%); }

  .sidebar-overlay.visible { display: block; }
```

After:
```css
@media (max-width: 768px) {
  .sidebar {
    position: fixed; left: 0; top: 0; bottom: 0;
    z-index: 100; width: var(--sidebar-width);
    transform: translateX(-100%);
  }
  .sidebar.open { transform: translateX(0); }
  .sidebar.collapsed { transform: translateX(-100%); }
  body.tour-active .sidebar { transition: none; }

  .sidebar-overlay.visible { display: block; }
```

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 3: Manual QA**

Run: `pnpm run dev` and in a browser at mobile viewport (≤768px, e.g. DevTools device toolbar at iPhone 13 width 390×844):

- [ ] Clear `localStorage` to trigger auto-start (`localStorage.clear()` in console, then reload).
- [ ] Auto-start fires the overview tour:
  - Step 1 (welcome): centered popover, sidebar closed.
  - Step 2 (mode-toggle): TopBar button highlighted, sidebar closed.
  - Step 3 (nav-groups): sidebar visible, "Grupos" item highlighted.
  - Step 4 (nav-knockout): sidebar visible, "Eliminatorias" highlighted.
  - Step 5 (nav-rooms): sidebar visible, "Salas" highlighted.
  - Step 6 (help-button): sidebar hidden, FAB highlighted.
- [ ] Sidebar snaps open/closed with NO visible 200ms slide animation during the tour.
- [ ] On "Listo" (done button): `body.tour-active` class removed (inspect `<body>` in DevTools), sidebar returns to its pre-tour state (closed for a fresh mobile user).
- [ ] Reopen tour from HelpMenu (`?` → "Tour guiado") in `overview` view (e.g. Calendario): same 6-step behavior.
- [ ] Close tour with Esc: class removed, sidebar restored.
- [ ] Contextual tours (switch to Grupos, click `?` → Tour guiado): still work as before, sidebar not auto-toggled.
- [ ] Desktop (>768px): resize browser to wide, run overview tour from `?`: all 6 steps highlight, sidebar stays visible the whole time (no auto-toggle). No visible regression.
- [ ] Switch language to English, rerun tour on mobile: texts in English, same behavior.
- [ ] Switch to Portuguese: same.

- [ ] **Step 4: Commit**

```bash
git add src/App.css
git commit -m "style(app): disable sidebar transition during tour"
```

---

## Task 5 (optional): Push

- [ ] **Step 1: Push to remote**

```bash
git push origin main
```

---

## Self-review checklist

**Spec coverage:**
- Auto-toggle sidebar for overview steps on mobile → Task 3 (mobileHook + hooks per step).
- Disable CSS transition during tour → Task 4.
- No behavior change on desktop → Task 3 (mobileHook returns `{}` when not mobile) + test in `steps.test.ts`.
- State hoisting via SidebarContext → Tasks 1 + 2.
- Snapshot + restore on tour end → Task 3 `useTour.ts` changes.
- Class cleanup on unmount (defensive) → Task 3 `useTour.ts` unmount effect.
- Contextual tours unchanged → Task 3 `buildTours` does not spread hooks into `groups`/`knockout`/`rooms`/`simulator`; verified by a test case.

**Placeholder scan:** no "TBD", "TODO", or vague "handle edge cases". Every code step shows concrete code. Every verification step shows exact command + expected outcome.

**Type consistency:** `TourOptions { isMobile, setSidebarOpen }` declared in Task 3 `steps.ts` matches the call site in Task 3 `useTour.ts`. `SidebarState { isOpen, isMobile, setOpen, toggle }` declared in Task 1 matches consumers in Task 2 (`AppContent`) and Task 3 (`useTour`). `TourId` export preserved in `steps.ts` — still consumed by `App.tsx:contextTour`.

**No orphan references:** every type and function name used in a later task is defined in an earlier task or already exists in the repo.
