# Nostr P2P Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add peer-to-peer prediction sync via Nostr relays with commit-reveal sealed predictions, room-based competition, and cryptographic identity.

**Architecture:** Two React contexts — existing `FixtureProvider` (unchanged) and new `NostrProvider` (identity, rooms, relay sync). Nostr logic lives in `src/nostr/` as pure modules. `useNostrSync` hook bridges both contexts. Commit-reveal protocol ensures prediction integrity.

**Tech Stack:** React 19, TypeScript, Vite, nostr-tools (SimplePool, NIP-06, NIP-19, NIP-33/78), qrcode, vite-plugin-pwa

**Spec:** `docs/superpowers/specs/2026-04-14-nostr-sync-design.md`

---

## File Structure

```
src/
├── nostr/
│   ├── types.ts              — Nostr-specific type definitions
│   ├── identity.ts           — keypair gen/persist/export/restore (NIP-06)
│   ├── commitReveal.ts       — hash, salt, verify logic
│   ├── events.ts             — Nostr event builders (manifest, claim, commit, reveal)
│   ├── rooms.ts              — room CRUD, invite logic, membership persistence
│   ├── relayPool.ts          — SimplePool wrapper, connection status
│   ├── outbox.ts             — offline event queue
│   └── __tests__/
│       ├── identity.test.ts
│       ├── commitReveal.test.ts
│       ├── events.test.ts
│       └── rooms.test.ts
├── context/
│   ├── FixtureContext.tsx     — MODIFY (add activeRoomId to state)
│   └── NostrContext.tsx       — NEW
├── hooks/
│   └── useNostrSync.ts       — bridge NostrContext ↔ FixtureContext
├── components/
│   ├── Onboarding.tsx         — NEW: first-time identity setup
│   ├── Onboarding.css
│   ├── AccountModal.tsx       — NEW: seed phrase + QR backup
│   ├── AccountModal.css
│   ├── QRDisplay.tsx          — NEW: QR code renderer
│   ├── RoomList.tsx           — NEW: "Mis Salas" view
│   ├── RoomList.css
│   ├── RoomDetail.tsx         — NEW: room detail + ranking
│   ├── RoomDetail.css
│   ├── InviteModal.tsx        — NEW: invite link generation
│   ├── InviteModal.css
│   ├── ConnectionStatus.tsx   — NEW: online/offline indicator
│   ├── TopBar.tsx             — MODIFY
│   ├── Sidebar.tsx            — MODIFY
│   └── RankingView.tsx        — MODIFY
├── utils/
│   ├── lockTime.ts            — NEW: match lock time calculations
│   └── __tests__/
│       └── lockTime.test.ts
├── types.ts                   — MODIFY (extend ViewTarget)
└── App.tsx                    — MODIFY (add NostrProvider, URL routing)

public/
└── _redirects                 — NEW: SPA routing for Cloudflare Pages
```

---

### Task 1: Install dependencies and create Nostr types

**Files:**
- Modify: `package.json`
- Create: `src/nostr/types.ts`

- [ ] **Step 1: Install runtime dependencies**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && pnpm add nostr-tools qrcode
```

- [ ] **Step 2: Install dev dependencies**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && pnpm add -D @types/qrcode vite-plugin-pwa
```

- [ ] **Step 3: Create Nostr type definitions**

Create `src/nostr/types.ts`:

```typescript
export interface NostrIdentity {
  secretKey: Uint8Array;
  pubkey: string;          // hex
  mnemonic: string;        // 12-word BIP-39 seed phrase
}

export interface RoomManifest {
  roomId: string;
  mode: "open" | "closed";
  creator: string;         // pubkey hex of creator
  validInvites: string[];  // invite codes (closed rooms only)
}

export interface InviteClaim {
  roomId: string;
  inviteCode: string;
}

export interface CommitmentPayload {
  commitments: Record<string, string>; // matchId -> SHA-256 hash hex
}

export interface RevealEntry {
  home: number;
  away: number;
  salt: string; // hex
}

export interface RevealPayload {
  playerName: string;  // display name of the player
  predictions: Record<string, RevealEntry>; // matchId -> prediction + salt
}

export interface RoomMembership {
  roomId: string;
  name: string;            // user-editable display name for the room
  joinedAt: number;        // unix timestamp
  inviteCode?: string;     // the code used to join (closed rooms)
  role: "creator" | "member";
}

export interface OutboxEntry {
  eventTemplate: {
    kind: number;
    created_at: number;
    tags: string[][];
    content: string;
  };
  createdAt: number;
}

export type ConnectionStatus = "offline" | "connecting" | "connected";

/** Nostr event kind for all fixture app events (NIP-78 arbitrary app data) */
export const NOSTR_KIND = 30078;

export const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band",
];

/** Prefix for all d-tags to namespace our events */
export const TAG_PREFIX = "fixture";
```

- [ ] **Step 4: Verify project builds**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && pnpm build
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/nostr/types.ts
git commit -m "feat: install nostr-tools, qrcode, vite-plugin-pwa and add Nostr types"
```

---

### Task 2: Lock time utility

**Files:**
- Create: `src/utils/lockTime.ts`
- Create: `src/utils/__tests__/lockTime.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/utils/__tests__/lockTime.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { getMatchLockTime, isMatchLocked } from "../lockTime";

describe("getMatchLockTime", () => {
  it("returns 1 hour before the match dateUtc", () => {
    const lockTime = getMatchLockTime("2026-06-11T18:00:00Z");
    expect(lockTime).toBe(new Date("2026-06-11T17:00:00Z").getTime());
  });
});

