# Auto Results Sync — Design

**Status:** approved, pending implementation plan
**Date:** 2026-04-22
**Scope:** Replace manual result entry with a keyless client-side polling of ESPN's public API. The existing manual entry path is preserved as an automatic fallback when the API is unreachable, stale, or disabled.

## Why

Today, a real match result enters `FixtureState` only when someone types it. For a room, that someone must be the admin — if the admin doesn't open the app, the room has no scores. For a solo player, they themselves type every result. Both are friction for a feature whose data (FIFA World Cup match results) is publicly available, reliably, from multiple free APIs.

Target: on match day, the user opens the app and the result is already there. No typing, no admin dependency, no server.

## Constraints

- **Client-only.** This project has no backend and that stays. Rules out any auth scheme that would leak a shared API key with meaningful per-key rate limits.
- **CORS-friendly.** Everything runs in the browser; the API must allow cross-origin `fetch` without a preflight that needs auth headers.
- **Unknown reliability.** ESPN's API is undocumented. Schema can drift. Design has to degrade gracefully to the current manual flow.
- **Tournament hasn't started.** The WC 2026 begins 2026-06-11. We need a way to validate the pipeline against real data before then.

## Decisions

1. **API: ESPN Site API v3** at `https://site.api.espn.com/apis/site/v3/sports/soccer/fifa.world/scoreboard?dates=YYYYMMDD-YYYYMMDD`. Keyless. CORS-open. Alternate CDN endpoint (`cdn.espn.com/core/soccer/scoreboard?xhr=1&league=fifa.world`) is a later optimization.
2. **Every client polls, every 30 minutes.** Not just the admin. This removes the "admin must open the app" dependency. In a room, the admin's client also publishes via Nostr as today — the existing admin-push flow is unchanged.
3. **Polling gates.** Only runs when (a) auto-sync is enabled in settings, (b) the browser tab is visible, (c) `now` is within the tournament window (2026-06-10 to 2026-07-20). First fetch on mount if all gates pass.
4. **Results are read-only when auto-sync is working.** The input for an unfilled result is disabled while the feature is active. This is the core UX shift: the user's job is no longer "type the score" but "watch it appear".
5. **Unlock conditions (results become editable):**
   - Auto-sync toggle is OFF in settings, OR
   - Circuit breaker is tripped (sustained failures), OR
   - `GRACE_PERIOD` elapsed since kickoff without an auto-synced result — 3 h for group, 4.5 h for knockout.
6. **API only fills voids.** When writing, the auto-sync never overwrites a result that already exists. This covers every conflict case with one rule: manual corrections survive; admin-push wins by virtue of existing first; idempotent re-application is a no-op. To recover a wrong ESPN result, admin clears the score (manual action) → the empty match is eligible for re-fill next tick.
7. **Strict per-event validation.** An API event is applied only if it passes every sanity check; any failure skips the event silently (log only). See §Validation.
8. **Three testing layers:** recorded-fixture unit tests, a dev-mode read-only inspector for pre-launch rehearsal against live non-WC leagues, and a "Verify auto-sync" button in settings for on-demand diagnostics.
9. **No new state in `FixtureState`.** Toggle, last-fetch metadata, and circuit-breaker status live in `localStorage` read directly by the new hook. `FixtureState` stays a pure "contents of the prode".

## Architecture

### Module layout

```
src/espn/
├── types.ts              # Schema types: EspnEvent, EspnScoreboard, EspnStatusType
├── client.ts             # fetchScoreboard(dates, leagueSlug): Promise<EspnScoreboard>
├── parser.ts             # parseScoreboard(raw): EspnEvent[]
├── normalizer.ts         # ESPN_TEAM_CODE_MAP + normalizeTeamCode(code): TeamId | null
├── validator.ts          # validateEvent(ev): { ok: true } | { ok: false; reason }
├── matcher.ts            # matchEvent(ev, ourMatches): MatchResult | { skip; reason }
├── tournamentWindow.ts   # WC 2026 date range, isWithinTournamentWindow(now),
│                         #   expectedMatchesOnDate(day) — used by circuit breaker
├── graceLock.ts          # computeEditableMatches(state, meta, now): Set<matchId>
└── __fixtures__/         # JSON snapshots for tests

src/hooks/
└── useAutoResultSync.ts  # Orchestrator: polling + gating + dispatches

src/components/
├── AutoSyncSettings.tsx  # Toggle + "Verify auto-sync" button + last-fetch status
└── AutoSyncInspector.tsx # Dev-mode read-only inspector (?devSync=1)
```

The new hook lives in `App.tsx` alongside `useNostrSync`, uses `useFixture()` for state and dispatch. No new context provider.

### No reducer changes for writing

