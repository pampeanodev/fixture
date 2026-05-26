# Mobile Tour Fix — Design

**Status:** approved, pending implementation
**Date:** 2026-04-22
**Scope:** make the `overview` tour work on mobile (≤ 768px) by auto-toggling the sidebar for the steps that target sidebar elements.

## Why

On mobile, the sidebar is `transform: translateX(-100%)` by default. The `overview` tour has three steps (`nav-groups`, `nav-knockout`, `nav-rooms`) that target elements inside that sidebar, so on mobile they point at off-screen coordinates and the tour looks broken. This is the "problem #2" noted in the How-to-Play spec's follow-ups list.

The remaining tours (`groups`, `knockout`, `rooms`, `simulator`) target elements inside the main content area and already work on mobile — no changes needed there.

## Decisions

1. **Strategy:** auto-toggle the sidebar during the overview tour on mobile. A tour step that points at a sidebar element opens the sidebar; a step that points at the TopBar or FAB closes it.
2. **Transition handling:** disable the sidebar CSS transition during the tour (a `body.tour-active` class). The sidebar snaps instantly between states, letting driver.js measure positions correctly without timers.
3. **Desktop:** no behavior change. Hooks are only inserted when `isMobile === true`.
4. **State hoisting:** move the sidebar open/close state from `App.tsx` into a new `SidebarContext`, so `useTour` (which runs deeper in the tree, inside `HelpMenu`) can access it without prop-drill.
5. **Snapshot:** capture the user's sidebar state at tour start and restore it at tour end.

## Out of scope

- Contextual tours (`groups`, `knockout`, `rooms`, `simulator`) — they already work on mobile.
- Hamburger icon / sidebar behavior outside the tour.
- Popover positioning fixes on very small screens (<360px) — a driver.js concern, not ours.

## Architecture

### New files

- `src/context/SidebarContext.tsx` — provider + hook exposing `{ isOpen, isMobile, setOpen, toggle }`.

### Modified files

- `src/App.tsx` — wraps the tree with `<SidebarProvider>`, consumes `useSidebar()` instead of the local `useState`. The existing `useIsMobile` logic and the effect that resets `isOpen = !isMobile` when the breakpoint flips both move into the provider.
- `src/tour/steps.ts` — `buildTours(t, opts)` accepts a second argument `{ isMobile, setSidebarOpen }`. When `isMobile === true`, each step of the overview tour gets an `onHighlightStarted` hook that sets the sidebar to the correct state. Other tours are unchanged.
- `src/tour/useTour.ts` — consumes `useSidebar()`, passes options to `buildTours`, adds/removes `body.tour-active` on tour start/destroy, snapshots and restores the sidebar state.
- `src/App.css` — adds one rule inside the existing `@media (max-width: 768px)` block: `body.tour-active .sidebar { transition: none; }`.

### Unchanged

- `Sidebar.tsx`, `HelpMenu.tsx`, `HowToPlay.tsx`, `HelpButton.tsx`, all contextual tour steps.

## Interfaces

### `SidebarContext.tsx`

```ts
interface SidebarState {
  isOpen: boolean;
  isMobile: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export function SidebarProvider({ children }: { children: ReactNode }): JSX.Element;
export function useSidebar(): SidebarState;
```

The provider internalizes two pieces of state that currently live in `App.tsx`:
- `useIsMobile()` logic (window.innerWidth ≤ 768 with a resize listener).
- `const [isOpen, setIsOpen] = useState(!isMobile)` + the effect that resets `isOpen` when `isMobile` changes.

Consumers:
- `App.tsx` — reads `isOpen`, `isMobile`, passes them as props to `Sidebar` and the overlay click handler.
- `useTour.ts` — reads `isMobile` and `setOpen`.

### `buildTours` signature change

```ts
interface TourOptions {
  isMobile: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export function buildTours(t: TFunction, opts: TourOptions): Record<TourId, DriveStep[]>;
```

Only the `overview` tour consults `opts`. The other four tours are built identically regardless of `opts`.

### `useTour` changes

```ts
const { isMobile, isOpen, setOpen } = useSidebar();
const tours = useMemo(
  () => buildTours(t, { isMobile, setSidebarOpen: setOpen }),
  [t, isMobile, setOpen],
);

const startTour = useCallback((id: TourId) => {
  driverRef.current?.destroy();
  const snapshot = isOpen;
  document.body.classList.add("tour-active");
  const d = driver({
    // ...existing config (showProgress, allowClose, popoverClass, button texts)...
    steps: tours[id],
    onDestroyed: () => {
      document.body.classList.remove("tour-active");
      setOpen(snapshot);
    },
  });
  driverRef.current = d;
  d.drive();
}, [t, tours, isOpen, setOpen]);
```

The `onDestroyed` hook fires whether the tour ends naturally (user hits "Listo") or is interrupted (Esc, click outside, new tour dispatched). Either way the sidebar is restored and the class is removed.

## Per-step hooks (overview tour on mobile)

