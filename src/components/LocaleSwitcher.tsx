import { useEffect, useRef, useState } from "react";
import { NATIVE_NAMES, SUPPORTED_LOCALES, useLocale } from "../i18n";
import "./LocaleSwitcher.css";

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className={`locale-switcher ${open ? "open" : ""}`} ref={ref}>
      <button
        type="button"
        className="locale-switcher-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Language"
      >
        <span className="locale-switcher-toggle-icon" aria-hidden="true">🌐</span>
        <span className="locale-switcher-toggle-name">{NATIVE_NAMES[locale]}</span>
        <span className="locale-switcher-toggle-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="locale-switcher-menu" role="menu">
          {SUPPORTED_LOCALES.map((code) => {
            const active = code === locale;
            return (
              <button
                key={code}
                type="button"
                role="menuitem"
                className={`locale-switcher-item ${active ? "active" : ""}`}
                onClick={() => {
                  setLocale(code);
                  setOpen(false);
                }}
              >
                <span className="locale-switcher-code">{code.toUpperCase()}</span>
                <span className="locale-switcher-name">{NATIVE_NAMES[code]}</span>
                {active && (
                  <span className="locale-switcher-check" aria-hidden="true">✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
