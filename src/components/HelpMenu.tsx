import { useEffect, useRef, useState } from "react";
import { useLocale } from "../i18n";
import { useTour } from "../tour/useTour";
import type { TourId } from "../tour/steps";
import { HelpButton } from "./HelpButton";
import { HowToPlay } from "./HowToPlay";
import "./HelpMenu.css";

interface HelpMenuProps {
  tourId: TourId;
}

export function HelpMenu({ tourId }: HelpMenuProps) {
  const { t } = useLocale();
  const { startTour } = useTour();
  const [menuOpen, setMenuOpen] = useState(false);
  const [howToOpen, setHowToOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function handleTour() {
    setMenuOpen(false);
    startTour(tourId);
  }

  function handleHowTo() {
    setMenuOpen(false);
    setHowToOpen(true);
  }

  return (
    <>
      <div className="help-menu-wrap" ref={wrapRef}>
        {menuOpen && (
          <div className="help-menu-popover" role="menu">
            <button className="help-menu-item" role="menuitem" onClick={handleTour}>
              {t("howToPlay.helpMenu.tour")}
            </button>
            <button className="help-menu-item" role="menuitem" onClick={handleHowTo}>
              {t("howToPlay.helpMenu.howTo")}
            </button>
          </div>
        )}
        <HelpButton onStart={() => setMenuOpen((v) => !v)} />
      </div>
      {howToOpen && <HowToPlay onClose={() => setHowToOpen(false)} />}
    </>
  );
}
