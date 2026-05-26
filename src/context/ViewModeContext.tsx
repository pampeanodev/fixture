import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { loadViewMode, saveViewMode, type ViewMode } from "../utils/viewMode";

interface ViewModeContextValue {
  mode: ViewMode;
  toggle: () => void;
  setMode: (m: ViewMode) => void;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>(() => loadViewMode());

  const setMode = useCallback((next: ViewMode) => {
    saveViewMode(next);
    setModeState(next);
  }, []);

  const toggle = useCallback(() => {
    setModeState((prev) => {
      const next: ViewMode = prev === "compact" ? "expanded" : "compact";
      saveViewMode(next);
      return next;
    });
  }, []);

  const value = useMemo<ViewModeContextValue>(
    () => ({ mode, toggle, setMode }),
    [mode, toggle, setMode],
  );

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

export function useViewMode(): ViewModeContextValue {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error("useViewMode must be used within ViewModeProvider");
  return ctx;
}
