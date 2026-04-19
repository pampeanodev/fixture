# Smoke Test: Simulator + Nostr Sync + Key Recovery

**Date**: 2026-04-18 (executed 2026-04-19)
**Tester**: Playwright browser automation, single browser session with localStorage manipulation for multi-user simulation
**Environment**: `pnpm dev` on macOS, Chromium via Playwright MCP

## Scope

Verify end-to-end behavior of:
1. The new **simulator** feature (match-by-match random + manual entry, deltas, ranking changes)
2. The **randomize all predictions** button
3. The **ConnectionStatus** pill redesign + repositioning to RoomDetail
4. The **key recovery** flow (seed phrase export → clear identity → restore via mnemonic)
5. The **Nostr relay** connection (publishing, no full multi-device sync verified)
6. CSS consistency in the room views

## What was tested

### Flow 1 — Randomize + Simulator + Exit

1. Onboarding as **Agus** → switched to Predicciones mode
2. `⋯` menu → new **"Predicciones"** section is visible only in predictions mode → clicked `🎲 Regenerar random`
3. Verified: 72 group predictions + 32 knockout predictions populated in one dispatch (104 total)
4. Verified: standings recompute in live (Grupo A showed México 6 pts, Sudáfrica 4, Corea 4, Chequia 3)
5. Verified: **knockout bracket cascades** — tested 32avos through Final; Final showed "Estados Unidos 3-2 Portugal", 3er puesto "Inglaterra 3-1 Francia"
6. **Bug discovered and fixed during test**: `resolveSlot` for `best_third` slots was checking `if (thirdAssignment[group])` (truthy) instead of `if (thirdAssignment[group] === matchId)`. This caused the same third-place team to populate multiple R32 slots (saw Corea del Sur in R32-2 AND R32-10; Haití in R32-5 AND R32-7). Fixed in `src/utils/knockout.ts:resolveSlot`. After fix, R32 showed 32 unique teams — bug caught by the randomize exposing the full knockout chain at once.
7. Pedro's prode exported to sessionStorage to use as rival for Flow 2

### Flow 2 — Multi-player prode + simulation

1. Cleared localStorage → re-onboarded as **Pedro**
2. Randomized Pedro's predictions
3. Injected Agus + Mati (cloned Agus with score jitter) as rivals via `wc2026-rivals` localStorage key
4. Reloaded → Ranking view showed 3 players (Pedro vos, Agus, Mati), all 0 pts / 104 pending
5. `⋯` menu → `Iniciar simulación` → redirected to SimulatorView
6. **Pre-match state verified**: México vs Sudáfrica, all 3 players' predictions displayed side-by-side, 3 action buttons
7. Clicked `▶ Simular random` → result 1-0 México
8. **Post-match state verified**:
   - Final score: "1 - 0" in monospace green
   - Winner label: "Gana México"
   - Deltas table:
     - Pedro (vos): predicted 3-2, symbol `½`, +1 pt
     - Agus: predicted 1-1, symbol `✗`, +0 pts
     - Mati: predicted 1-1, symbol `✗`, +0 pts
   - Ranking updated: 1. Pedro 1 pt, 2. Agus 0, 3. Mati 0
9. Clicked `▶ Siguiente partido` and simulated ~10 matches rapidly
10. Final ranking after 10 matches: Pedro 7, Agus 3, Mati 3 — ranking evolved dynamically
11. **Ephemeral persistence verified**: mid-simulation, `localStorage.wc2026-fixture.groupMatches[*].result` was still `null` for all matches (72 predictions persisted, 0 results)
12. Clicked `Salir` → redirected back to Ranking, all 3 players returned to 0 pts / 104 pending → state fully restored

### Flow 3 — ConnectionStatus redesign + room creation

1. Navigated to Salas → `Crear sala` → created "Asado 2026" (open mode)
2. **Relay connection verified**: `● Conectado` pill rendered green with dot + label, positioned next to room code
3. **CSS fixed mid-test**: RoomDetail header text was invisible (white-on-beige pre-existing bug from Nostr feature). Rewrote RoomDetail.css and RoomList.css to use the light theme (`var(--accent-green)` / `var(--card-bg)`) matching GroupView/RankingView
4. Verified room appears in RoomList with new card styling (green hover border, shadow lift)

