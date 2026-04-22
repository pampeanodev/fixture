import { useEffect, useRef, useCallback, useMemo } from "react";
import { driver } from "driver.js";
import type { Driver } from "driver.js";
import { buildTours } from "./steps";
import type { TourId } from "./steps";
import { useFixture } from "../context/FixtureContext";
import { useLocale } from "../i18n";
import { shouldAutoStart } from "./shouldAutoStart";
import "./driver.css";

const SEEN_KEY = "fixture.tourSeen";

export function useTour() {
  const driverRef = useRef<Driver | null>(null);
  const { state } = useFixture();
  const { t } = useLocale();

  const tours = useMemo(() => buildTours(t), [t]);

  const startTour = useCallback((id: TourId) => {
    driverRef.current?.destroy();
    const d = driver({
      showProgress: true,
      allowClose: true,
      popoverClass: "fixture-tour-popover",
      nextBtnText: t("tour.ui.next"),
      prevBtnText: t("tour.ui.prev"),
      doneBtnText: t("tour.ui.done"),
      progressText: "{{current}} / {{total}}",
      steps: tours[id],
    });
    driverRef.current = d;
    d.drive();
  }, [t, tours]);

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

  useEffect(() => () => { driverRef.current?.destroy(); }, []);

  return { startTour };
}
