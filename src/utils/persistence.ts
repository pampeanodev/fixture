import type { GroupMatch, KnockoutMatch, Member, Rival } from "../types";

const STORAGE_KEY = "wc2026-fixture";
const PLAYER_NAME_KEY = "wc2026-player-name";
const RIVALS_KEY = "wc2026-rivals";
const MEMBERS_KEY = "wc2026-members";
const SYNCED_RESULTS_KEY = "wc2026-synced-result-ids";

interface PersistedData {
  groupMatches: GroupMatch[];
  knockoutMatches: KnockoutMatch[];
}

export interface ExportedProde {
  playerName: string;
  groupPredictions: Record<string, { home: number; away: number }>;
  knockoutPredictions: Record<string, { home: number; away: number }>;
}

export function saveToLocalStorage(data: PersistedData): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* full or unavailable */ }
}

export function loadFromLocalStorage(): PersistedData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedData;
  } catch { return null; }
}

export function savePlayerName(name: string): void {
  try { localStorage.setItem(PLAYER_NAME_KEY, name); } catch { /* */ }
}

export function loadPlayerName(): string {
  try { return localStorage.getItem(PLAYER_NAME_KEY) ?? ""; } catch { return ""; }
}

export function saveRivals(rivals: Rival[]): void {
  try { localStorage.setItem(RIVALS_KEY, JSON.stringify(rivals)); } catch { /* */ }
}

export function loadRivals(): Rival[] {
  try {
    const raw = localStorage.getItem(RIVALS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Rival[];
  } catch { return []; }
}

export function saveMembers(members: Member[]): void {
  try { localStorage.setItem(MEMBERS_KEY, JSON.stringify(members)); } catch { /* */ }
}

export function loadMembers(): Member[] {
  try {
    const raw = localStorage.getItem(MEMBERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Member[];
  } catch { return []; }
}

export function saveSyncedResultIds(ids: string[]): void {
  try { localStorage.setItem(SYNCED_RESULTS_KEY, JSON.stringify(ids)); } catch { /* */ }
}

export function loadSyncedResultIds(): string[] {
  try {
    const raw = localStorage.getItem(SYNCED_RESULTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch { return []; }
}

export function exportToJson(data: PersistedData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mundial-2026-fixture-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportProde(playerName: string, groupMatches: GroupMatch[], knockoutMatches: KnockoutMatch[]): void {
  const groupPredictions: Record<string, { home: number; away: number }> = {};
  for (const m of groupMatches) {
    if (m.prediction) groupPredictions[m.id] = { home: m.prediction.home, away: m.prediction.away };
  }
  const knockoutPredictions: Record<string, { home: number; away: number }> = {};
  for (const m of knockoutMatches) {
    if (m.prediction) knockoutPredictions[m.id] = { home: m.prediction.home, away: m.prediction.away };
  }

  const prode: ExportedProde = { playerName, groupPredictions, knockoutPredictions };
  const blob = new Blob([JSON.stringify(prode, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `prode-${playerName.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importProde(file: File): Promise<Rival> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as ExportedProde;
        if (!data.playerName || typeof data.playerName !== "string") throw new Error("Missing playerName");
        resolve({
          name: data.playerName,
          groupPredictions: data.groupPredictions ?? {},
          knockoutPredictions: data.knockoutPredictions ?? {},
        });
      } catch (e) { reject(e); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function importFromJson(file: File): Promise<PersistedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as PersistedData;
        if (!Array.isArray(data.groupMatches) || !Array.isArray(data.knockoutMatches)) throw new Error("Invalid format");
        resolve(data);
      } catch (e) { reject(e); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
