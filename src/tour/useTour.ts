import { useEffect, useRef, useCallback } from "react";
import { driver } from "driver.js";
import type { Driver } from "driver.js";
import { TOURS } from "./steps";
import type { TourId } from "./steps";
import { useFixture } from "../context/FixtureContext";
import { shouldAutoStart } from "./shouldAutoStart";
import "./driver.css";

const SEEN_KEY = "fixture.tourSeen";

export function useTour() {
  const driverRef = useRef<Driver | null>(null);
  const { state } = useFixture();

  const startTour = useCallback((id: TourId) => {
    driverRef.current?.destroy();
    const d = driver({
      showProgress: true,
      allowClose: true,
      popoverClass: "fixture-tour-popover",
      nextBtnText: "Siguiente",
      prevBtnText: "Atrás",
      doneBtnText: "Listo",
      progressText: "{{current}} / {{total}}",
      steps: TOURS[id],
    });
    driverRef.current = d;
    d.drive();
  }, []);

  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY)) return;
    if (!shouldAutoStart(state)) {
      localStorage.setItem(SEEN_KEY, "skipped");
      return;
    }
    const t = setTimeout(() => {
      startTour("overview");
      localStorage.setItem(SEEN_KEY, "overview");
    }, 500);
    return () => clearTimeout(t);
  }, [state, startTour]);

  useEffect(() => () => { driverRef.current?.destroy(); }, []);

  return { startTour };
}
