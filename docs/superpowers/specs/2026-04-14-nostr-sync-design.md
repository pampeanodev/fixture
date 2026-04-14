# Nostr P2P Sync for Prode Rooms

**Date**: 2026-04-14
**Status**: Approved

## Overview

Add peer-to-peer prediction sync via Nostr relays so users can compete in rooms without manual JSON export/import. Predictions are sealed with a commit-reveal scheme (hash before lock, reveal after) to prevent cheating. Rooms can be open or invite-only. Identity is a Nostr keypair with seed phrase + QR backup.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Transport | Nostr public relays | Unlimited rooms, zero backend cost, multi-room native |
| Library | `nostr-tools` (~15KB) | Minimal footprint, consistent with lean codebase |
| Prediction visibility | Commit-reveal (hard seal) | Cryptographic guarantee, not just client-side |
| Lock time | 1 hour before match kickoff | Per-match granularity using `GroupMatch.dateUtc` / `KnockoutMatch.dateUtc` |
| Reveal timing | Lazy — on next app open after lock | Visibility delay accepted; commitment proves integrity |
| Identity | Nostr keypair via NIP-06 | Auto-generated, exportable as seed phrase + QR |
| Room access | Open (anyone with link) or Closed (single-use invite codes) | Creator controls membership |
| Relay hosting | Public relays only (no own relay) | Future option to add Cloudflare Worker relay |
| Deploy | Cloudflare Pages (static) | Free tier, HTTPS, SPA routing |
| PWA | Yes, via `vite-plugin-pwa` | Offline support, asset caching; SW does not run Nostr logic |

## 1. Identity & Keypair Management

### Generation

On first use, the app generates a Nostr keypair:
- BIP-39 mnemonic (12 words) generated via `@scure/bip39`
- Keypair derived via NIP-06 (deterministic from mnemonic)
- `nsec` (private key) and `npub` (public key) stored in localStorage

The user never sees "Nostr" or "keypair" in the UI. They see their name and, in settings, backup options.

### Data model

```typescript
interface NostrIdentity {
  nsec: string;       // private key (hex)
  npub: string;       // public key (hex)
  mnemonic: string;   // 12-word seed phrase
}
```

### Persistence

```
localStorage:
  wc2026-nostr-nsec      → private key (hex)
  wc2026-nostr-mnemonic  → 12-word seed phrase
  wc2026-player-name     → display name (already exists)
```

### Export (backup)

From an account modal:
- **Seed phrase**: displays 12 words with copy button
- **QR code**: encodes the nsec with a warning that it's private

### Restore

- **Seed phrase**: enter 12 words, regenerate same keypair
- **QR scan**: scan QR from another device, import nsec

### Name vs identity

`playerName` remains a free-text editable field (as today). The `npub` is the real unique ID. Two people can share the same display name — the npub distinguishes them.

## 2. Rooms

### Creating a room

User clicks "Crear sala". The app generates an 8-character alphanumeric room ID (e.g., `k7xm2p4a`). This ID is used in Nostr event tags: `["d", "fixture:k7xm2p4a:manifest"]`.

There is no admin beyond the creator. The creator is identified by their npub in the room manifest.

### Room modes

**Open**: anyone with the link (`fixture.app/r/k7xm2p4a`) can join. No restrictions.

**Closed**: the creator generates single-use invite codes. Each invite link (`fixture.app/r/k7xm2p4a?i=t8f2`) can be claimed once. The creator publishes a room manifest listing valid invite codes. Clients only accept predictions from npubs that have a valid claim.

### Invite flow (closed rooms)

1. Creator generates invite codes (one per invitee)
2. Creator publishes room manifest (signed, replaceable): `{ roomId, mode, creator, validInvites }`
3. Creator shares individual invite links
4. Invitee opens link, app publishes claim event: `{ roomId, inviteCode, npub }`
5. Invite code is burned — associated to that npub
6. Creator can add more invites by updating the manifest
7. Creator can remove access by removing invite codes from manifest

