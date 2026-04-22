# Nostr Sync Reference

How rooms, invites, commit-reveal, and admin push work in the current codebase. For the design rationale, see [`../superpowers/specs/2026-04-14-nostr-sync-design.md`](../superpowers/specs/2026-04-14-nostr-sync-design.md).

## TL;DR

- No backend. All sync happens over **5 public Nostr relays** via `SimplePool` from `nostr-tools`.
- Identity = BIP-39 seed phrase → NIP-06 keypair. Persisted in localStorage.
- Rooms are **8-char codes** (open) with optional **4-char single-use invites** (closed).
- Predictions travel as **commit-reveal**: hash published at prediction time, plaintext revealed 1h before each match's kickoff.
- The room creator is the **admin** — only their published results are honored by other members.

## Module map

```
src/nostr/
├── types.ts          # RoomManifest, CommitmentPayload, RevealEntry, ResultsPayload,
│                     #   NOSTR_KIND (30078 = NIP-78), DEFAULT_RELAYS (5), TAG_PREFIX "fixture"
├── identity.ts       # BIP-39 seed ↔ secret/pub key; localStorage persistence
├── relayPool.ts      # SimplePool wrapper: publishEvent, subscribe, queryEvents, flushOutbox
├── events.ts         # buildManifestEvent / buildClaimEvent / buildCommitmentEvent /
│                     #   buildRevealEvent / buildResultsEvent + getDTag helper
├── rooms.ts          # createRoom / generateInviteCode (crypto.getRandomValues),
│                     #   manifest + room-membership persistence, isValidMember()
├── commitReveal.ts   # SHA-256 commit, salt generation, verification, salts persistence
└── outbox.ts         # Offline queue: events buffered when publish fails

src/context/NostrContext.tsx    # Identity state, room membership list, active room, relay status
src/hooks/useNostrSync.ts       # Bridge subscribing to relays and dispatching to FixtureContext
```

## Event model

All app events use **kind 30078** (NIP-78, "arbitrary custom app data"). They're **replaceable** per `d`-tag, meaning `(pubkey, kind, d-tag)` is a unique slot — republishing overwrites.

D-tags namespace each event by purpose:

| Event | `d` tag | Meaning |
|---|---|---|
| Manifest | `fixture:<roomId>:manifest` | Room config (mode, creator, invites). Creator-only. |
| Claim | `fixture:<roomId>:claim` | "I'm joining this room with this invite". Closed-room only. |
| Commitment | `fixture:<roomId>:commit` | SHA-256 hashes of predictions. Any member. Mutable. |
| Reveal | `fixture:<roomId>:reveal` | Plaintext predictions + salts. Any member, after reveal window. |
| Results | `fixture:<roomId>:results` | Real match results. **Admin-only-honored**. |

The content is always a JSON-serialized payload in the event's `content` field. See [`src/nostr/types.ts`](../../src/nostr/types.ts) for payload shapes.

## Identity

- [`src/nostr/identity.ts`](../../src/nostr/identity.ts): generates a 12-word BIP-39 mnemonic, derives via NIP-06 (BIP-32 path `m/44'/1237'/0'/0/0`), gives you `{ secretKey, pubkey, mnemonic }`.
- Persisted as the mnemonic (not the raw key) under `localStorage["wc2026-mnemonic"]`. On load, re-derives.
- `AccountModal` shows the mnemonic + QR for backup; `Onboarding` accepts a mnemonic to restore an identity on a new device.
- There is **no server-side registration**. The pubkey IS the user.

## Rooms

### Creating

`NostrContext.createRoom({ mode })`:
1. `createRoom()` generates an 8-char alphanumeric room ID using `crypto.getRandomValues`.
2. Builds a `RoomManifest` with the local pubkey as `creator`. For closed rooms, also generates a starter batch of 4-char invite codes.
3. Publishes the manifest event.
4. Adds a `RoomMembership` (role=`creator`) to localStorage via `addRoom()`.

### Joining

- **Open** room: anyone with the room ID passes `isValidMember`. Just add the membership and subscribe.
- **Closed** room: the joiner needs a valid invite code from the manifest's `validInvites`. On join, they publish a `ClaimEvent` pinning `(inviteCode, theirPubkey)`. Subsequent validation (`isValidMember`) looks up that claim.
- **Invite link** format: `/r/<roomId>?i=<inviteCode>` — `InviteRouter` in [`src/App.tsx`](../../src/App.tsx) parses it and calls `joinRoom(roomId, inviteCode)`.

### Validation

[`src/nostr/rooms.ts#isValidMember`](../../src/nostr/rooms.ts):

```
open room                                       → always valid
pubkey === creator                              → always valid
closed, pubkey has claim tied to a valid invite → valid
otherwise                                       → invalid
```

Invalid members' events are ignored on the consumer side. Relays don't enforce membership — the app does.

## Commit-reveal lifecycle

The goal: predictions are secret until 1 hour before kickoff, at which point anyone can verify what was predicted.

### 1. Commit (while the match is still open)

When the local user edits a prediction in a room context, [`useNostrSync`](../../src/hooks/useNostrSync.ts) does:

