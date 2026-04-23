import { useEffect, useState } from "react";
import { useLocale } from "../i18n";
import { loadBreakerState, resetBreaker } from "../espn/circuitBreaker";
import "./AutoSyncBanner.css";

const DISMISSED_KEY = "wc2026-autosync-banner-dismissed";

export function AutoSyncBanner() {
  const { t } = useLocale();
  const [tripped, setTripped] = useState<boolean>(() => loadBreakerState().tripped);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    function onStorage(): void {
      setTripped(loadBreakerState().tripped);
    }
    window.addEventListener("storage", onStorage);
    const interval = setInterval(onStorage, 60_000);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(interval);
    };
  }, []);

  if (!tripped || dismissed) return null;

  return (
    <div className="autosync-banner" role="alert">
      <strong>{t("autoSync.breakerTrippedTitle")}</strong>
      <span>{t("autoSync.breakerTrippedMessage")}</span>
      <button
        onClick={() => {
          resetBreaker();
          setTripped(false);
        }}
      >
        {t("autoSync.breakerReenable")}
      </button>
      <button
        aria-label="dismiss"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(DISMISSED_KEY, "true");
          } catch {
            /* ignore */
          }
        }}
      >
        ×
      </button>
    </div>
  );
}
