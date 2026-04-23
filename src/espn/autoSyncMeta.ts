// src/espn/autoSyncMeta.ts

const ENABLED_KEY = "wc2026-autosync-enabled";
const META_KEY = "wc2026-autosync-meta";

export interface AutoSyncMeta {
  lastFetchAt: number | null;
  autoSyncedAt: Record<string, number>; // matchId -> ts of last successful apply
  lastSkipped: Array<{ matchId: string | null; reason: string }>;
  lastApplied: string[]; // match ids applied during the last tick
}

const EMPTY_META: AutoSyncMeta = {
  lastFetchAt: null,
  autoSyncedAt: {},
  lastSkipped: [],
  lastApplied: [],
};

export function loadAutoSyncEnabled(): boolean {
  try {
    const raw = localStorage.getItem(ENABLED_KEY);
    if (raw === null) return true; // default ON per spec
    return raw === "true";
  } catch {
    return true;
  }
}

export function saveAutoSyncEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? "true" : "false");
  } catch {
    /* ignore */
  }
}

export function loadAutoSyncMeta(): AutoSyncMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { ...EMPTY_META, autoSyncedAt: {}, lastSkipped: [], lastApplied: [] };
    const parsed = JSON.parse(raw) as Partial<AutoSyncMeta>;
    return {
      lastFetchAt: typeof parsed.lastFetchAt === "number" ? parsed.lastFetchAt : null,
      autoSyncedAt:
        parsed.autoSyncedAt && typeof parsed.autoSyncedAt === "object"
          ? (parsed.autoSyncedAt as Record<string, number>)
          : {},
      lastSkipped: Array.isArray(parsed.lastSkipped) ? parsed.lastSkipped : [],
      lastApplied: Array.isArray(parsed.lastApplied) ? parsed.lastApplied : [],
    };
  } catch {
    return { ...EMPTY_META, autoSyncedAt: {}, lastSkipped: [], lastApplied: [] };
  }
}

export function saveAutoSyncMeta(meta: AutoSyncMeta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}
