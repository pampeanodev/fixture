import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { SUPPORTED_LOCALES, type LocaleCode } from "./types";
import { detectLocale } from "./detect";
import { formatMatchDate, formatNumber, formatTime } from "./format";
import { createT, type TFunction } from "./translate";
import { es } from "./locales/es";
import { en } from "./locales/en";
import { pt } from "./locales/pt";

const BUNDLES = { es, en, pt } as const;
const STORAGE_KEY = "fixture.locale";

function readStoredLocale(): LocaleCode | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && (SUPPORTED_LOCALES as readonly string[]).includes(raw)) {
      return raw as LocaleCode;
    }
  } catch { /* ignore */ }
  return null;
}

interface LocaleContextValue {
  locale: LocaleCode;
  setLocale: (next: LocaleCode) => void;
  t: TFunction;
  formatDate: (utcDate: string) => string;
  formatTime: (utcDate: string) => string;
  formatNumber: (n: number) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(
    () => readStoredLocale() ?? detectLocale(),
  );

  const setLocale = useCallback((next: LocaleCode) => {
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
    setLocaleState(next);
  }, []);

  const value = useMemo<LocaleContextValue>(() => {
    const bundle = BUNDLES[locale];
    const t = createT(bundle, locale);
    return {
      locale, setLocale, t,
      formatDate: (utc) => formatMatchDate(utc, locale),
      formatTime: (utc) => formatTime(utc, locale),
      formatNumber: (n) => formatNumber(n, locale),
    };
  }, [locale, setLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = value.t("meta.title");
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", value.t("meta.description"));
    }
  }, [locale, value]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
