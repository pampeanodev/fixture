import type { GroupMatch, KnockoutMatch } from "../types";

const STORAGE_KEY = "wc2026-fixture";

interface PersistedData {
  groupMatches: GroupMatch[];
  knockoutMatches: KnockoutMatch[];
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

export function exportToJson(data: PersistedData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mundial-2026-fixture-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
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
