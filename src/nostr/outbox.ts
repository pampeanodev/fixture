import type { OutboxEntry } from "./types";

const OUTBOX_KEY = "wc2026-nostr-outbox";

export function loadOutbox(): OutboxEntry[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OutboxEntry[];
  } catch {
    return [];
  }
}

export function enqueueEvent(entry: OutboxEntry): void {
  const outbox = loadOutbox();
  outbox.push(entry);
  persistOutbox(outbox);
}

export function clearOutbox(): void {
  localStorage.removeItem(OUTBOX_KEY);
}

function persistOutbox(outbox: OutboxEntry[]): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
  } catch { /* storage full */ }
}
