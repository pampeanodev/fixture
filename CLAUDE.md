# CLAUDE.md

Entry point for agents working on this repo. Keep this file short. When you need depth, open the reference linked below.

## What this project is

**Mundial 2026 — Fixture & Prode.** Client-only React 19 + TypeScript + Vite SPA. Users predict the 104 matches of the World Cup, compete with friends via Nostr P2P sync (no backend), and track a ranking. PWA, installable.

**Stack**: React 19, TypeScript 6, Vite 8, Vitest, `nostr-tools` 2, `@noble/hashes`, `qrcode`, `driver.js`, vanilla CSS, `vite-plugin-pwa`.

## Where to start by task

| If you're doing… | Read |
|---|---|
| Adding/editing user-facing strings | [`docs/reference/i18n.md`](docs/reference/i18n.md) |
| Adding a language, changing plural rules, or touching `Trans` | [`docs/reference/i18n.md`](docs/reference/i18n.md) |
| Rooms, invites, commit-reveal, relay pool, admin push | [`docs/reference/nostr-sync.md`](docs/reference/nostr-sync.md) |
| Scoring formula, ranking order, simulator deltas | [`docs/reference/ranking-scoring.md`](docs/reference/ranking-scoring.md) |
| Group standings, best-thirds algorithm, knockout propagation, match lock | [`docs/reference/business-rules.md`](docs/reference/business-rules.md) |
| Why a feature was designed the way it was | [`docs/superpowers/specs/`](docs/superpowers/specs/) |

The `specs/` dir is design rationale (the "why"); `reference/` dir is current-state maps of the code (the "how it is today"). If both exist for a feature, the reference doc takes precedence when they disagree — code evolves, specs don't.

## Commands

```
pnpm install        # one-time
pnpm run dev        # http://localhost:5173
pnpm test           # vitest run (161 tests)
pnpm lint           # eslint — 9 pre-existing errors, do not add new ones
pnpm run build      # tsc -b && vite build, writes to dist/
```

## Hard rules

- **Types**: never use `any`. Use `unknown` at boundaries and narrow. Use `satisfies` over type assertions when possible.
- **Commits**: only when the user asks. Never `Co-Authored-By`. Never `--amend` a pushed commit. Never `--no-verify` or skip pre-commit hooks.
- **State**: `FixtureState` is a reducer, mutations go through `dispatch`. Read `src/types.ts` for the action union.
- **Dates**: never call `toLocaleString("es-AR", ...)` or similar — use `formatDate`/`formatTime` from `useLocale()`.
- **Team names**: never hardcode. Resolve via `` t(`teams.${team.id}`) ``.
- **No UI libraries**: project stays vanilla CSS. Don't introduce Tailwind, MUI, Radix, etc.

## Code map (top-level tour)

```
src/
├── types.ts                 # All shared TS interfaces + FixtureAction union
├── main.tsx                 # Provider stack (Locale > Nostr > Fixture > App)
├── App.tsx                  # Top-level routing + InviteRouter + TourBridge
├── i18n/                    # Locale system — see docs/reference/i18n.md
├── nostr/                   # Nostr sync layer — see docs/reference/nostr-sync.md
├── context/
│   ├── FixtureContext.tsx   # Reducer + localStorage persistence
│   └── NostrContext.tsx     # Identity, rooms, relay connection status
├── hooks/
│   └── useNostrSync.ts      # Bridge: relay subscriptions ↔ FixtureContext dispatches
├── utils/
│   ├── standings.ts         # Group standings computation (points, GD, GF)
│   ├── bestThirds.ts        # Rank the 12 third-placed teams, pick top 8
│   ├── knockout.ts          # Resolve R32→F teams from group predictions
│   ├── scoring.ts           # scoreMatch + computeRanking — see docs/reference/ranking-scoring.md
│   ├── lockTime.ts          # 1h-before-kickoff gate
│   ├── devClock.ts          # Dev-only time override for testing
│   └── persistence.ts       # JSON export/import of the fixture state
├── simulator/               # Match simulator (ratings + Poisson) — live-play the tournament
├── tour/                    # driver.js guided tours (overview + 4 contextual)
├── data/
│   ├── teams.ts             # 48 teams: id (TeamId literal), flag, group
│   ├── groupMatches.ts      # 72 group matches with dateUtc, venue
│   ├── knockoutStructure.ts # 32 knockout matches with KnockoutSlot definitions
│   └── thirdPlaceMapping.ts # Best-thirds slot assignment algorithm
└── components/              # All React components, one .tsx + .css per component
```

## Testing conventions

- Tests live in `__tests__/` alongside the module they cover.
- Pure logic is unit-tested (`utils/`, `simulator/`, `nostr/`, `i18n/`). Components are not — integration is verified via `pnpm run build` + manual smoke in dev.
- When adding logic to a `utils/*.ts` or `simulator/*.ts` file, add tests in the matching `__tests__/*.test.ts`.
- i18n has two consistency tests that run on every `pnpm test`: they fail if a key is missing in EN/PT vs ES, or if a team has no name entry in any locale.

## Gotchas

- **jsdom vs real browser**: `detectLocale()` treats `navigator.languages === []` as "unsupported" and falls back to `es`. In real browsers this array is always non-empty; the handling exists for tests.
- **Provider nesting matters**: `LocaleProvider` wraps `NostrProvider` wraps `FixtureProvider`. `useNostrSync` in `App` depends on both lower providers being available. Don't rearrange.
- **Knockout mutation semantics**: `resolveKnockoutTeams` in `utils/knockout.ts` returns a new array but mutates the items inside. Callers should treat the result as "fresh data"; don't hold references to the input matches.
- **Simulation is ephemeral**: `ENTER_SIMULATION` snapshots real state; `EXIT_SIMULATION` restores. Reloading the browser also restores. Don't persist sim-state to localStorage.
- **First paint flash**: `index.html` is hardcoded Spanish. The Provider overwrites `<title>` and `<meta description>` on mount — ~50ms flash if the detected locale isn't ES. Acceptable trade-off, documented in the i18n spec.
