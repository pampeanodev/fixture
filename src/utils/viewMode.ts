export type ViewMode = "expanded" | "compact";

const KEY = "viewMode";
const VALID: readonly ViewMode[] = ["expanded", "compact"];

function isViewMode(v: string | null): v is ViewMode {
  return v !== null && (VALID as readonly string[]).includes(v);
}

export function loadViewMode(): ViewMode {
  try {
    const raw = localStorage.getItem(KEY);
    return isViewMode(raw) ? raw : "expanded";
  } catch {
    return "expanded";
  }
}

export function saveViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* ignore quota / disabled storage */
  }
}