### Multi-room

Users can participate in multiple rooms. Room list stored in localStorage:

```typescript
interface RoomMembership {
  roomId: string;
  name: string;          // editable display name for the room
  joinedAt: number;
  inviteCode?: string;   // the code used to join (closed rooms)
  role: "creator" | "member";
}
```

Persisted in `wc2026-rooms` in localStorage.

### Room properties

- No configuration (scoring rules are universal)
- No chat or messaging
- No expiration
- No moderation beyond invite control

### Backwards compatibility with manual import

The manual JSON export/import flow ("Exportar mi prode" / "Importar prode rival") is removed from the UI. Previously imported rivals (already in `state.rivals`) are preserved in localStorage and continue to appear in the ranking when no room is selected. When a room is active, only rivals synced via that room are shown.

## 3. Commit-Reveal Protocol

### Nostr event types

All events use kind `30078` (NIP-78: arbitrary app data) with different `d` tags to make them NIP-33 parameterized replaceable events:

| Event | Tag `d` | Content | Replaceable by |
|-------|---------|---------|----------------|
| Room Manifest | `fixture:{roomId}:manifest` | `{ roomId, mode, creator, validInvites }` | Creator only |
| Invite Claim | `fixture:{roomId}:claim` | `{ roomId, inviteCode }` | Claiming user |
| Commitment | `fixture:{roomId}:commit` | `{ commitments: { matchId: hash, ... } }` | Publishing user |
| Reveal | `fixture:{roomId}:reveal` | `{ predictions: { matchId: { home, away, salt }, ... } }` | Publishing user |

Each user has exactly ONE event of each type per room. Updates replace the previous event on the relay.

### Commitment flow

When a user creates or updates a prediction for a non-locked match:
1. Generate a random salt (16 bytes) per match, stored in localStorage
2. Compute: `SHA-256(matchId + ":" + home + "-" + away + ":" + salt)`
3. Publish commitment event with hashes for ALL predictions (one event, all matches)

### Lock time

A match locks 1 hour before its `dateUtc`. After lock:
- The UI prevents editing that match's prediction
- The prediction is eligible for reveal

### Reveal flow

On app open, for each match past lock time with an unrevealed prediction:
1. Include the actual prediction + salt in the reveal event
2. Publish reveal event (one event, all revealed predictions so far)

The reveal event grows over time as more matches lock.

### Verification

When a client receives a reveal from another user:
1. Look up the user's commitment for that match
2. Compute: `SHA-256(matchId + ":" + home + "-" + away + ":" + salt)`
3. Compare with committed hash
4. If match: accept prediction, transform to `Rival`, dispatch `ADD_RIVAL`
5. If mismatch: reject (prediction was modified after lock)

### Prediction status per match

```typescript
type PredictionStatus =
  | "editable"   // match not locked, can edit
  | "locked"     // match locked, pending reveal
  | "revealed";  // match locked + reveal published
```

## 4. Relay Connection

### Relay pool

```typescript
const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band",
];
```

Uses `SimplePool` from `nostr-tools`. Publishes to all 3, reads from the first to respond.

### Connection lifecycle

- Connect when user has at least one room
- Disconnect when no rooms
- Auto-reconnect with exponential backoff (handled by `SimplePool`)

### Offline queue

When offline, events are queued in localStorage (`wc2026-nostr-outbox`). On reconnect, queued events are published and the outbox is cleared.

```typescript
interface OutboxEvent {
  event: UnsignedEvent;
  createdAt: number;
}
```

## 5. State Management

### Architecture

Two separate React contexts:

```
App
├── NostrProvider           (NEW)
│   ├── identity
│   ├── rooms
│   ├── connection status
│   └── sync logic (publish, subscribe, verify)
│
├── FixtureProvider         (EXISTING, unchanged internally)
│   ├── matches, predictions
│   ├── mode, activeView
│   ├── playerName
│   └── rivals (fed by NostrProvider via ADD_RIVAL)
│
└── UI components
```