Auto-sync dispatches the same `SET_GROUP_SCORE` and `SET_KNOCKOUT_SCORE` actions that manual typing uses. `useNostrSync` already reacts to score changes and publishes `ResultsPayload` when the local user is a room admin. That bridge needs no modification — it doesn't know or care whether the score came from a key press or a fetch.

### Reducer caveat to verify during writing-plans

When the local admin types a result today, `syncedResultIds` is only populated after receiving one's own Nostr push back. There is a round-trip gap where the score exists locally but isn't marked synced. Under the "API only fills voids" rule in §Decisions(6), this gap is fine — the score is non-null, so auto-sync skips regardless of `syncedResultIds`. Confirming this during plan writing; if reality differs, the fallback is to have `SET_GROUP_SCORE`/`SET_KNOCKOUT_SCORE` add the id to `syncedResultIds` locally when the user is admin, eliminating the round trip.

## Data flow (one tick)

```
1. GATE
   autoSyncEnabled && !document.hidden && isWithinTournamentWindow(now) &&
   !circuitBreakerTripped && !currentlyFetching
   → otherwise skip tick

2. FETCH
   dates = buildFetchDates(now) → "YYYYMMDD-YYYYMMDD" (today ± 3 days)
   GET site.api.espn.com/apis/site/v3/sports/soccer/fifa.world/scoreboard?dates=<range>
     with AbortController timeout 10s, single in-flight fetch enforced
   network or HTTP error → log, increment failureCount, skip

3. PARSE
   parseScoreboard(raw) → EspnEvent[]
   JSON parse error → log, increment failureCount, skip

4. PER-EVENT VALIDATE + MATCH
   for each ev:
     v = validateEvent(ev)         (see §Validation)
     if !v.ok → record skip(reason), continue

     home = normalizeTeamCode(ev.competitors[0].team.abbreviation)
     away = normalizeTeamCode(ev.competitors[1].team.abbreviation)
     if !home || !away → record skip("unknown_team_code"), continue

     candidates = [
       ...state.groupMatches,
       ...state.knockoutMatches,
     ].filter(m =>
       m.homeTeamId === home &&
       m.awayTeamId === away &&
       Math.abs(parseISO(m.dateUtc) - ev.dateUtc) < 2h,
     )
     if candidates.length !== 1 → record skip("ambiguous_or_missing"), continue

5. WRITE GUARD
   if candidate.result !== null → record skip("already_has_result"), continue

6. DISPATCH
   score = {
     home: ev.homeScore,
     away: ev.awayScore,
     penalties: ev.status === 'PEN'
       ? { home: ev.shootout.home, away: ev.shootout.away }
       : undefined,
   }
   dispatch(candidate in groupMatches ? SET_GROUP_SCORE : SET_KNOCKOUT_SCORE)
   record applied(matchId, ts)

7. POST-TICK
   localStorage['wc2026-autosync-meta'] = {
     lastFetchAt: now,
     applied: [{ matchId, ts }, ...],
     skipped: [{ matchId?, eventId?, reason }, ...],
     consecutiveFailures: 0 if this tick applied >= 0 matches else failureCount + 1,
   }
   if this tick had > 2x skips vs applies AND at least 3 skips:
     circuitBreakerTripped = true (persisted)
     surface a one-time toast: "Auto-sync pausado: inconsistencias en ESPN"
```

## Validation

An event is accepted only if all of:

1. Exactly 2 competitors.
2. Both team abbreviations normalize to a known `TeamId` in `src/data/teams.ts`.
3. `status.type.name` is one of: `STATUS_FULL_TIME`, `STATUS_FINAL`, `STATUS_FULL_TIME_EXTRA` (AET), `STATUS_FINAL_PEN` (PEN). Anything else (scheduled, in-progress, halftime, postponed, forfeit) is rejected.
4. Both scores are integers ≥ 0 and ≤ 20 (sanity).
5. If PEN, shootout object exists with two integer scores ≥ 0 and ≤ 30.
6. `ev.dateUtc` parses to a finite Date.
7. Match lookup (§Data flow step 4) resolves to exactly one of our 104 matches within a ±2 h window on `dateUtc`.

Failures log with the event id and the reason; the rest of the fetch continues.

## Team code mapping

`src/espn/normalizer.ts` exports `ESPN_TEAM_CODE_MAP: Record<string, TeamId>` populated at build time with any ESPN abbreviation that doesn't equal our `TeamId` letter-for-letter. Most FIFA 3-letter codes align directly (ARG, BRA, USA, etc.), but a few historical ESPN quirks may exist (e.g., short codes for new teams, country code variants).

A consistency test in `src/espn/__tests__/normalizer.test.ts` asserts that every one of the 48 `TEAM_IDS` has an entry in the combined "identity + map" resolver. If a team is missing, the test fails — the same pattern already used for i18n team name coverage.

## Grace-period lock (editability)

