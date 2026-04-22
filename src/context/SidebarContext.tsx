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