`FixtureContext` does not know about Nostr. It only receives `ADD_RIVAL` / `REMOVE_RIVAL` dispatches as it does today. This separation means Nostr is a transport layer that can be swapped without touching the fixture logic.

### NostrContext interface

```typescript
interface NostrContextValue {
  identity: NostrIdentity | null;
  rooms: RoomMembership[];
  activeRoomId: string | null;
  connectionStatus: "offline" | "connecting" | "connected";
  createRoom: (name: string, mode: "open" | "closed") => string;
  joinRoom: (roomId: string, inviteCode?: string) => Promise<void>;
  leaveRoom: (roomId: string) => void;
  generateInvite: (roomId: string) => string;
  exportIdentity: () => { mnemonic: string; nsec: string };
  restoreIdentity: (mnemonic: string) => void;
}
```

## 6. UI Changes

### New screens

**Onboarding** (first visit, no keypair):
- Auto-generate keypair
- Name input
- Option to restore from seed phrase or QR

**Mis Salas** (room list):
- List of joined rooms with participant count and user's rank
- Create room / Join room buttons

**Room Detail** (evolution of RankingView):
- Room name, invite link, QR code, share button
- Invite management for closed rooms
- Ranking table (existing logic)
- Participant list with prediction status
- Leave room button

**Mi Cuenta** (modal):
- Name (editable)
- Seed phrase display + copy
- QR code display
- Restore option

### Modified screens

**TopBar**:
- Remove "Exportar mi prode" / "Importar prode rival" (replaced by auto-sync)
- Keep "Exportar todo" / "Importar todo" (local backup)
- Add connection status indicator

**RankingView**:
- Add room selector
- Filter rivals by active room
- Add prediction status indicators per match

**Sidebar**:
- Add "Mis Salas" item

### URL routing

```
fixture.app/                    → default view (groups)
fixture.app/r/{roomId}          → join/view open room
fixture.app/r/{roomId}?i={code} → join with invite (closed room)
```

No router library needed. A `useEffect` on mount reads `window.location` and dispatches the appropriate action.

## 7. Infrastructure

### Deploy

Cloudflare Pages (free tier):
- Build: `pnpm build`
- Output: `dist`
- SPA routing: `/* /index.html 200` via `_redirects` in `public/`
- HTTPS by default

### PWA

Via `vite-plugin-pwa`:
- Precache all static assets
- Manifest for installability
- Service Worker caches assets only (no Nostr logic)

### Stack summary

```
Code:        React 19 + TypeScript + Vite
Sync:        nostr-tools → public relays
Identity:    Nostr keypair (NIP-06 seed phrase)
Persistence: localStorage (local) + Nostr events (sync)
Deploy:      Cloudflare Pages (static, free)
Backend:     None
Cost:        $0
```

### Future: own relay

If needed, a Cloudflare Worker relay can be added:
- WebSocket handler via Durable Object
- D1 database for event storage
- Minimal NIP-01 implementation
- Added as `"wss://relay.fixture.app"` to the relay array — zero frontend changes

## 8. Dependencies

```
nostr-tools       ~15KB gzip  — Nostr protocol, crypto, relay pool
@scure/bip39       ~3KB gzip  — seed phrase generation (NIP-06)
qrcode            ~12KB gzip  — QR code generation
vite-plugin-pwa   dev only    — PWA manifest + SW generation
```

`@noble/hashes` (~8KB) is a transitive dependency of `nostr-tools`. Estimated total bundle increase: ~30KB gzipped.

## 9. Testing Strategy

- **Unit tests**: commit-reveal hash generation and verification, lock time calculation, room manifest validation, invite claim logic, access control filtering
- **Integration tests**: mock relay with `nostr-tools` to test full flow: publish commitment → subscribe → receive reveal → verify hash → dispatch ADD_RIVAL
- **Existing tests**: standings, bestThirds, knockout resolution remain unchanged
- **Framework**: vitest (already configured)