`src/espn/graceLock.ts` exports:

```ts
export function isMatchEditable(
  match: GroupMatch | KnockoutMatch,
  ctx: {
    autoSyncEnabled: boolean;
    circuitBreakerTripped: boolean;
    autoSyncedAt: Record<string, number>; // matchId → timestamp of last auto-sync apply
    now: number;
  },
): boolean;
```

Returns `true` when any of:
- `!ctx.autoSyncEnabled`
- `ctx.circuitBreakerTripped`
- `match.result === null` AND `ctx.now > kickoff(match) + gracePeriod(match)`

`gracePeriod(match)` returns 3 h for `GroupMatch`, 4.5 h for `KnockoutMatch`.

All score-editing UI components (`GroupView`, `BracketView`, `ScheduleView`) call this helper and set `disabled` / `readOnly` on inputs accordingly. The disabled state has a tooltip: *"Esperando resultado automático — disponible para edición a las HH:MM si no llega"*.

In predictions mode the function is not consulted; predictions remain editable subject to `lockTime` only.

## Polling lifecycle

`useAutoResultSync()` sets up:

- An interval of `AUTOSYNC_INTERVAL_MS = 30 * 60 * 1000`.
- A `visibilitychange` listener: pause ticks when hidden; on resume, if more than `AUTOSYNC_INTERVAL_MS` elapsed since `lastFetchAt`, fire immediately.
- A first tick on mount, subject to gates.
- Cleanup on unmount (clear interval, abort in-flight).

Tournament window is defined in `tournamentWindow.ts` as a closed interval `[2026-06-10T00:00Z, 2026-07-20T23:59Z]`. Outside the window, the hook is effectively idle — no fetches, no interval.

## Circuit breaker

Persisted state in `localStorage["wc2026-autosync-breaker"]`: `{ tripped: boolean, trippedAt: number | null, reason: string | null }`.