### Flow 4 — Key recovery (seed phrase restore)

1. As Pedro, opened `⋯` → `Mi cuenta` → `Mostrar seed phrase`
2. Verified 12-word mnemonic rendered: `together glare object chaos sample forest bar venture try honey essence where`
3. AccountModal's dark-theme overlay rendered correctly on top of the light content
4. Captured: original nsec starts with `nsec1tr0jaj7uyuyffeq...`
5. **Simulated device migration**: cleared entire localStorage
6. Reloaded → Onboarding appeared (no identity detected)
7. `Ya tengo cuenta` → pasted the saved mnemonic → clicked `Restaurar`
8. **Verification**: new nsec starts with `nsec1tr0jaj7uyuyffeq...` → **identical** to original
9. Mnemonic persistence also verified → same 12 words stored
10. Player name re-entered during restore flow → "Pedro" persisted

## Bugs found + fixed during smoke test

| # | Severity | File | Issue | Fix |
|---|----------|------|-------|-----|
| 1 | **Critical** | `src/utils/knockout.ts` | `resolveSlot` for best_third slots returned the third-place team of the first qualifying group in `possibleGroups` without checking that group was actually assigned to the current slot. Caused duplicate teams in R32. | Changed condition to `thirdAssignment[group] !== matchId`. Pre-existing bug surfaced only when full knockout chain was populated at once (pre-simulator users rarely triggered it). |
| 2 | Important | `src/components/RoomDetail.css` | Header h2, back button, code used white text / low-alpha whites, invisible on beige main content background | Rewrote with `var(--accent-green)` for headings, outlined green buttons matching GroupView |
| 3 | Important | `src/components/RoomList.css` | Same contrast problem: h2, buttons, forms, list items all used dark-theme rgba whites | Rewrote using light theme with card shadows, green primary buttons |
| 4 | Important | `src/components/SimulatorView.css` | Was written assuming a dark background but main content area is light beige — entire simulator view was near-invisible | Rewrote with light theme consistent with RankingView/GroupView |
| 5 | Minor | `src/components/TopBar.tsx` | `ConnectionStatus` rendered as a lone unlabeled circle, unclear to users | Removed from TopBar; moved to `RoomDetail` header where sync status is actually relevant |

## Improvements made alongside

- **Relay redundancy**: expanded `DEFAULT_RELAYS` from 3 to 6 (added `relay.primal.net`, `offchain.pub`, `nostr.mom`)
- **ConnectionStatus redesign**: now renders as a pill with dot + label (`● Conectado` green, `○ Conectando...` amber pulsing, `○ Sin conexión` muted), clearly communicates state

## What was NOT tested

- **Full multi-device Nostr sync**: creating a room on device A, joining from device B via invite link, exchanging commitments + reveals through relays, verifying ranking updates cross-device. Requires two independent browser contexts — recommended user-side test.
- **Real-time event arrival**: no verification that a second user publishing a commitment would be picked up by the first user's subscription.
- **Match lock-time behavior**: no test with a match's `dateUtc` being within 1 hour of now to verify the commit-reveal transition.
- **Outbox offline queue**: no simulation of network disconnect during a publish.

## Recommended user-side verification

To close the multi-device loop:

1. In a regular browser window: onboard as User A, randomize predictions, create an open room, copy the invite link
2. In an incognito window (or different browser/profile): open the invite link, onboard as User B with a different name
3. Verify User B appears as a rival in User A's Ranking within ~5 seconds (once User B's commitments are published and fetched)
4. In one device, start simulation and simulate a few matches
5. Verify both users see the same results and same ranking changes (the sim runs client-side, but all predictions involved are shared)

## Test suite status

After all fixes:
- `pnpm test` — **85 passed / 85** (14 files)
- `pnpm build` — clean, PWA assets generated
- `pnpm lint` — 7 errors (same count as before this work, pre-existing rule violations in App.tsx / NostrContext.tsx / FixtureContext.tsx / GroupView.tsx / ScheduleView.tsx / ScoreInput.tsx — none introduced by this smoke test work)

## Commits from this session

- `refactor: redesign ConnectionStatus as pill and move to RoomDetail`
- `feat: add randomize-all-predictions action via TopBar menu`
- `fix: light-theme CSS for rooms/simulator, expand relay list, fix knockout best-third resolution`