1. For each prediction `(matchId, home, away)`, generate (or reuse) a random 16-byte salt.
2. `commit = sha256(matchId + ":" + home + "-" + away + ":" + salt)` ([`commitReveal.ts#computeCommitment`](../../src/nostr/commitReveal.ts)).
3. Persist the salt locally (`localStorage["wc2026-salts-<roomId>"]`) so reveal later can reproduce the hash.
4. Publish a `CommitmentPayload` = `{ commitments: { matchId: hex, ... }, playerName }` to kind-30078 with d-tag `fixture:<roomId>:commit`. Being replaceable, re-publishing updates the whole commitment map.

At this point, other members see the commitment but can't derive the prediction — the salt is private.

### 2. Reveal (1 hour before kickoff)

`isMatchLocked(dateUtc)` ([`src/utils/lockTime.ts`](../../src/utils/lockTime.ts)) flips `true` at `dateUtc - 60min`. When it flips:

1. The local user can no longer edit that prediction (UI enforces).
2. `useNostrSync` publishes a `RevealPayload` = `{ playerName, predictions: { matchId: { home, away, salt } } }` with d-tag `fixture:<roomId>:reveal`.
3. Consumers verify each `(home, away, salt)` matches the peer's committed hash via [`verifyReveal`](../../src/nostr/commitReveal.ts) before trusting it.

A peer without a committed hash for a given match is rejected: [`useNostrSync` explicitly drops reveals without the matching commitment map](../../src/hooks/useNostrSync.ts). This prevents late-bind cheating.

### 3. Reveals populate rivals

Verified reveals from peer A turn into a `Rival` record in `FixtureState` (dispatched via `ADD_RIVAL`). From there, ranking calculations treat them as any other rival.

## Admin (creator) results push

Only the room creator publishes the official match results. This keeps the room's "reality" authoritative and avoids conflicts.

- When the creator enters/edits a real result in the app, `useNostrSync` publishes a `ResultsPayload` under d-tag `fixture:<roomId>:results`.
- Other members subscribe to **only the creator's pubkey** on that d-tag (filtered via `Filter.authors = [manifest.creator]`). Events from any other pubkey on that d-tag are ignored.
- On receipt, the member dispatches `APPLY_SYNCED_RESULTS`, which merges the server-truth results into local state and tags the match IDs under `syncedResultIds`.
- If the creator later edits a result, `APPLY_SYNCED_RESULTS` re-runs. If they delete a result (sends a payload without that match's ID), [`CLEAR_SYNCED_RESULTS`](../../src/context/FixtureContext.tsx) clears the stale one on members — this is what commit `da99086` fixed.

## Outbox (offline queue)

If publishing fails (all relays unreachable), the event is appended to an **outbox** in localStorage ([`src/nostr/outbox.ts`](../../src/nostr/outbox.ts)). On next successful connect, `flushOutbox` drains it.

This matters for a PWA that might be opened offline and then come online.

## Relay pool

[`src/nostr/relayPool.ts`](../../src/nostr/relayPool.ts):

- Single `SimplePool` instance for the whole app.
- `publishEvent` fan-out writes to all 5 relays. Returns when the first ACKs (don't wait for quorum).
- `subscribe({ filter, onEvent })` opens a REQ to all 5 relays and dedupes incoming events by id.
- `queryEvents(filter)` is a one-shot (returns when all relays EOSE or timeout).

Relay list is hardcoded in [`src/nostr/types.ts#DEFAULT_RELAYS`](../../src/nostr/types.ts): `relay.damus.io`, `nos.lol`, `relay.primal.net`, `offchain.pub`, `nostr.mom`. Changing it requires a version bump and user comms (old installs still use the old list).

## Connection status

`NostrContext.connectionStatus` is `"offline" | "connecting" | "connected"`. Derived from `SimplePool`'s per-relay state — "connected" means at least one relay is live. The `ConnectionStatus` component in the footer renders this.

## Gotchas

- **`NOSTR_KIND = 30078` is a replaceable event kind.** That means republishing with the same `(pubkey, kind, d-tag)` overwrites the previous event. Leverage this — don't publish a new commitment for each match; publish the full map in one event.
- **Relay "truth" is best-effort.** `queryEvents` can miss events if relays drop them. Sync happens incrementally via persistent `subscribe`. On app start, `useNostrSync` does a `queryEvents` as an initial backfill, then subscribes live.
- **Identity restore does not restore history.** Importing a mnemonic on a new device gives you the same pubkey but an empty local state. Your published events are recoverable (they're on the relays) but rooms you joined are not auto-rejoined. You need the invite link/code again.
- **Salt loss = reveal impossible.** If a user wipes localStorage without backing up, they can never reveal their committed predictions. There is no "reset salt" path — the commitment is bound to a specific salt.
- **`playerName` travels with commitment and reveal payloads.** It's a display name, not an identity anchor — the pubkey is what matters. Name changes are free and don't invalidate anything.
- **The `lockTime` uses `devClock`** ([`src/utils/devClock.ts`](../../src/utils/devClock.ts)) which allows dev-mode time skipping. In production it just returns `Date.now()`. Don't remove the indirection — it's how simulation and QA work.
