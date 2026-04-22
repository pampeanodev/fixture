import { describe, it, expect, vi } from "vitest";
import type { DriveStep } from "driver.js";
import { buildTours } from "../steps";

type Dict = Record<string, string>;

function fakeT(entries: Dict = {}): (key: string) => string {
  return (key: string) => entries[key] ?? key;
}

function invokeHook(step: DriveStep): void {
  // driver.js passes (element, step, { config, state, driver }). The hook we
  // attach only reads the `open` boolean from its closure, so the args can be
  // anything structurally-typed compatible. We call with undefined args.
  (step.onHighlightStarted as unknown as () => void)?.();
}

describe("buildTours — overview tour", () => {
  it("desktop: no onHighlightStarted hooks on any overview step", () => {
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

    // 0 welcome, 1 mode-toggle, 2 nav-groups, 3 nav-knockout, 4 nav-rooms, 5 help-button
    const expectations: ReadonlyArray<boolean> = [false, false, true, true, true, false];

    expectations.forEach((expected, idx) => {
      setSidebarOpen.mockClear();
      invokeHook(tours.overview[idx]);
      expect(setSidebarOpen).toHaveBeenCalledWith(expected);
    });
  });

  it("mobile: contextual tours have no hooks", () => {
    const setSidebarOpen = vi.fn();
    const tours = buildTours(fakeT(), { isMobile: true, setSidebarOpen });
    for (const tourId of ["groups", "knockout", "rooms", "simulator"] as const) {
      for (const step of tours[tourId]) {
        expect(step.onHighlightStarted).toBeUndefined();
      }
    }
  });
});