Trip conditions:
- A single tick where `skipped.length > appliedAndExistingMatches.length * 2 && skipped.length >= 3`. Typical cause: ESPN schema drift breaking validation en masse.
- 5 consecutive ticks with zero events returned during a period where the tournament is known to have matches (use `tournamentWindow.expectedMatchesOnDate(day)` as the reference — if ESPN returns nothing for a day that should have 2+ matches, that's a signal).

Reset conditions:
- User clicks "Re-enable auto-sync" in settings.
- Manual toggle OFF then ON.
- App reload after 24 h since trip (optimistic retry).

While tripped: hook does not fetch, all match inputs unlock via `isMatchEditable`, and a persistent small banner appears in the admin's view. No-op banner for pure prediction users to reduce noise — they never edit results anyway.

## UX surface

### Settings (new view)

Accessible from a new "Configuración" entry in the main nav menu (or folded into the existing `AccountModal` as a new section — exact placement decided during plan writing). Contents:

```
Auto-sync de resultados
  [ toggle ]  Actualizar resultados automáticamente
              Trae los resultados desde ESPN cada 30 min.

  Último fetch: hace 12 min · 48/48 matches OK
  (Si el circuit breaker está tripped: "Auto-sync pausado — verificar")

  [ Verificar auto-sync ]
     Corre un fetch de diagnóstico contra fifa.world
     y reporta "N/M matches reconocidos" con razones
     de cada skip. No modifica el prode.
```

The "Verificar auto-sync" button calls the same `client.fetchScoreboard` + `parser` + `validator` + `matcher` pipeline the hook uses, but writes nothing — renders a diff in a dialog.

### Tooltip on auto-synced scores

For any match whose `matchId` has an entry in `autoSyncedAt`, hovering the score shows:

> *Actualizado automáticamente desde ESPN el 15 jun, 18:47.*

No persistent badge or icon. Zero visual noise at rest.

### Locked-input tooltip

When a match's result input is disabled under the grace-period rule, hovering shows:

> *Esperando resultado automático. Disponible para edición a las HH:MM si no llega.*

### Circuit-breaker toast (one per session)

When the breaker trips during a session, a non-blocking toast renders once:

> *⚠ Auto-sync pausado: los resultados de ESPN no coinciden con el fixture. Podés re-activarlo en Configuración.*

### Dev inspector (hidden)

Route `/dev/autosync`, activated only when the URL contains `?devSync=1` on first load of the session (same activation pattern as `devClock`). Not linked from any visible UI. Renders a form:

```
League: [ fifa.world ▼ ]  Dates: [ 20260614 ]
        options: fifa.world, eng.1, esp.1, uefa.champions,
                 uefa.europa, fifa.wwc, usa.1, mex.1

[ Fetch ]

Response: 18 events returned

✓ ARG 2-1 MEX (G-B-1)   status: STATUS_FULL_TIME
✓ FRA 3-0 AUS (G-D-1)   status: STATUS_FULL_TIME
✗ event #9832918        skip: unknown_team_code "WAL"
✗ event #9832919        skip: status IN_PROGRESS
- BRA 0-0 SRB (G-G-1)   idempotent (already has result)

Raw JSON: [ expand ]
```

Read-only: its output never hits `dispatch`. Its purpose is pre-launch rehearsal — point at Champions League or Premier League in April/May 2026 to confirm schema, CORS, status transitions, and penalty parsing against real live data.

## Testing strategy

### Layer 1 — Unit with recorded fixtures

`src/espn/__fixtures__/` contains real JSON snapshots from ESPN. Initial set:

- `wc2022-group-arg-mex.json` — normal FT group match.
- `wc2022-ko-cro-jpn-pen.json` — knockout ending in penalties.
- `champions-semi-in-progress.json` — a live-at-capture match to test IN_PROGRESS skip.
- `wc2022-day-empty.json` — a date with no matches.
- `malformed-one-competitor.json` — synthetic edge case.
- `espn-code-drift-unknown-team.json` — synthetic, an abbreviation not in our map.

Test files under `src/espn/__tests__/`:

- `parser.test.ts` — each fixture parses; event counts and basic fields match.
- `validator.test.ts` — the accept/reject matrix of §Validation.
- `normalizer.test.ts` — the 48-team coverage consistency test.
- `matcher.test.ts` — successful matches map to exactly one fixture row; synthetic mismatched cases skip.
- `graceLock.test.ts` — `isMatchEditable` truth table against time/flag combinations.

### Layer 2 — Dev inspector

Not unit-tested (it's a diagnostic tool). Its dependencies are unit-tested in Layer 1.

### Layer 3 — Pre-flight and settings test

`SettingsPanel.test.tsx` renders with a mocked `fetchScoreboard` and asserts "Verify auto-sync" correctly renders `N/M matches` and lists reasons. Smoke test only — the real value of this feature is manual use.

### Optional — live contract test

`src/espn/__tests__/live.contract.test.ts` runs only when `LIVE_ESPN=1` is set. It fetches a known past date (WC 2022 final, 2022-12-18) from live ESPN and asserts the response still parses, validates, and matches at least one expected team pair. Not in the default CI loop; a manual safety check for schema drift over time.

## Error handling

Nothing that this feature does is allowed to crash the app. Every failure path degrades to "do nothing, log, retry next tick".

| Failure | Action |
|---|---|
| Network error, DNS, timeout | Log `[autosync] network: <msg>`, skip tick. |
| HTTP 4xx/5xx | Idem. Extra warn on 429 (rate limit observed). |
| JSON parse error | Log, increment consecutive-failures, skip. 3 in a row → circuit breaker. |
| Event validation fail | Log `[autosync] skip <eventId>: <reason>`, continue with next event. |
| Unknown team code | Log the unknown code so the map can be extended. |
| Many skips vs applies in one tick | Trip circuit breaker, surface toast. |
| Unexpected throw in hook | Caught at the top level, log `[autosync] unexpected`, skip tick. The interval survives. |

All logs use `console.warn` prefixed `[autosync]` for easy DevTools filtering. Nothing is sent off-device.

## Non-goals

- **No live in-progress score streaming.** We only apply FT/AET/PEN. Showing minute-by-minute scores is out of scope for a once-per-30-min prediction app.
- **No betting odds, player stats, or scorer lists.** The API carries much more data; we take only final scores and penalty shootouts.
- **No retry/backoff mathematics beyond the circuit breaker.** Fixed 30-min interval; a failed tick simply waits for the next one.
- **No admin-push of API-sourced results separate from manual ones.** The existing Nostr push just sees a changed score and publishes it; it does not need to know the source.
- **No change to `syncedResultIds` semantics.** It keeps its current meaning (used by `CLEAR_SYNCED_RESULTS` to wipe stale admin-pushed results). Auto-sync does not read or write it.
- **No fallback to TheSportsDB in v1.** If ESPN breaks we fall back to manual input via the circuit breaker. A secondary API source can be added later as a separate feature.

## Open questions to resolve during plan writing

1. Exact placement of the "Configuración" entry (new nav item vs. `AccountModal` section).
2. Whether `SET_GROUP_SCORE`/`SET_KNOCKOUT_SCORE` must also add to `syncedResultIds` locally for admins — depends on whether the current round-trip gap can ever interleave with a tick. Likely a non-issue given §Decisions(6), but worth confirming by reading `FixtureContext.tsx` and `useNostrSync.ts` together.
3. Exact ESPN status string constants — the list in §Validation is a best guess; first dev-inspector runs will pin them down. Treat as a tuning task, not a design question.
4. Whether the circuit-breaker banner shows to non-admin members in a room at all, or only to admins (lean: admins only, but confirm).