| # | Step | Target | Sidebar state |
|---|---|---|---|
| 1 | `tour.overview.welcomeTitle` | none (centered popover) | closed |
| 2 | `tour.overview.modeTitle` | `[data-tour="mode-toggle"]` (TopBar) | closed |
| 3 | `tour.overview.groupsTitle` | `[data-tour="nav-groups"]` (sidebar) | **open** |
| 4 | `tour.overview.knockoutTitle` | `[data-tour="nav-knockout"]` (sidebar) | **open** |
| 5 | `tour.overview.roomsTitle` | `[data-tour="nav-rooms"]` (sidebar) | **open** |
| 6 | `tour.overview.helpTitle` | `[data-tour="help-button"]` (FAB) | closed |

Implementation sketch inside `buildTours`:

```ts
function mobileHook(open: boolean) {
  return opts.isMobile
    ? { onHighlightStarted: () => opts.setSidebarOpen(open) }
    : {};
}

const overview: DriveStep[] = [
  { popover: { title: ..., description: ... }, ...mobileHook(false) },
  { element: '[data-tour="mode-toggle"]', popover: {...}, ...mobileHook(false) },
  { element: '[data-tour="nav-groups"]', popover: {...}, ...mobileHook(true) },
  // ...
];
```

When `isMobile` is false, `mobileHook` spreads nothing — the existing step shape is preserved byte-for-byte.

## CSS

Add inside the existing `@media (max-width: 768px)` block in `App.css` (near the `.sidebar.collapsed` rule):

```css
body.tour-active .sidebar { transition: none; }
```

One line. Desktop is unaffected because the rule lives inside the mobile media query.

## Edge cases

- **Orientation / resize during tour.** If `isMobile` flips mid-tour, the running driver instance still holds the steps it was built with. The hooks on those steps still run (they reference `setSidebarOpen` by closure). Worst case: a user rotates mid-tour and the sidebar ends up in an awkward state. Acceptable — rare, and `onDestroyed` restores the snapshot at tour end.
- **User closes sidebar manually during tour** (taps the overlay). Next step's `onHighlightStarted` hook re-sets the correct state. No issue.
- **Tour invoked from HelpMenu with sidebar already open** (desktop-opened-then-resized, or user manually opened it). `snapshot = true`. Step 6 (`help-button`) closes the sidebar; `onDestroyed` reopens it. One-frame flicker at tour end — acceptable.
- **driver.js internally calls `destroy()` on a subsequent `startTour`.** The existing code already calls `driverRef.current?.destroy();` at the top of `startTour`, which triggers `onDestroyed` of the previous instance. The cleanup runs before the new tour's setup. ✅
- **Auto-start path.** `useEffect` in `useTour` auto-starts `overview` on first visit for new users. Because it calls the same `startTour` function, it picks up the mobile hooks automatically. No separate code path.

## Testing

Per CLAUDE.md conventions, no component unit tests. Manual QA:

- [ ] **Desktop (>768px):** run the overview tour — all 6 steps highlight correctly, sidebar stays visible the whole time (no auto-toggle). No behavior change versus today.
- [ ] **Mobile (≤768px), fresh user:** auto-start fires → step 1 shows without sidebar → step 2 highlights mode-toggle in TopBar → steps 3–5 highlight sidebar nav items with sidebar visible → step 6 highlights FAB with sidebar hidden.
- [ ] **Mobile, manual trigger from HelpMenu:** same behavior as auto-start.
- [ ] **Mobile, close tour with Esc:** sidebar returns to pre-tour state, `body.tour-active` class removed (inspect DOM).
- [ ] **Mobile, close tour with X button:** same as Esc.
- [ ] **Mobile, during transitions:** sidebar snaps open/closed with no visible 200ms animation. No flicker of wrong highlight position.
- [ ] **Contextual tours on mobile:** open Grupos → trigger `groups` tour → works as today (no regression).
- [ ] **Language switch:** tour works identically in ES/EN/PT.
- [ ] **Lint/build/test:** `pnpm lint` still at 9 pre-existing errors; `pnpm run build` succeeds; `pnpm test` passes all 169.

## Risks

- **Adding a context for two consumers** is arguably over-engineering. Alternative was prop-drilling `setSidebarOpen` from App → HelpMenu → useTour. Chose context because: (a) `useTour`'s auto-start effect needs access to the setter without being re-called when App re-renders; (b) future consumers (mobile topbar buttons, keyboard shortcuts) are plausible; (c) the context is tiny and colocated with the existing `context/` dir.
- **CSS specificity.** `body.tour-active .sidebar { transition: none; }` has specificity (0,1,1). The existing sidebar transitions come from `.sidebar { transition: ... }` with specificity (0,0,1). The `tour-active` rule wins without `!important`. Verified by reading current App.css.
- **driver.js v1 hook guarantees.** `onDestroyed` is documented to fire on all destroy paths (completion, user cancel, programmatic destroy). If a future driver.js version changes this, the `body.tour-active` class could leak. Mitigation: add a defensive cleanup in the `useTour` unmount effect that removes the class unconditionally. (Already in the current code: the unmount effect calls `driverRef.current?.destroy()`, which cascades to `onDestroyed`.)