describe("isMatchLocked", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false when more than 1 hour before match", () => {
    vi.setSystemTime(new Date("2026-06-11T15:00:00Z"));
    expect(isMatchLocked("2026-06-11T18:00:00Z")).toBe(false);
  });

  it("returns true when exactly 1 hour before match", () => {
    vi.setSystemTime(new Date("2026-06-11T17:00:00Z"));
    expect(isMatchLocked("2026-06-11T18:00:00Z")).toBe(true);
  });

  it("returns true when less than 1 hour before match", () => {
    vi.setSystemTime(new Date("2026-06-11T17:30:00Z"));
    expect(isMatchLocked("2026-06-11T18:00:00Z")).toBe(true);
  });

  it("returns true after match has started", () => {
    vi.setSystemTime(new Date("2026-06-11T19:00:00Z"));
    expect(isMatchLocked("2026-06-11T18:00:00Z")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && pnpm vitest run src/utils/__tests__/lockTime.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement lock time utility**

Create `src/utils/lockTime.ts`:

```typescript
const LOCK_OFFSET_MS = 60 * 60 * 1000; // 1 hour

export function getMatchLockTime(dateUtc: string): number {
  return new Date(dateUtc).getTime() - LOCK_OFFSET_MS;
}

export function isMatchLocked(dateUtc: string): boolean {
  return Date.now() >= getMatchLockTime(dateUtc);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && pnpm vitest run src/utils/__tests__/lockTime.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/lockTime.ts src/utils/__tests__/lockTime.test.ts
git commit -m "feat: add lock time utility for match prediction deadlines"
```

---

### Task 3: Identity module

**Files:**
- Create: `src/nostr/identity.ts`
- Create: `src/nostr/__tests__/identity.test.ts`

**Docs to check:** nostr-tools README for NIP-06 and NIP-19 usage.

- [ ] **Step 1: Write failing tests**

Create `src/nostr/__tests__/identity.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  generateIdentity,
  restoreFromMnemonic,
  persistIdentity,
  loadIdentity,
  clearIdentity,
} from "../identity";

beforeEach(() => {
  localStorage.clear();
});

describe("generateIdentity", () => {
  it("creates identity with 12-word mnemonic", () => {
    const id = generateIdentity();
    expect(id.mnemonic.split(" ")).toHaveLength(12);
    expect(id.secretKey).toBeInstanceOf(Uint8Array);
    expect(id.secretKey.length).toBe(32);
    expect(id.pubkey).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique identities each call", () => {
    const a = generateIdentity();
    const b = generateIdentity();
    expect(a.pubkey).not.toBe(b.pubkey);
  });
});

describe("restoreFromMnemonic", () => {
  it("restores the same keypair from the same mnemonic", () => {
    const original = generateIdentity();
    const restored = restoreFromMnemonic(original.mnemonic);
    expect(restored.pubkey).toBe(original.pubkey);
    expect(restored.mnemonic).toBe(original.mnemonic);
  });

  it("throws on invalid mnemonic", () => {
    expect(() => restoreFromMnemonic("invalid words here")).toThrow();
  });
});

describe("persist and load", () => {
  it("round-trips identity through localStorage", () => {
    const original = generateIdentity();
    persistIdentity(original);
    const loaded = loadIdentity();
    expect(loaded).not.toBeNull();
    expect(loaded!.pubkey).toBe(original.pubkey);
    expect(loaded!.mnemonic).toBe(original.mnemonic);
  });

  it("returns null when no identity persisted", () => {
    expect(loadIdentity()).toBeNull();
  });

  it("clears persisted identity", () => {
    persistIdentity(generateIdentity());
    clearIdentity();
    expect(loadIdentity()).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && pnpm vitest run src/nostr/__tests__/identity.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement identity module**

Create `src/nostr/identity.ts`:

```typescript
import { generateSeedWords, privateKeyFromSeedWords } from "nostr-tools/nip06";
import { getPublicKey } from "nostr-tools/pure";
import * as nip19 from "nostr-tools/nip19";
import type { NostrIdentity } from "./types";

const NSEC_KEY = "wc2026-nostr-nsec";
const MNEMONIC_KEY = "wc2026-nostr-mnemonic";

export function generateIdentity(): NostrIdentity {
  const mnemonic = generateSeedWords();
  return deriveIdentity(mnemonic);
}

export function restoreFromMnemonic(mnemonic: string): NostrIdentity {
  // privateKeyFromSeedWords throws on invalid mnemonic
  return deriveIdentity(mnemonic);
}

function deriveIdentity(mnemonic: string): NostrIdentity {
  const secretKey = privateKeyFromSeedWords(mnemonic);
  const pubkey = getPublicKey(secretKey);
  return { secretKey, pubkey, mnemonic };
}

export function persistIdentity(identity: NostrIdentity): void {
  try {
    localStorage.setItem(NSEC_KEY, nip19.nsecEncode(identity.secretKey));
    localStorage.setItem(MNEMONIC_KEY, identity.mnemonic);
  } catch { /* storage full or unavailable */ }
}

export function loadIdentity(): NostrIdentity | null {
  try {
    const nsec = localStorage.getItem(NSEC_KEY);
    const mnemonic = localStorage.getItem(MNEMONIC_KEY);
    if (!nsec || !mnemonic) return null;
    const { type, data } = nip19.decode(nsec);
    if (type !== "nsec") return null;
    const secretKey = data;
    const pubkey = getPublicKey(secretKey);
    return { secretKey, pubkey, mnemonic };
  } catch {
    return null;
  }
}

export function clearIdentity(): void {
  localStorage.removeItem(NSEC_KEY);
  localStorage.removeItem(MNEMONIC_KEY);
}

export function encodeNsec(identity: NostrIdentity): string {
  return nip19.nsecEncode(identity.secretKey);
}

export function encodeNpub(identity: NostrIdentity): string {
  return nip19.npubEncode(identity.pubkey);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && pnpm vitest run src/nostr/__tests__/identity.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/nostr/identity.ts src/nostr/__tests__/identity.test.ts
git commit -m "feat: add Nostr identity module with NIP-06 seed phrase support"
```

---

### Task 4: Commit-reveal module

**Files:**
- Create: `src/nostr/commitReveal.ts`
- Create: `src/nostr/__tests__/commitReveal.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/nostr/__tests__/commitReveal.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  generateSalt,
  computeCommitment,
  verifyReveal,
  persistSalts,
  loadSalts,
} from "../commitReveal";

describe("generateSalt", () => {
  it("returns a 32-char hex string (16 bytes)", () => {
    const salt = generateSalt();
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
  });

  it("generates unique salts", () => {
    const a = generateSalt();
    const b = generateSalt();
    expect(a).not.toBe(b);
  });
});

describe("computeCommitment", () => {
  it("returns a 64-char hex SHA-256 hash", () => {
    const hash = computeCommitment("G-A-1", 2, 1, "abcdef1234567890abcdef1234567890");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different hashes for different scores", () => {
    const salt = "abcdef1234567890abcdef1234567890";
    const a = computeCommitment("G-A-1", 2, 1, salt);
    const b = computeCommitment("G-A-1", 1, 0, salt);
    expect(a).not.toBe(b);
  });

  it("produces different hashes for different salts", () => {
    const a = computeCommitment("G-A-1", 2, 1, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1");
    const b = computeCommitment("G-A-1", 2, 1, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2");
    expect(a).not.toBe(b);
  });

  it("produces different hashes for different matchIds", () => {
    const salt = "abcdef1234567890abcdef1234567890";
    const a = computeCommitment("G-A-1", 2, 1, salt);
    const b = computeCommitment("G-A-2", 2, 1, salt);
    expect(a).not.toBe(b);
  });
});

describe("verifyReveal", () => {
  it("returns true when reveal matches commitment", () => {
    const salt = "abcdef1234567890abcdef1234567890";
    const commitment = computeCommitment("G-A-1", 2, 1, salt);
    expect(verifyReveal("G-A-1", 2, 1, salt, commitment)).toBe(true);
  });

  it("returns false when score was tampered", () => {
    const salt = "abcdef1234567890abcdef1234567890";
    const commitment = computeCommitment("G-A-1", 2, 1, salt);
    expect(verifyReveal("G-A-1", 3, 1, salt, commitment)).toBe(false);
  });

  it("returns false when salt was tampered", () => {
    const salt = "abcdef1234567890abcdef1234567890";
    const commitment = computeCommitment("G-A-1", 2, 1, salt);
    expect(verifyReveal("G-A-1", 2, 1, "00000000000000000000000000000000", commitment)).toBe(false);
  });
});

describe("salt persistence", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips salts through localStorage", () => {
    const salts: Record<string, string> = { "G-A-1": "aabb", "G-A-2": "ccdd" };
    persistSalts("room1", salts);
    expect(loadSalts("room1")).toEqual(salts);
  });

  it("returns empty object for unknown room", () => {
    expect(loadSalts("unknown")).toEqual({});
  });

  it("keeps salts separate per room", () => {
    persistSalts("room1", { "G-A-1": "aabb" });
    persistSalts("room2", { "G-A-1": "ccdd" });
    expect(loadSalts("room1")["G-A-1"]).toBe("aabb");
    expect(loadSalts("room2")["G-A-1"]).toBe("ccdd");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && pnpm vitest run src/nostr/__tests__/commitReveal.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement commit-reveal module**

Create `src/nostr/commitReveal.ts`:

```typescript
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

export function generateSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return bytesToHex(bytes);
}

export function computeCommitment(
  matchId: string,
  home: number,
  away: number,
  salt: string,
): string {
  const input = `${matchId}:${home}-${away}:${salt}`;
  return bytesToHex(sha256(new TextEncoder().encode(input)));
}

export function verifyReveal(
  matchId: string,
  home: number,
  away: number,
  salt: string,
  commitment: string,
): boolean {
  return computeCommitment(matchId, home, away, salt) === commitment;
}

const SALTS_PREFIX = "wc2026-salts-";

export function persistSalts(roomId: string, salts: Record<string, string>): void {
  try {
    localStorage.setItem(SALTS_PREFIX + roomId, JSON.stringify(salts));
  } catch { /* storage full */ }
}

export function loadSalts(roomId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(SALTS_PREFIX + roomId);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && pnpm vitest run src/nostr/__tests__/commitReveal.test.ts
```

Expected: All 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/nostr/commitReveal.ts src/nostr/__tests__/commitReveal.test.ts
git commit -m "feat: add commit-reveal module for sealed predictions"
```

---

### Task 5: Room management module

**Files:**
- Create: `src/nostr/rooms.ts`
- Create: `src/nostr/__tests__/rooms.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/nostr/__tests__/rooms.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  createRoom,
  generateInviteCode,
  persistRooms,
  loadRooms,
  addRoom,
  removeRoom,
  isValidMember,
} from "../rooms";
import type { RoomManifest, RoomMembership } from "../types";

beforeEach(() => localStorage.clear());

describe("createRoom", () => {
  it("returns an 8-char alphanumeric room ID", () => {
    const roomId = createRoom();
    expect(roomId).toMatch(/^[a-z0-9]{8}$/);
  });

  it("generates unique IDs", () => {
    const a = createRoom();
    const b = createRoom();
    expect(a).not.toBe(b);
  });
});

describe("generateInviteCode", () => {
  it("returns a 4-char alphanumeric code", () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[a-z0-9]{4}$/);
  });
});

describe("room persistence", () => {
  it("round-trips rooms through localStorage", () => {
    const rooms: RoomMembership[] = [
      { roomId: "abc12345", name: "Asado", joinedAt: 1000, role: "creator" },
    ];
    persistRooms(rooms);
    expect(loadRooms()).toEqual(rooms);
  });

  it("returns empty array when nothing persisted", () => {
    expect(loadRooms()).toEqual([]);
  });
});

describe("addRoom", () => {
  it("adds a new room to the list", () => {
    const rooms: RoomMembership[] = [];
    const updated = addRoom(rooms, {
      roomId: "abc12345", name: "Asado", joinedAt: 1000, role: "creator",
    });
    expect(updated).toHaveLength(1);
    expect(updated[0].roomId).toBe("abc12345");
  });

  it("does not duplicate if room already exists", () => {
    const rooms: RoomMembership[] = [
      { roomId: "abc12345", name: "Asado", joinedAt: 1000, role: "creator" },
    ];
    const updated = addRoom(rooms, {
      roomId: "abc12345", name: "Asado v2", joinedAt: 2000, role: "member",
    });
    expect(updated).toHaveLength(1);
    expect(updated[0].name).toBe("Asado v2");
  });
});

describe("removeRoom", () => {
  it("removes a room by ID", () => {
    const rooms: RoomMembership[] = [
      { roomId: "abc12345", name: "Asado", joinedAt: 1000, role: "creator" },
      { roomId: "def67890", name: "Oficina", joinedAt: 2000, role: "member" },
    ];
    expect(removeRoom(rooms, "abc12345")).toHaveLength(1);
    expect(removeRoom(rooms, "abc12345")[0].roomId).toBe("def67890");
  });
});

describe("isValidMember", () => {
  const openManifest: RoomManifest = {
    roomId: "abc12345", mode: "open", creator: "pubkey1", validInvites: [],
  };
  const closedManifest: RoomManifest = {
    roomId: "abc12345", mode: "closed", creator: "pubkey1", validInvites: ["t8f2", "n3k9"],
  };

  it("always allows members in open rooms", () => {
    expect(isValidMember(openManifest, "anyone", undefined, [])).toBe(true);
  });

  it("allows creator in closed rooms without invite", () => {
    expect(isValidMember(closedManifest, "pubkey1", undefined, [])).toBe(true);
  });

  it("allows members with a valid claimed invite in closed rooms", () => {
    const claims = [{ pubkey: "pubkey2", inviteCode: "t8f2", claimedAt: 1000 }];
    expect(isValidMember(closedManifest, "pubkey2", "t8f2", claims)).toBe(true);
  });

  it("rejects members without a valid invite in closed rooms", () => {
    expect(isValidMember(closedManifest, "pubkey2", undefined, [])).toBe(false);
  });

  it("rejects if invite code was claimed by someone else", () => {
    const claims = [{ pubkey: "pubkey3", inviteCode: "t8f2", claimedAt: 1000 }];
    expect(isValidMember(closedManifest, "pubkey2", "t8f2", claims)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && pnpm vitest run src/nostr/__tests__/rooms.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement rooms module**

Create `src/nostr/rooms.ts`:

```typescript
import type { RoomManifest, RoomMembership } from "./types";

const ROOMS_KEY = "wc2026-rooms";

export function createRoom(): string {
  return randomAlphanumeric(8);
}

export function generateInviteCode(): string {
  return randomAlphanumeric(4);
}

function randomAlphanumeric(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function persistRooms(rooms: RoomMembership[]): void {
  try {
    localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
  } catch { /* storage full */ }
}

export function loadRooms(): RoomMembership[] {
  try {
    const raw = localStorage.getItem(ROOMS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RoomMembership[];
  } catch {
    return [];
  }
}

export function addRoom(
  rooms: RoomMembership[],
  room: RoomMembership,
): RoomMembership[] {
  return [...rooms.filter((r) => r.roomId !== room.roomId), room];
}

export function removeRoom(
  rooms: RoomMembership[],
  roomId: string,
): RoomMembership[] {
  return rooms.filter((r) => r.roomId !== roomId);
}

interface ClaimRecord {
  pubkey: string;
  inviteCode: string;
  claimedAt: number;
}

export function isValidMember(
  manifest: RoomManifest,
  pubkey: string,
  inviteCode: string | undefined,
  claims: ClaimRecord[],
): boolean {
  if (manifest.mode === "open") return true;
  if (pubkey === manifest.creator) return true;
  if (!inviteCode) return false;
  if (!manifest.validInvites.includes(inviteCode)) return false;
  const claim = claims.find((c) => c.inviteCode === inviteCode);
  return claim !== undefined && claim.pubkey === pubkey;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && pnpm vitest run src/nostr/__tests__/rooms.test.ts
```

Expected: All 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/nostr/rooms.ts src/nostr/__tests__/rooms.test.ts
git commit -m "feat: add room management with open/closed modes and invite codes"
```

---

### Task 6: Nostr event builders

**Files:**
- Create: `src/nostr/events.ts`
- Create: `src/nostr/__tests__/events.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/nostr/__tests__/events.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  buildManifestEvent,
  buildClaimEvent,
  buildCommitmentEvent,
  buildRevealEvent,
  parseEventContent,
  getDTag,
} from "../events";
import { NOSTR_KIND, TAG_PREFIX } from "../types";
import type { RoomManifest, CommitmentPayload, RevealPayload } from "../types";

describe("getDTag", () => {
  it("builds correct d-tag for manifest", () => {
    expect(getDTag("abc123", "manifest")).toBe(`${TAG_PREFIX}:abc123:manifest`);
  });
});

describe("buildManifestEvent", () => {
  it("creates a valid event template with correct tags and content", () => {
    const manifest: RoomManifest = {
      roomId: "abc123", mode: "closed", creator: "pk1", validInvites: ["t8f2"],
    };
    const event = buildManifestEvent(manifest);
    expect(event.kind).toBe(NOSTR_KIND);
    expect(event.tags).toContainEqual(["d", `${TAG_PREFIX}:abc123:manifest`]);
    const content = JSON.parse(event.content) as RoomManifest;
    expect(content.mode).toBe("closed");
    expect(content.validInvites).toEqual(["t8f2"]);
  });
});

describe("buildClaimEvent", () => {
  it("creates event with room ID and invite code", () => {
    const event = buildClaimEvent("abc123", "t8f2");
    expect(event.tags).toContainEqual(["d", `${TAG_PREFIX}:abc123:claim`]);
    const content = JSON.parse(event.content);
    expect(content.inviteCode).toBe("t8f2");
  });
});

describe("buildCommitmentEvent", () => {
  it("creates event with commitment hashes", () => {
    const commitments: Record<string, string> = { "G-A-1": "hash1", "G-A-2": "hash2" };
    const event = buildCommitmentEvent("abc123", commitments);
    expect(event.tags).toContainEqual(["d", `${TAG_PREFIX}:abc123:commit`]);
    const content = JSON.parse(event.content) as CommitmentPayload;
    expect(content.commitments["G-A-1"]).toBe("hash1");
  });
});

describe("buildRevealEvent", () => {
  it("creates event with revealed predictions and player name", () => {
    const predictions = {
      "G-A-1": { home: 2, away: 1, salt: "aabb" },
    };
    const event = buildRevealEvent("abc123", "Agus", predictions);
    expect(event.tags).toContainEqual(["d", `${TAG_PREFIX}:abc123:reveal`]);
    const content = JSON.parse(event.content) as RevealPayload;
    expect(content.playerName).toBe("Agus");
    expect(content.predictions["G-A-1"].home).toBe(2);
    expect(content.predictions["G-A-1"].salt).toBe("aabb");
  });
});

describe("parseEventContent", () => {
  it("parses valid JSON content", () => {
    const result = parseEventContent<CommitmentPayload>('{"commitments":{"a":"b"}}');
    expect(result).not.toBeNull();
    expect(result!.commitments.a).toBe("b");
  });

  it("returns null for invalid JSON", () => {
    expect(parseEventContent("not json")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && pnpm vitest run src/nostr/__tests__/events.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement events module**

Create `src/nostr/events.ts`:

```typescript
import { NOSTR_KIND, TAG_PREFIX } from "./types";
import type {
  RoomManifest,
  InviteClaim,
  CommitmentPayload,
  RevealPayload,
  RevealEntry,
} from "./types";

interface UnsignedEventTemplate {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
}

export function getDTag(roomId: string, suffix: string): string {
  return `${TAG_PREFIX}:${roomId}:${suffix}`;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

export function buildManifestEvent(manifest: RoomManifest): UnsignedEventTemplate {
  return {
    kind: NOSTR_KIND,
    created_at: now(),
    tags: [["d", getDTag(manifest.roomId, "manifest")]],
    content: JSON.stringify(manifest),
  };
}

export function buildClaimEvent(roomId: string, inviteCode: string): UnsignedEventTemplate {
  const claim: InviteClaim = { roomId, inviteCode };
  return {
    kind: NOSTR_KIND,
    created_at: now(),
    tags: [["d", getDTag(roomId, "claim")]],
    content: JSON.stringify(claim),
  };
}

export function buildCommitmentEvent(
  roomId: string,
  commitments: Record<string, string>,
): UnsignedEventTemplate {
  const payload: CommitmentPayload = { commitments };
  return {
    kind: NOSTR_KIND,
    created_at: now(),
    tags: [["d", getDTag(roomId, "commit")]],
    content: JSON.stringify(payload),
  };
}

export function buildRevealEvent(
  roomId: string,
  playerName: string,
  predictions: Record<string, RevealEntry>,
): UnsignedEventTemplate {
  const payload: RevealPayload = { playerName, predictions };
  return {
    kind: NOSTR_KIND,
    created_at: now(),
    tags: [["d", getDTag(roomId, "reveal")]],
    content: JSON.stringify(payload),
  };
}

export function parseEventContent<T>(content: string): T | null {
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && pnpm vitest run src/nostr/__tests__/events.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/nostr/events.ts src/nostr/__tests__/events.test.ts
git commit -m "feat: add Nostr event builders for manifest, claim, commit, reveal"
```

---

### Task 7: Relay pool wrapper and outbox

**Files:**
- Create: `src/nostr/relayPool.ts`
- Create: `src/nostr/outbox.ts`

- [ ] **Step 1: Implement outbox module**

Create `src/nostr/outbox.ts`:

```typescript
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
```

- [ ] **Step 2: Implement relay pool wrapper**

Create `src/nostr/relayPool.ts`:

```typescript
import { SimplePool } from "nostr-tools/pool";
import { finalizeEvent } from "nostr-tools/pure";
import type { Filter, Event } from "nostr-tools/core";
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
  filters: Filter[],
  handlers: {
    onevent: (event: Event) => void;
    oneose?: () => void;
  },
): { close: () => void } {
  const p = getPool();
  return p.subscribe(DEFAULT_RELAYS, filters, handlers);
}

export async function queryEvents(filters: Filter[]): Promise<Event[]> {
  const p = getPool();
  return p.querySync(DEFAULT_RELAYS, filters);
}
```

- [ ] **Step 3: Verify project builds**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && pnpm build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/nostr/relayPool.ts src/nostr/outbox.ts
git commit -m "feat: add relay pool wrapper and offline outbox queue"
```

---

### Task 8: NostrContext provider

**Files:**
- Create: `src/context/NostrContext.tsx`
- Modify: `src/types.ts` (extend ViewTarget)
- Modify: `src/App.tsx` (wrap with NostrProvider)

- [ ] **Step 1: Extend ViewTarget in types.ts**

In `src/types.ts`, add `"rooms"` to ViewTarget:

```typescript
export type ViewTarget =
  | { type: "groups"; group: string }
  | { type: "knockout"; round: KnockoutRound }
  | { type: "schedule" }
  | { type: "ranking" }
  | { type: "rooms" }
  | { type: "room"; roomId: string };
```

- [ ] **Step 2: Create NostrContext**

Create `src/context/NostrContext.tsx`:

```typescript
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import type {
  NostrIdentity,
  RoomMembership,
  RoomManifest,
  ConnectionStatus,
} from "../nostr/types";
import { DEFAULT_RELAYS } from "../nostr/types";
import {
  generateIdentity,
  restoreFromMnemonic,
  persistIdentity,
  loadIdentity,
  clearIdentity,
  encodeNsec,
} from "../nostr/identity";
import {
  createRoom as createRoomId,
  generateInviteCode,
  persistRooms,
  loadRooms,
  addRoom,
  removeRoom,
} from "../nostr/rooms";
import { buildManifestEvent, buildClaimEvent } from "../nostr/events";
import { publishEvent, flushOutbox, closePool } from "../nostr/relayPool";
import { enqueueEvent } from "../nostr/outbox";

interface NostrContextValue {
  identity: NostrIdentity | null;
  rooms: RoomMembership[];
  activeRoomId: string | null;
  connectionStatus: ConnectionStatus;
  setupIdentity: (name?: string) => NostrIdentity;
  restoreIdentityFromMnemonic: (mnemonic: string) => void;
  exportIdentity: () => { mnemonic: string; nsec: string } | null;
  clearUserIdentity: () => void;
  createRoom: (name: string, mode: "open" | "closed") => string;
  joinRoom: (roomId: string, inviteCode?: string) => void;
  leaveRoom: (roomId: string) => void;
  createInvite: (roomId: string) => string;
  setActiveRoom: (roomId: string | null) => void;
}

const NostrContext = createContext<NostrContextValue | null>(null);

export function NostrProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<NostrIdentity | null>(() => loadIdentity());
  const [rooms, setRooms] = useState<RoomMembership[]>(() => loadRooms());
  const [activeRoomId, setActiveRoom] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("offline");
  const manifestsRef = useRef<Map<string, RoomManifest>>(new Map());

  // Persist rooms on change
  useEffect(() => {
    persistRooms(rooms);
  }, [rooms]);

  // Manage connection status based on rooms
  useEffect(() => {
    if (rooms.length === 0 || !identity) {
      setConnectionStatus("offline");
      closePool();
      return;
    }
    setConnectionStatus("connecting");
    // Flush any queued events
    flushOutbox(identity).then(() => {
      setConnectionStatus("connected");
    }).catch(() => {
      setConnectionStatus("offline");
    });
  }, [rooms.length, identity]);

  const setupIdentity = useCallback((name?: string) => {
    const id = generateIdentity();
    persistIdentity(id);
    setIdentity(id);
    return id;
  }, []);

  const restoreIdentityFromMnemonic = useCallback((mnemonic: string) => {
    const id = restoreFromMnemonic(mnemonic);
    persistIdentity(id);
    setIdentity(id);
  }, []);

  const exportIdentity = useCallback(() => {
    if (!identity) return null;
    return { mnemonic: identity.mnemonic, nsec: encodeNsec(identity) };
  }, [identity]);

  const clearUserIdentity = useCallback(() => {
    clearIdentity();
    setIdentity(null);
  }, []);

  const createRoom = useCallback((name: string, mode: "open" | "closed") => {
    if (!identity) throw new Error("No identity");
    const roomId = createRoomId();
    const membership: RoomMembership = {
      roomId,
      name,
      joinedAt: Date.now(),
      role: "creator",
    };
    setRooms((prev) => addRoom(prev, membership));

    const manifest: RoomManifest = {
      roomId,
      mode,
      creator: identity.pubkey,
      validInvites: [],
    };
    manifestsRef.current.set(roomId, manifest);

    const event = buildManifestEvent(manifest);
    publishEvent(event, identity).catch(() => {
      enqueueEvent({ eventTemplate: event, createdAt: Date.now() });
    });

    return roomId;
  }, [identity]);

  const joinRoom = useCallback((roomId: string, inviteCode?: string) => {
    if (!identity) throw new Error("No identity");
    const membership: RoomMembership = {
      roomId,
      name: roomId,
      joinedAt: Date.now(),
      inviteCode,
      role: "member",
    };
    setRooms((prev) => addRoom(prev, membership));

    if (inviteCode) {
      const event = buildClaimEvent(roomId, inviteCode);
      publishEvent(event, identity).catch(() => {
        enqueueEvent({ eventTemplate: event, createdAt: Date.now() });
      });
    }
  }, [identity]);

  const leaveRoom = useCallback((roomId: string) => {
    setRooms((prev) => removeRoom(prev, roomId));
    if (activeRoomId === roomId) setActiveRoom(null);
  }, [activeRoomId]);

  const createInvite = useCallback((roomId: string) => {
    if (!identity) throw new Error("No identity");
    const code = generateInviteCode();
    const manifest = manifestsRef.current.get(roomId);
    if (manifest && manifest.creator === identity.pubkey) {
      manifest.validInvites = [...manifest.validInvites, code];
      const event = buildManifestEvent(manifest);
      publishEvent(event, identity).catch(() => {
        enqueueEvent({ eventTemplate: event, createdAt: Date.now() });
      });
    }
    return code;
  }, [identity]);

  const value: NostrContextValue = {
    identity,
    rooms,
    activeRoomId,
    connectionStatus,
    setupIdentity,
    restoreIdentityFromMnemonic,
    exportIdentity,
    clearUserIdentity,
    createRoom,
    joinRoom,
    leaveRoom,
    createInvite,
    setActiveRoom,
  };

  return <NostrContext.Provider value={value}>{children}</NostrContext.Provider>;
}

export function useNostr(): NostrContextValue {
  const ctx = useContext(NostrContext);
  if (!ctx) throw new Error("useNostr must be used within NostrProvider");
  return ctx;
}
```

- [ ] **Step 3: Wrap App with NostrProvider**

In `src/App.tsx`, import and wrap:

```typescript
import { NostrProvider } from "./context/NostrContext";
```

Wrap the existing `FixtureProvider` inside `NostrProvider`:

```tsx
<NostrProvider>
  <FixtureProvider>
    {/* existing app content */}
  </FixtureProvider>
</NostrProvider>
```

- [ ] **Step 4: Verify project builds**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && pnpm build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/context/NostrContext.tsx src/types.ts src/App.tsx
git commit -m "feat: add NostrContext provider with identity, rooms, and relay management"
```

---

### Task 9: useNostrSync hook

**Files:**
- Create: `src/hooks/useNostrSync.ts`

This hook bridges NostrContext and FixtureContext. It subscribes to Nostr events for the active room and dispatches `ADD_RIVAL` / `REMOVE_RIVAL`. It also publishes commitments and reveals when local predictions change.

- [ ] **Step 1: Create useNostrSync hook**

Create `src/hooks/useNostrSync.ts`:

```typescript
import { useEffect, useRef, useCallback } from "react";
import { useNostr } from "../context/NostrContext";
import { useFixture } from "../context/FixtureContext";
import { subscribe, queryEvents } from "../nostr/relayPool";
import { getDTag, parseEventContent, buildCommitmentEvent, buildRevealEvent } from "../nostr/events";
import { publishEvent } from "../nostr/relayPool";
import { enqueueEvent } from "../nostr/outbox";
import { computeCommitment, generateSalt, verifyReveal, loadSalts, persistSalts } from "../nostr/commitReveal";
import { NOSTR_KIND } from "../nostr/types";
import type { CommitmentPayload, RevealPayload, RevealEntry } from "../nostr/types";
import type { Score, Rival } from "../types";
import { isMatchLocked } from "../utils/lockTime";
import type { Event } from "nostr-tools/core";

export function useNostrSync(): void {
  const { identity, activeRoomId, connectionStatus } = useNostr();
  const { state, dispatch } = useFixture();
  const subRef = useRef<{ close: () => void } | null>(null);
  const commitmentsCache = useRef<Map<string, Record<string, string>>>(new Map());

  // Track which rivals were added by Nostr sync so we can clean up on room switch
  const nostrRivalsRef = useRef<Set<string>>(new Set());

  // Subscribe to room events
  useEffect(() => {
    if (!activeRoomId || !identity || connectionStatus !== "connected") return;

    subRef.current?.close();
    // Clear rivals from previous room
    for (const name of nostrRivalsRef.current) {
      dispatch({ type: "REMOVE_RIVAL", name });
    }
    nostrRivalsRef.current.clear();

    const commitDTag = getDTag(activeRoomId, "commit");
    const revealDTag = getDTag(activeRoomId, "reveal");

    subRef.current = subscribe(
      [{ kinds: [NOSTR_KIND], "#d": [commitDTag, revealDTag] }],
      {
        onevent(event: Event) {
          if (event.pubkey === identity.pubkey) return; // skip own events

          const dTag = event.tags.find((t) => t[0] === "d")?.[1];
          if (!dTag) return;

          if (dTag === commitDTag) {
            const payload = parseEventContent<CommitmentPayload>(event.content);
            if (payload) {
              commitmentsCache.current.set(event.pubkey, payload.commitments);
            }
          }

          if (dTag === revealDTag) {
            const payload = parseEventContent<RevealPayload>(event.content);
            if (!payload) return;
            const peerCommitments = commitmentsCache.current.get(event.pubkey);
            processReveal(event.pubkey, payload, peerCommitments);
          }
        },
      },
    );

    // Also query existing events
    queryEvents([
      { kinds: [NOSTR_KIND], "#d": [commitDTag] },
    ]).then((events) => {
      for (const event of events) {
        if (event.pubkey === identity.pubkey) continue;
        const payload = parseEventContent<CommitmentPayload>(event.content);
        if (payload) {
          commitmentsCache.current.set(event.pubkey, payload.commitments);
        }
      }
    });

    queryEvents([
      { kinds: [NOSTR_KIND], "#d": [revealDTag] },
    ]).then((events) => {
      for (const event of events) {
        if (event.pubkey === identity.pubkey) continue;
        const payload = parseEventContent<RevealPayload>(event.content);
        if (!payload) continue;
        const peerCommitments = commitmentsCache.current.get(event.pubkey);
        processReveal(event.pubkey, payload, peerCommitments);
      }
    });

    return () => {
      subRef.current?.close();
      subRef.current = null;
    };
  }, [activeRoomId, identity, connectionStatus]);

  function processReveal(
    peerPubkey: string,
    payload: RevealPayload,
    peerCommitments: Record<string, string> | undefined,
  ): void {
    const groupPredictions: Record<string, Score> = {};
    const knockoutPredictions: Record<string, Score> = {};

    for (const [matchId, entry] of Object.entries(payload.predictions)) {
      // Verify against commitment if available
      if (peerCommitments) {
        const commitment = peerCommitments[matchId];
        if (commitment && !verifyReveal(matchId, entry.home, entry.away, entry.salt, commitment)) {
          continue; // tampered prediction, skip
        }
      }

      const score: Score = { home: entry.home, away: entry.away };
      if (matchId.startsWith("G-")) {
        groupPredictions[matchId] = score;
      } else {
        knockoutPredictions[matchId] = score;
      }
    }

    // Use playerName from reveal, fall back to pubkey prefix
    const rivalName = payload.playerName || peerPubkey.slice(0, 8);
    const rival: Rival = {
      name: rivalName,
      groupPredictions,
      knockoutPredictions,
    };
    nostrRivalsRef.current.add(rivalName);
    dispatch({ type: "ADD_RIVAL", rival });
  }

  // Publish commitments when predictions change
  const publishCommitments = useCallback(() => {
    if (!identity || !activeRoomId || connectionStatus !== "connected") return;

    const salts = loadSalts(activeRoomId);
    const commitments: Record<string, string> = {};

    for (const match of state.groupMatches) {
      if (!match.prediction || isMatchLocked(match.dateUtc)) continue;
      if (!salts[match.id]) salts[match.id] = generateSalt();
      commitments[match.id] = computeCommitment(
        match.id, match.prediction.home, match.prediction.away, salts[match.id],
      );
    }
    for (const match of state.knockoutMatches) {
      if (!match.prediction || isMatchLocked(match.dateUtc)) continue;
      if (!salts[match.id]) salts[match.id] = generateSalt();
      commitments[match.id] = computeCommitment(
        match.id, match.prediction.home, match.prediction.away, salts[match.id],
      );
    }

    persistSalts(activeRoomId, salts);

    if (Object.keys(commitments).length === 0) return;

    const event = buildCommitmentEvent(activeRoomId, commitments);
    publishEvent(event, identity).catch(() => {
      enqueueEvent({ eventTemplate: event, createdAt: Date.now() });
    });
  }, [identity, activeRoomId, connectionStatus, state.groupMatches, state.knockoutMatches]);

  // Publish reveals for locked matches
  const publishReveals = useCallback(() => {
    if (!identity || !activeRoomId || connectionStatus !== "connected") return;

    const salts = loadSalts(activeRoomId);
    const predictions: Record<string, RevealEntry> = {};

    for (const match of state.groupMatches) {
      if (!match.prediction || !isMatchLocked(match.dateUtc)) continue;
      const salt = salts[match.id];
      if (!salt) continue;
      predictions[match.id] = {
        home: match.prediction.home,
        away: match.prediction.away,
        salt,
      };
    }
    for (const match of state.knockoutMatches) {
      if (!match.prediction || !isMatchLocked(match.dateUtc)) continue;
      const salt = salts[match.id];
      if (!salt) continue;
      predictions[match.id] = {
        home: match.prediction.home,
        away: match.prediction.away,
        salt,
      };
    }

    if (Object.keys(predictions).length === 0) return;

    const event = buildRevealEvent(activeRoomId, state.playerName, predictions);
    publishEvent(event, identity).catch(() => {
      enqueueEvent({ eventTemplate: event, createdAt: Date.now() });
    });
  }, [identity, activeRoomId, connectionStatus, state.groupMatches, state.knockoutMatches]);

  // Debounce commitment publishing on prediction changes
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!activeRoomId || !identity) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      publishCommitments();
      publishReveals();
    }, 2000);
    return () => clearTimeout(timerRef.current);
  }, [state.groupMatches, state.knockoutMatches, publishCommitments, publishReveals]);
}
```

- [ ] **Step 2: Wire useNostrSync into App**

In `src/App.tsx`, inside the component (after both providers are available), add a child component that calls the hook:

```typescript
import { useNostrSync } from "./hooks/useNostrSync";

function NostrSyncBridge() {
  useNostrSync();
  return null;
}
```

Place `<NostrSyncBridge />` inside both providers:

```tsx
<NostrProvider>
  <FixtureProvider>
    <NostrSyncBridge />
    {/* existing app content */}
  </FixtureProvider>
</NostrProvider>
```

- [ ] **Step 3: Verify project builds**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && pnpm build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useNostrSync.ts src/App.tsx
git commit -m "feat: add useNostrSync hook bridging Nostr events to fixture context"
```

---

### Task 10: URL invite routing

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add URL parsing on mount**

In `src/App.tsx`, add a `useEffect` that runs once on mount to parse invite URLs:

```typescript
import { useEffect } from "react";
import { useNostr } from "./context/NostrContext";
import { useFixture } from "./context/FixtureContext";

function InviteRouter() {
  const { joinRoom, setActiveRoom, identity } = useNostr();
  const { dispatch } = useFixture();

  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/r\/([a-z0-9]{8})$/);
    if (!match) return;

    const roomId = match[1];
    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get("i") ?? undefined;

    if (identity) {
      joinRoom(roomId, inviteCode);
      setActiveRoom(roomId);
      dispatch({ type: "SET_VIEW", view: { type: "room", roomId } });
    }

    // Clean URL without reload
    window.history.replaceState(null, "", "/");
  }, [identity]);

  return null;
}
```

Add `<InviteRouter />` inside both providers in `App.tsx`.

- [ ] **Step 2: Verify project builds**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add URL routing for room invite links"
```

---

### Task 11: Onboarding and Account modal

**Files:**
- Create: `src/components/Onboarding.tsx`
- Create: `src/components/Onboarding.css`
- Create: `src/components/AccountModal.tsx`
- Create: `src/components/AccountModal.css`
- Create: `src/components/QRDisplay.tsx`

- [ ] **Step 1: Create QRDisplay component**

Create `src/components/QRDisplay.tsx`:

```typescript
import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface QRDisplayProps {
  value: string;
  size?: number;
}

export function QRDisplay({ value, size = 200 }: QRDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });
  }, [value, size]);

  return <canvas ref={canvasRef} />;
}
```

- [ ] **Step 2: Create Onboarding screen**

Create `src/components/Onboarding.tsx`:

```typescript
import { useState } from "react";
import { useNostr } from "../context/NostrContext";
import { useFixture } from "../context/FixtureContext";
import "./Onboarding.css";

export function Onboarding() {
  const { setupIdentity, restoreIdentityFromMnemonic } = useNostr();
  const { dispatch } = useFixture();
  const [name, setName] = useState("");
  const [restoreMode, setRestoreMode] = useState(false);
  const [mnemonic, setMnemonic] = useState("");
  const [error, setError] = useState("");

  function handleCreate() {
    if (!name.trim()) return;
    setupIdentity();
    dispatch({ type: "SET_PLAYER_NAME", name: name.trim() });
  }

  function handleRestore() {
    if (!mnemonic.trim()) return;
    try {
      restoreIdentityFromMnemonic(mnemonic.trim());
      if (name.trim()) dispatch({ type: "SET_PLAYER_NAME", name: name.trim() });
    } catch {
      setError("Seed phrase inválida. Verificá las 12 palabras.");
    }
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <h1>Mundial 2026</h1>
        <p>Competí con tus amigos prediciendo resultados.</p>

        <input
          type="text"
          placeholder="Tu nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="onboarding-input"
        />

        {!restoreMode ? (
          <>
            <button
              className="onboarding-btn primary"
              onClick={handleCreate}
              disabled={!name.trim()}
            >
              Empezar
            </button>
            <button
              className="onboarding-btn secondary"
              onClick={() => setRestoreMode(true)}
            >
              Ya tengo cuenta
            </button>
          </>
        ) : (
          <>
            <textarea
              placeholder="Escribí tus 12 palabras separadas por espacios"
              value={mnemonic}
              onChange={(e) => { setMnemonic(e.target.value); setError(""); }}
              className="onboarding-textarea"
              rows={3}
            />
            {error && <p className="onboarding-error">{error}</p>}
            <button
              className="onboarding-btn primary"
              onClick={handleRestore}
              disabled={!mnemonic.trim()}
            >
              Restaurar
            </button>
            <button
              className="onboarding-btn secondary"
              onClick={() => setRestoreMode(false)}
            >
              Volver
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create Onboarding.css**

Create `src/components/Onboarding.css` following existing styling patterns from the codebase (check `TopBar.css`, `RankingView.css` for colors, spacing, font sizes). Key classes: `.onboarding` (centered fullscreen), `.onboarding-card` (max-width card), `.onboarding-input`, `.onboarding-textarea`, `.onboarding-btn.primary`, `.onboarding-btn.secondary`, `.onboarding-error`.

- [ ] **Step 4: Create AccountModal**

Create `src/components/AccountModal.tsx`:

```typescript
import { useState } from "react";
import { useNostr } from "../context/NostrContext";
import { QRDisplay } from "./QRDisplay";
import "./AccountModal.css";

interface AccountModalProps {
  onClose: () => void;
}

export function AccountModal({ onClose }: AccountModalProps) {
  const { exportIdentity } = useNostr();
  const exported = exportIdentity();
  const [showSeed, setShowSeed] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!exported) return null;

  function handleCopy() {
    navigator.clipboard.writeText(exported!.mnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Mi cuenta</h2>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>

        <div className="modal-section">
          <h3>Seed phrase</h3>
          <p className="modal-warning">No la compartas con nadie. Quien tenga estas palabras puede acceder a tu identidad.</p>
          {showSeed ? (
            <div className="seed-display">
              <code className="seed-words">{exported.mnemonic}</code>
              <button className="modal-btn" onClick={handleCopy}>
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          ) : (
            <button className="modal-btn" onClick={() => setShowSeed(true)}>
              Mostrar seed phrase
            </button>
          )}
        </div>

        <div className="modal-section">
          <h3>QR code</h3>
          <p className="modal-warning">Este QR contiene tu clave privada. Solo usalo para migrar a otro dispositivo.</p>
          {showQR ? (
            <div className="qr-display">
              <QRDisplay value={exported.nsec} size={200} />
            </div>
          ) : (
            <button className="modal-btn" onClick={() => setShowQR(true)}>
              Mostrar QR
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create AccountModal.css**

Create `src/components/AccountModal.css` following existing patterns. Key classes: `.modal-overlay` (fixed fullscreen backdrop), `.modal-card` (centered card), `.modal-header`, `.modal-section`, `.modal-warning` (yellow/orange text), `.seed-display`, `.seed-words` (monospace), `.qr-display`.

- [ ] **Step 6: Wire Onboarding into App**

In `src/App.tsx`, conditionally show Onboarding when no identity exists:

```tsx
import { Onboarding } from "./components/Onboarding";
import { useNostr } from "./context/NostrContext";

function AppContent() {
  const { identity } = useNostr();
  if (!identity) return <Onboarding />;
  return (
    <>
      <NostrSyncBridge />
      <InviteRouter />
      {/* existing layout: Sidebar, TopBar, main content */}
    </>
  );
}
```

- [ ] **Step 7: Verify it builds and renders**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && pnpm build
```

Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/components/Onboarding.tsx src/components/Onboarding.css src/components/AccountModal.tsx src/components/AccountModal.css src/components/QRDisplay.tsx src/App.tsx
git commit -m "feat: add onboarding screen, account modal with seed phrase and QR backup"
```

---

### Task 12: Room list and room detail views

**Files:**
- Create: `src/components/RoomList.tsx`
- Create: `src/components/RoomList.css`
- Create: `src/components/RoomDetail.tsx`
- Create: `src/components/RoomDetail.css`
- Create: `src/components/InviteModal.tsx`
- Create: `src/components/InviteModal.css`
- Create: `src/components/ConnectionStatus.tsx`

- [ ] **Step 1: Create ConnectionStatus indicator**

Create `src/components/ConnectionStatus.tsx`:

```typescript
import { useNostr } from "../context/NostrContext";

export function ConnectionStatus() {
  const { connectionStatus } = useNostr();
  const labels: Record<string, string> = {
    offline: "Sin conexion",
    connecting: "Conectando...",
    connected: "Conectado",
  };
  const colors: Record<string, string> = {
    offline: "#999",
    connecting: "#f5a623",
    connected: "#4caf50",
  };
  return (
    <span
      className="connection-status"
      style={{ color: colors[connectionStatus] }}
      title={labels[connectionStatus]}
    >
      {connectionStatus === "connected" ? "\u25CF" : connectionStatus === "connecting" ? "\u25CB" : "\u25CB"}
    </span>
  );
}
```

- [ ] **Step 2: Create InviteModal**

Create `src/components/InviteModal.tsx`:

```typescript
import { useState } from "react";
import { useNostr } from "../context/NostrContext";
import { QRDisplay } from "./QRDisplay";
import "./InviteModal.css";

interface InviteModalProps {
  roomId: string;
  onClose: () => void;
}

export function InviteModal({ roomId, onClose }: InviteModalProps) {
  const { createInvite, rooms } = useNostr();
  const room = rooms.find((r) => r.roomId === roomId);
  const isCreator = room?.role === "creator";
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const baseUrl = window.location.origin;
  const openLink = `${baseUrl}/r/${roomId}`;
  const inviteLink = inviteCode ? `${baseUrl}/r/${roomId}?i=${inviteCode}` : null;
  const displayLink = inviteLink ?? openLink;

  function handleGenerate() {
    const code = createInvite(roomId);
    setInviteCode(code);
  }

  function handleCopy() {
    navigator.clipboard.writeText(displayLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Invitar</h2>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>

        {isCreator && (
          <div className="modal-section">
            <button className="modal-btn" onClick={handleGenerate}>
              Generar nuevo invite
            </button>
          </div>
        )}

        <div className="modal-section">
          <p className="invite-link-label">Link de invitacion:</p>
          <code className="invite-link">{displayLink}</code>
          <button className="modal-btn" onClick={handleCopy}>
            {copied ? "Copiado" : "Copiar link"}
          </button>
        </div>

        <div className="modal-section invite-qr">
          <QRDisplay value={displayLink} size={200} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create InviteModal.css**

Create `src/components/InviteModal.css`. Reuses `.modal-overlay`, `.modal-card`, `.modal-header` patterns from `AccountModal.css`. Add `.invite-link` (monospace, word-break), `.invite-qr` (centered).

- [ ] **Step 4: Create RoomList view**

Create `src/components/RoomList.tsx`:

```typescript
import { useState } from "react";
import { useNostr } from "../context/NostrContext";
import { useFixture } from "../context/FixtureContext";
import "./RoomList.css";

export function RoomList() {
  const { rooms, createRoom, joinRoom, setActiveRoom } = useNostr();
  const { dispatch } = useFixture();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMode, setNewMode] = useState<"open" | "closed">("open");
  const [joinCode, setJoinCode] = useState("");

  function handleCreate() {
    if (!newName.trim()) return;
    const roomId = createRoom(newName.trim(), newMode);
    setActiveRoom(roomId);
    dispatch({ type: "SET_VIEW", view: { type: "room", roomId } });
    setShowCreate(false);
    setNewName("");
  }

  function handleJoin() {
    if (!joinCode.trim()) return;
    const roomId = joinCode.trim().slice(0, 8);
    joinRoom(roomId);
    setActiveRoom(roomId);
    dispatch({ type: "SET_VIEW", view: { type: "room", roomId } });
    setShowJoin(false);
    setJoinCode("");
  }

  function handleSelectRoom(roomId: string) {
    setActiveRoom(roomId);
    dispatch({ type: "SET_VIEW", view: { type: "room", roomId } });
  }

  return (
    <div className="room-list">
      <div className="room-list-header">
        <h2>Mis Salas</h2>
        <div className="room-list-actions">
          <button className="room-btn" onClick={() => { setShowCreate(true); setShowJoin(false); }}>
            Crear sala
          </button>
          <button className="room-btn" onClick={() => { setShowJoin(true); setShowCreate(false); }}>
            Unirme
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="room-form">
          <input
            type="text"
            placeholder="Nombre de la sala"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="room-input"
          />
          <div className="room-mode-select">
            <label>
              <input type="radio" checked={newMode === "open"} onChange={() => setNewMode("open")} />
              Abierta
            </label>
            <label>
              <input type="radio" checked={newMode === "closed"} onChange={() => setNewMode("closed")} />
              Solo con invitacion
            </label>
          </div>
          <button className="room-btn primary" onClick={handleCreate} disabled={!newName.trim()}>
            Crear
          </button>
        </div>
      )}

      {showJoin && (
        <div className="room-form">
          <input
            type="text"
            placeholder="Codigo de sala (8 caracteres)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            maxLength={8}
            className="room-input"
          />
          <button className="room-btn primary" onClick={handleJoin} disabled={!joinCode.trim()}>
            Unirme
          </button>
        </div>
      )}

      {rooms.length === 0 ? (
        <div className="room-list-empty">
          <p>No estas en ninguna sala.</p>
          <p>Crea una para competir con tus amigos, o unite con un codigo.</p>
        </div>
      ) : (
        <div className="room-list-items">
          {rooms.map((room) => (
            <button
              key={room.roomId}
              className="room-list-item"
              onClick={() => handleSelectRoom(room.roomId)}
            >
              <span className="room-item-name">{room.name}</span>
              <span className="room-item-role">{room.role === "creator" ? "Creador" : "Miembro"}</span>
              <span className="room-item-arrow">&rsaquo;</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create RoomList.css**

Create `src/components/RoomList.css`. Follow existing patterns. Key classes: `.room-list`, `.room-list-header`, `.room-list-actions`, `.room-form`, `.room-input`, `.room-mode-select`, `.room-btn`, `.room-list-items`, `.room-list-item`, `.room-list-empty`.

- [ ] **Step 6: Create RoomDetail view**

Create `src/components/RoomDetail.tsx`:

```typescript
import { useState } from "react";
import { useNostr } from "../context/NostrContext";
import { useFixture } from "../context/FixtureContext";
import { RankingView } from "./RankingView";
import { InviteModal } from "./InviteModal";
import "./RoomDetail.css";

interface RoomDetailProps {
  roomId: string;
}

export function RoomDetail({ roomId }: RoomDetailProps) {
  const { rooms, leaveRoom, setActiveRoom } = useNostr();
  const { dispatch } = useFixture();
  const room = rooms.find((r) => r.roomId === roomId);
  const [showInvite, setShowInvite] = useState(false);

  if (!room) return null;

  function handleLeave() {
    leaveRoom(roomId);
    dispatch({ type: "SET_VIEW", view: { type: "rooms" } });
  }

  function handleBack() {
    setActiveRoom(null);
    dispatch({ type: "SET_VIEW", view: { type: "rooms" } });
  }

  return (
    <div className="room-detail">
      <div className="room-detail-header">
        <button className="room-back-btn" onClick={handleBack}>&lsaquo; Salas</button>
        <h2>{room.name}</h2>
        <div className="room-detail-actions">
          <button className="room-btn" onClick={() => setShowInvite(true)}>
            Invitar
          </button>
          <button className="room-btn danger" onClick={handleLeave}>
            Salir
          </button>
        </div>
      </div>

      <div className="room-detail-code">
        Codigo: <code>{roomId}</code>
      </div>

      <RankingView />

      {showInvite && (
        <InviteModal roomId={roomId} onClose={() => setShowInvite(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Create RoomDetail.css**

Create `src/components/RoomDetail.css`. Key classes: `.room-detail`, `.room-detail-header`, `.room-detail-actions`, `.room-detail-code`, `.room-back-btn`, `.room-btn.danger`.

- [ ] **Step 8: Verify build**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && pnpm build
```

Expected: Build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/components/ConnectionStatus.tsx src/components/InviteModal.tsx src/components/InviteModal.css src/components/RoomList.tsx src/components/RoomList.css src/components/RoomDetail.tsx src/components/RoomDetail.css
git commit -m "feat: add room list, room detail, invite modal, and connection status views"
```

---

### Task 13: Update existing components (Sidebar, TopBar, RankingView)

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/TopBar.tsx`
- Modify: `src/components/RankingView.tsx`
- Modify: `src/App.tsx` (route new view types)

- [ ] **Step 1: Add "Mis Salas" to Sidebar**

In `src/components/Sidebar.tsx`, add a new nav item for rooms. Place it after the existing items (Groups, Knockouts, Schedule, Ranking):

```tsx
<button
  className={state.activeView.type === "rooms" || state.activeView.type === "room" ? "active" : ""}
  onClick={() => dispatch({ type: "SET_VIEW", view: { type: "rooms" } })}
>
  Salas
</button>
```

- [ ] **Step 2: Update TopBar**

In `src/components/TopBar.tsx`:

1. Remove the "Exportar mi prode" and "Importar prode rival" buttons and their handlers (`handleExportProde`, `handleImportProde`, `prodeInputRef`).
2. Keep "Exportar todo" and "Importar todo" (local backup).
3. Add the `ConnectionStatus` component and `AccountModal` trigger:

```tsx
import { ConnectionStatus } from "./ConnectionStatus";
import { AccountModal } from "./AccountModal";

// Inside the component, add state:
const [showAccount, setShowAccount] = useState(false);

// In the dropdown, replace prode section with:
<div className="dropdown-section">Cuenta</div>
<button className="dropdown-item" onClick={() => { setShowAccount(true); setMenuOpen(false); }}>
  <span className="dropdown-icon">&#9881;</span> Mi cuenta
</button>

// Next to the menu button, add connection indicator:
<ConnectionStatus />

// After the topbar div, render modal:
{showAccount && <AccountModal onClose={() => setShowAccount(false)} />}
```

Also remove the hidden file inputs for prode import (`prodeInputRef`).

- [ ] **Step 3: Route new view types in App**

In `src/App.tsx`, in the main content area where `activeView` is rendered, add cases for the new view types:

```tsx
import { RoomList } from "./components/RoomList";
import { RoomDetail } from "./components/RoomDetail";

// In the main content switch/conditional:
{state.activeView.type === "rooms" && <RoomList />}
{state.activeView.type === "room" && <RoomDetail roomId={state.activeView.roomId} />}
```

- [ ] **Step 4: Verify build and test manually**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && pnpm build
```

Expected: Build succeeds. Start dev server (`pnpm dev`) and verify:
- Sidebar shows "Salas" item
- TopBar no longer shows prode export/import
- TopBar has connection indicator and "Mi cuenta" in menu
- Clicking "Salas" shows the RoomList view

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx src/components/TopBar.tsx src/components/RankingView.tsx src/App.tsx
git commit -m "feat: integrate room views into sidebar, topbar, and main routing"
```

---

### Task 14: PWA setup and Cloudflare Pages config

**Files:**
- Modify: `vite.config.ts`
- Create: `public/_redirects`
- Create: `public/manifest-icons/` (placeholder — real icons later)

- [ ] **Step 1: Configure vite-plugin-pwa**

In `vite.config.ts`, add the PWA plugin:

```typescript
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Mundial 2026 - Fixture y Prode",
        short_name: "Fixture 2026",
        description: "Predicciones del Mundial 2026 con competencia entre amigos",
        theme_color: "#1a1a2e",
        background_color: "#1a1a2e",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
      },
    }),
  ],
});
```

- [ ] **Step 2: Create SPA redirect for Cloudflare Pages**

Create `public/_redirects`:

```
/* /index.html 200
```

- [ ] **Step 3: Create placeholder PWA icons**

Create simple placeholder icons (these will be replaced with real icons later). For now, create two minimal PNG files at `public/icon-192.png` and `public/icon-512.png`. You can generate them with any tool or use a simple SVG-to-PNG conversion. The important thing is that the paths exist so the manifest doesn't 404.

- [ ] **Step 4: Verify build includes PWA assets**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && pnpm build && ls dist/sw.js dist/_redirects
```

Expected: `sw.js` and `_redirects` exist in the build output.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts public/_redirects public/icon-192.png public/icon-512.png
git commit -m "feat: add PWA configuration and Cloudflare Pages SPA routing"
```

---

### Task 15: Run full test suite and final verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && pnpm test
```

Expected: All tests pass — existing tests (standings, bestThirds, knockout) plus new tests (lockTime, identity, commitReveal, rooms, events).

- [ ] **Step 2: Run lint**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && pnpm lint
```

Expected: No lint errors.

- [ ] **Step 3: Run production build**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && pnpm build
```

Expected: Build succeeds with no errors or warnings.

- [ ] **Step 4: Start dev server and smoke test**

```bash
source ~/.nvm/nvm.sh && nvm use 24 && pnpm dev
```

Verify in browser:
1. First visit shows Onboarding screen
2. Enter name, click "Empezar" → generates identity, shows main app
3. Sidebar shows "Salas" item
4. Click "Salas" → shows RoomList with "Crear sala" and "Unirme"
5. Create a room → shows RoomDetail with ranking and invite button
6. TopBar menu → "Mi cuenta" → shows seed phrase and QR options
7. Connection indicator visible in TopBar
8. Predictions mode still works as before
9. Results mode still works as before

- [ ] **Step 5: Commit any fixes from smoke testing**

If any issues found during smoke test, fix and commit with appropriate message.
