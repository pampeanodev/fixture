import { SimplePool } from "nostr-tools/pool";
import { finalizeEvent } from "nostr-tools/pure";
import type { Event } from "nostr-tools/core";
import type { Filter } from "nostr-tools/filter";
import { DEFAULT_RELAYS } from "./types";
import type { NostrIdentity } from "./types";
import { loadOutbox, clearOutbox } from "./outbox";

let pool: SimplePool | null = null;

export function getPool(): SimplePool {
  if (!pool) {
    pool = new SimplePool();
  }
  return pool;
}

export function closePool(): void {
  if (pool) {
    pool.close(DEFAULT_RELAYS);
    pool = null;
  }
}

export async function publishEvent(
  template: { kind: number; created_at: number; tags: string[][]; content: string },
  identity: NostrIdentity,
): Promise<void> {
  const signed = finalizeEvent(template, identity.secretKey);
  const p = getPool();
  await Promise.any(p.publish(DEFAULT_RELAYS, signed));
}

export async function flushOutbox(identity: NostrIdentity): Promise<void> {
  const entries = loadOutbox();
  if (entries.length === 0) return;
  const p = getPool();
  for (const entry of entries) {
    const signed = finalizeEvent(entry.eventTemplate, identity.secretKey);
    try {
      await Promise.any(p.publish(DEFAULT_RELAYS, signed));
    } catch {
      // relay unreachable — will retry next flush
      return;
    }
  }
  clearOutbox();
}

export function subscribe(
  filter: Filter,
  handlers: {
    onevent: (event: Event) => void;
    oneose?: () => void;
  },
): { close: () => void } {
  const p = getPool();
  return p.subscribe(DEFAULT_RELAYS, filter, handlers);
}

export async function queryEvents(filter: Filter): Promise<Event[]> {
  const p = getPool();
  return p.querySync(DEFAULT_RELAYS, filter);
}
