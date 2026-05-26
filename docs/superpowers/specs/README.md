# Spec Registry

Each spec in this directory documents the design rationale ("the why") for a part of the system. Naming follows a **feature ID + slug** scheme:

```
fX.Y-<slug>.md
```

- `fX` = top-level area (one of the rows below)
- `Y` = sub-feature index within that area, incrementing as specs are added
- `<slug>` = short kebab-case name describing the feature

Examples: `f1.1-i18n-locale-system.md`, `f2.3-relay-pool-rotation.md`.

## Areas

| ID | Area | Scope | Code under |
|----|------|-------|------------|
| **f0** | Core fixture | Tournament data shape, state reducer, persistence to localStorage. Foundational pieces every other area depends on. | `src/data/`, `src/context/FixtureContext.tsx`, `src/types.ts` |
| **f1** | i18n | Locale detection, message bundles (es/en/pt), `Trans` component, plural rules, team-name resolution. | `src/i18n/` |
| **f2** | Nostr sync | Rooms, invites, identity, commit-reveal protocol, relay pool, outbox, admin push. | `src/nostr/`, `src/hooks/useNostrSync.ts` |
| **f3** | Simulator | Ephemeral match simulator (ratings + Poisson), snapshot/restore of fixture state. | `src/simulator/` |
| **f4** | Onboarding | First-run flow, driver.js guided tours, "How to play" panel. | `src/tour/`, `src/components/Onboarding.tsx`, `src/components/HowToPlay.tsx` |
| **f5** | UI views | Top-level views (Group, Schedule, Bracket, Ranking), compact mode, bracket tree, top bar. | `src/components/{Group,Schedule,Bracket,Ranking,Compact*,TopBar}*` |
| **f6** | Scoring & business rules | Match scoring, group standings tiebreakers, best-thirds, knockout propagation, match lock window. | `src/utils/{scoring,standings,bestThirds,knockout,lockTime}.ts` |
| **f7** | Auto-results sync | ESPN HTTP integration: parser, validator, matcher, circuit breaker, grace lock, tournament window. | `src/espn/` |
| **f8** | Infra | PWA setup, dev clock override, JSON export/import. Non-user-facing plumbing. | `src/utils/{devClock,persistence}.ts`, `vite.config.ts` |

## Reserved sub-feature IDs

When you start a new spec, reserve the next available `Y` under your area and add it here BEFORE writing the spec. This prevents collisions if two specs are drafted in parallel.

| ID | Slug | File | Created |
|----|------|------|---------|
| f0.1 | core-fixture-foundation | `f0.1-core-fixture-foundation.md` | 2026-04-12 |
| f1.1 | i18n-locale-system | `f1.1-i18n-locale-system.md` | 2026-04-21 |
| f2.1 | nostr-sync-protocol | `f2.1-nostr-sync-protocol.md` | 2026-04-14 |
| f3.1 | simulator | `f3.1-simulator.md` | 2026-04-18 |
| f4.1 | how-to-play-panel | `f4.1-how-to-play-panel.md` | 2026-04-22 |
| f4.2 | mobile-tour-fix | `f4.2-mobile-tour-fix.md` | 2026-04-22 |
| f5.1 | compact-views | `f5.1-compact-views.md` | 2026-05-26 |
| f7.1 | auto-results-sync | `f7.1-auto-results-sync.md` | 2026-04-22 |

## Frontmatter

Each spec must start with:

```yaml
---
id: f1.2
area: i18n
slug: trans-component
created: 2026-05-30
status: draft | approved | shipped | superseded
supersedes: f1.1   # optional
---
```

The `created` field preserves chronological order now that the date is no longer in the filename.

## When to add an area vs a sub-feature

- **New sub-feature** (`fX.Y+1`): the work belongs squarely inside an existing area's scope.
- **New area** (`fX+1`): the work is a new cross-cutting system (e.g., adding a "Tournaments other than World Cup" backend would be a new `f9`). Adding a new area requires editing this README and getting the change reviewed — areas are meant to be stable.

## Relationship to `docs/reference/`

- **`specs/`** = design rationale, snapshots in time, "why we built it this way". Specs do NOT update as code evolves.
- **`docs/reference/`** = current-state maps of the code, "how it is today". Reference docs DO update.
- When both exist for a feature and disagree, **reference takes precedence**.

## Relationship to `plans/`

Plans (in `docs/superpowers/plans/`) keep date-prefixed names (`YYYY-MM-DD-<slug>.md`) — they're time-bound execution artifacts, not feature specs. Feature ID scheme does not apply to plans.
