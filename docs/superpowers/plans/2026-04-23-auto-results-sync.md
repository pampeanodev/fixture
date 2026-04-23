# Auto Results Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-populate real match results by polling ESPN's public API every 30 minutes from each client, eliminating manual admin entry while preserving it as a fallback.

**Architecture:** A new `src/espn/` module with pure, independently-tested pieces (types → normalizer → validator → parser → client → matcher → tournament window → grace lock → circuit breaker → meta persistence). A single orchestrator hook `useAutoResultSync` wires them to `FixtureContext.dispatch`, reusing the existing `SET_GROUP_SCORE` / `SET_KNOCKOUT_SCORE` actions so `useNostrSync` publishes admin results without modification. UI changes are additive: a `SettingsModal`, `isMatchEditable` plumbed through `ScoreInput`, a tooltip on auto-synced scores, a circuit-breaker banner, and a dev-only inspector gated by `?devSync=1`.

**Tech Stack:** React 19, TypeScript 6, Vitest, vanilla CSS. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-22-auto-results-sync-design.md`

---

## Preconditions

- `pnpm install` has been run.
- `pnpm test` passes on base branch.
- `pnpm run build` passes on base branch.
- Working directory is a git worktree or clean branch dedicated to this feature.

## Relevant code already read during planning

- `src/context/FixtureContext.tsx` — `SET_GROUP_SCORE` / `SET_KNOCKOUT_SCORE` handlers already treat any write in `results` mode as a "local override" and strip the match id from `syncedResultIds`. Auto-sync dispatches therefore look identical to manual typing to the reducer. Under the "API only fills voids" rule, this is safe: auto-sync only writes when `match.result === null`, so the id was not meaningfully in `syncedResultIds` anyway.
- `src/hooks/useNostrSync.ts` — debounced 2 s effect at the bottom calls `publishResults()` on any `state.groupMatches` / `state.knockoutMatches` change. Auto-sync dispatches trigger this automatically when the user is a room admin. No changes needed in `useNostrSync`.
- `src/utils/devClock.ts` — all dev-only code gated by `import.meta.env.DEV`. The auto-sync inspector follows the same pattern.
- `src/components/ScoreInput.tsx` — existing input component used by `GroupView`, `BracketView`, `ScheduleView`. We add a `disabled` prop (if not already present) and a `lockedReason` tooltip prop to surface the grace-period lock message.

## File structure (reference)

```
src/
├── espn/                                   (NEW — entire module)
│   ├── types.ts                            (Task 1)
│   ├── tournamentWindow.ts                 (Task 2)
│   ├── normalizer.ts                       (Task 3)
│   ├── validator.ts                        (Task 4)
│   ├── parser.ts                           (Task 5)
│   ├── client.ts                           (Task 6)
│   ├── matcher.ts                          (Task 7)
│   ├── graceLock.ts                        (Task 8)
│   ├── circuitBreaker.ts                   (Task 9)
│   ├── autoSyncMeta.ts                     (Task 10)
│   ├── __fixtures__/
│   │   ├── wc2022-group-arg-mex.json       (Task 5)
│   │   ├── wc2022-ko-cro-jpn-pen.json      (Task 5)
│   │   ├── wc2022-day-empty.json           (Task 5)
│   │   ├── malformed-one-competitor.json   (Task 4)
│   │   └── unknown-team-code.json          (Task 3)
│   └── __tests__/
│       ├── tournamentWindow.test.ts        (Task 2)
│       ├── normalizer.test.ts              (Task 3)
│       ├── validator.test.ts               (Task 4)
│       ├── parser.test.ts                  (Task 5)
│       ├── matcher.test.ts                 (Task 7)
│       ├── graceLock.test.ts               (Task 8)
│       └── circuitBreaker.test.ts          (Task 9)
├── hooks/
│   └── useAutoResultSync.ts                (Task 11)
├── components/
│   ├── SettingsModal.tsx                   (Task 13)
│   ├── SettingsModal.css                   (Task 13)
│   ├── AutoSyncBanner.tsx                  (Task 14)
│   ├── AutoSyncBanner.css                  (Task 14)
│   ├── AutoSyncInspector.tsx               (Task 15)
│   ├── AutoSyncInspector.css               (Task 15)
│   ├── ScoreInput.tsx                      (MODIFIED — Task 12)
│   ├── GroupView.tsx                       (MODIFIED — Task 12)
│   ├── BracketView.tsx                     (MODIFIED — Task 12)
│   ├── ScheduleView.tsx                    (MODIFIED — Task 12)
│   └── SidebarFooter.tsx                   (MODIFIED — Task 13)
├── App.tsx                                 (MODIFIED — Task 16)
└── i18n/locales/
    ├── es.ts                               (MODIFIED — Task 13)
    ├── en.ts                               (MODIFIED — Task 13)
    └── pt.ts                               (MODIFIED — Task 13)
```

---

## Task 1: ESPN schema types

**Files:**
- Create: `src/espn/types.ts`

- [ ] **Step 1: Write the types file**

Create `src/espn/types.ts` with the normalized schema our pipeline works on. We intentionally do NOT model ESPN's raw API shape here — the parser in Task 5 turns raw JSON into these types.

```ts
// src/espn/types.ts

// Our normalized, pipeline-internal representation of one ESPN event.
// The parser (parser.ts) turns raw ESPN JSON into this shape; every module
// downstream (validator, matcher) consumes only this.
export interface EspnEvent {
  id: string;                 // ESPN event id (opaque; used for logging only)
  dateUtc: string;            // ISO 8601
  statusName: EspnStatusName; // narrowed from status.type.name; see below
  home: EspnCompetitor;
  away: EspnCompetitor;
  shootout?: { home: number; away: number }; // present only when statusName === "STATUS_FINAL_PEN"
}

export interface EspnCompetitor {
  abbreviation: string; // ESPN's team code, e.g. "ARG"; normalized to TeamId downstream
  score: number;        // regulation or final score depending on status
}

// Closed set we recognize. Anything else is treated as non-terminal and skipped
// by the validator. Exact values are sourced from ESPN via the dev inspector;
// the list below is the best-known set as of planning.
export type EspnStatusName =
  | "STATUS_FULL_TIME"
  | "STATUS_FINAL"
  | "STATUS_FINAL_AET"
  | "STATUS_FINAL_PEN"
  | "STATUS_SCHEDULED"
  | "STATUS_IN_PROGRESS"
  | "STATUS_HALFTIME"
  | "STATUS_POSTPONED"
  | "STATUS_FORFEIT"
  | "STATUS_CANCELED"
  | "STATUS_UNKNOWN";

// Raw ESPN scoreboard shape, subset we rely on. Source: ESPN Site API v3.
// We keep this loose (many fields unknown, not our concern) — the parser's job
// is to project it into EspnEvent.
export interface EspnRawScoreboard {
  events?: EspnRawEvent[];
}

export interface EspnRawEvent {
  id?: string;
  date?: string;
  status?: {
    type?: {
      name?: string;
      completed?: boolean;
      state?: string;
    };
  };
  competitions?: Array<{
    competitors?: EspnRawCompetitor[];
    status?: {
      type?: {
        name?: string;
      };
    };
    details?: unknown; // shootout info lives here or in a sibling — parser figures it out
  }>;
}

export interface EspnRawCompetitor {
  homeAway?: string;
  score?: string | number;
  team?: {
    abbreviation?: string;
  };
  shootoutScore?: number; // some ESPN payloads put shootout here
}

// Terminal statuses that indicate a final, recordable result.
export const TERMINAL_STATUSES: ReadonlySet<EspnStatusName> = new Set([
  "STATUS_FULL_TIME",
  "STATUS_FINAL",
  "STATUS_FINAL_AET",
  "STATUS_FINAL_PEN",
]);
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm run build`
Expected: success (no consumer yet; we just need tsc to accept the file).

- [ ] **Step 3: Commit**

```bash
git add src/espn/types.ts
git commit -m "feat(espn): add internal schema types for auto-sync pipeline"
```

---

## Task 2: Tournament window

**Files:**
- Create: `src/espn/tournamentWindow.ts`
- Create: `src/espn/__tests__/tournamentWindow.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/espn/__tests__/tournamentWindow.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  isWithinTournamentWindow,
  buildFetchDates,
  expectedMatchesOnDate,
  TOURNAMENT_START_MS,
  TOURNAMENT_END_MS,
} from "../tournamentWindow";
import { INITIAL_GROUP_MATCHES } from "../../data/groupMatches";
import { INITIAL_KNOCKOUT_MATCHES } from "../../data/knockoutStructure";

describe("isWithinTournamentWindow", () => {
  it("returns false the day before the start", () => {
    expect(isWithinTournamentWindow(TOURNAMENT_START_MS - 24 * 60 * 60 * 1000)).toBe(false);
  });

  it("returns true on start day", () => {
    expect(isWithinTournamentWindow(TOURNAMENT_START_MS)).toBe(true);
  });

  it("returns true on end day", () => {
    expect(isWithinTournamentWindow(TOURNAMENT_END_MS)).toBe(true);
  });

  it("returns false the day after the end", () => {
    expect(isWithinTournamentWindow(TOURNAMENT_END_MS + 24 * 60 * 60 * 1000)).toBe(false);
  });
});

describe("buildFetchDates", () => {
  it("returns an ESPN-formatted range spanning today ± 3 days", () => {
    // 2026-06-15T14:00:00Z → window 2026-06-12 to 2026-06-18
    const now = Date.UTC(2026, 5, 15, 14, 0, 0);
    expect(buildFetchDates(now)).toBe("20260612-20260618");
  });

  it("zero-pads days and months", () => {
    const now = Date.UTC(2026, 0, 5, 0, 0, 0);
    expect(buildFetchDates(now)).toBe("20260102-20260108");
  });
});

describe("expectedMatchesOnDate", () => {
  it("counts matches scheduled on a given UTC date across the fixture", () => {
    const allMatches = [...INITIAL_GROUP_MATCHES, ...INITIAL_KNOCKOUT_MATCHES];
    // Pick the date of the first group match and assert it returns ≥ 1
    const first = INITIAL_GROUP_MATCHES[0];
    const count = expectedMatchesOnDate(new Date(first.dateUtc).getTime(), allMatches);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("returns 0 for a date with no scheduled matches", () => {
    const allMatches = [...INITIAL_GROUP_MATCHES, ...INITIAL_KNOCKOUT_MATCHES];
    // A day before the tournament.
    const before = Date.UTC(2026, 0, 1);
    expect(expectedMatchesOnDate(before, allMatches)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/espn/__tests__/tournamentWindow.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the module**

Create `src/espn/tournamentWindow.ts`:

```ts
// src/espn/tournamentWindow.ts
import type { GroupMatch, KnockoutMatch } from "../types";

// Closed interval. End-day inclusive. Values are UTC midnight.
export const TOURNAMENT_START_MS = Date.UTC(2026, 5, 10, 0, 0, 0); // 2026-06-10
export const TOURNAMENT_END_MS = Date.UTC(2026, 6, 20, 23, 59, 59); // 2026-07-20

export function isWithinTournamentWindow(nowMs: number): boolean {
  return nowMs >= TOURNAMENT_START_MS && nowMs <= TOURNAMENT_END_MS;
}

function yyyymmdd(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export function buildFetchDates(nowMs: number): string {
  const dayMs = 24 * 60 * 60 * 1000;
  const start = nowMs - 3 * dayMs;
  const end = nowMs + 3 * dayMs;
  return `${yyyymmdd(start)}-${yyyymmdd(end)}`;
}

export function expectedMatchesOnDate(
  dateMs: number,
  allMatches: ReadonlyArray<GroupMatch | KnockoutMatch>,
): number {
  const target = new Date(dateMs);
  const y = target.getUTCFullYear();
  const m = target.getUTCMonth();
  const d = target.getUTCDate();
  return allMatches.filter((match) => {
    const md = new Date(match.dateUtc);
    return (
      md.getUTCFullYear() === y &&
      md.getUTCMonth() === m &&
      md.getUTCDate() === d
    );
  }).length;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/espn/__tests__/tournamentWindow.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/espn/tournamentWindow.ts src/espn/__tests__/tournamentWindow.test.ts
git commit -m "feat(espn): add tournament window helpers"
```

---

## Task 3: Team code normalizer

**Files:**
- Create: `src/espn/normalizer.ts`
- Create: `src/espn/__tests__/normalizer.test.ts`
- Create: `src/espn/__fixtures__/unknown-team-code.json`

- [ ] **Step 1: Record the synthetic unknown-team fixture**

Create `src/espn/__fixtures__/unknown-team-code.json`:

```json
{
  "events": [
    {
      "id": "synthetic-unknown-1",
      "date": "2026-06-15T18:00:00Z",
      "status": { "type": { "name": "STATUS_FULL_TIME", "completed": true, "state": "post" } },
      "competitions": [
        {
          "competitors": [
            { "homeAway": "home", "score": "2", "team": { "abbreviation": "ZZZ" } },
            { "homeAway": "away", "score": "1", "team": { "abbreviation": "ARG" } }
          ]
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Write failing tests**

Create `src/espn/__tests__/normalizer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeTeamCode, ESPN_TEAM_CODE_MAP } from "../normalizer";
import { TEAM_IDS } from "../../data/teams";

describe("normalizeTeamCode", () => {
  it("returns the TeamId directly when abbreviation matches", () => {
    expect(normalizeTeamCode("ARG")).toBe("ARG");
    expect(normalizeTeamCode("BRA")).toBe("BRA");
  });

  it("is case-insensitive", () => {
    expect(normalizeTeamCode("arg")).toBe("ARG");
    expect(normalizeTeamCode("Brazilian".slice(0, 3).toUpperCase())).toBe("BRA");
  });

  it("returns null for unknown codes", () => {
    expect(normalizeTeamCode("ZZZ")).toBeNull();
    expect(normalizeTeamCode("")).toBeNull();
  });

  it("returns null for nullish input", () => {
    expect(normalizeTeamCode(undefined)).toBeNull();
  });

  it("applies the override map when present", () => {
    // If we ever map e.g. "WAL" → "WAL" or any override, test one. At minimum
    // the table's values are all in TEAM_IDS.
    for (const mapped of Object.values(ESPN_TEAM_CODE_MAP)) {
      expect(TEAM_IDS).toContain(mapped);
    }
  });
});

describe("ESPN_TEAM_CODE_MAP coverage", () => {
  // Consistency test: for every TeamId, there must be SOME ESPN code that
  // normalizes to it (either identity match, or via the override map).
  it("every TeamId is reachable from at least one ESPN code", () => {
    const reachable = new Set<string>();
    for (const id of TEAM_IDS) {
      // Identity path: the 3-letter id itself.
      if (normalizeTeamCode(id) === id) reachable.add(id);
    }
    for (const [, teamId] of Object.entries(ESPN_TEAM_CODE_MAP)) {
      reachable.add(teamId);
    }
    const missing = TEAM_IDS.filter((id) => !reachable.has(id));
    expect(missing).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run: `pnpm test src/espn/__tests__/normalizer.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement the normalizer**

Create `src/espn/normalizer.ts`:

```ts
// src/espn/normalizer.ts
import { TEAM_IDS } from "../data/teams";
import type { TeamId } from "../types";

// Overrides for ESPN codes that don't match our FIFA 3-letter TeamIds.
// This table is populated during dev-inspector rehearsal. Start empty;
// the normalizer test fails if a team becomes unreachable, prompting an
// entry here.
//
// KEY = raw ESPN abbreviation (upper-cased, as the normalizer upper-cases
// its input before lookup). VALUE = our TeamId.
export const ESPN_TEAM_CODE_MAP: Readonly<Record<string, TeamId>> = Object.freeze({
  // Example shape (no known overrides at planning time):
  // "USA": "USA",
  // "KOR": "KOR",
});

const TEAM_ID_SET: ReadonlySet<string> = new Set(TEAM_IDS);

export function normalizeTeamCode(raw: string | undefined | null): TeamId | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase();
  if (upper.length === 0) return null;

  const mapped = ESPN_TEAM_CODE_MAP[upper];
  if (mapped) return mapped;

  if (TEAM_ID_SET.has(upper)) return upper as TeamId;

  return null;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test src/espn/__tests__/normalizer.test.ts`
Expected: PASS (6 tests). If the "every TeamId is reachable" test fails, note which teams are missing — those are exactly the ones that need entries in `ESPN_TEAM_CODE_MAP` once dev-inspector rehearsal reveals ESPN's code. **For planning purposes, since all 48 TeamIds are FIFA 3-letter codes, we expect this test to pass with an empty map.** If it doesn't, add an entry for each missing TeamId that maps its ESPN abbreviation back to our id.

- [ ] **Step 6: Commit**

```bash
git add src/espn/normalizer.ts src/espn/__tests__/normalizer.test.ts src/espn/__fixtures__/unknown-team-code.json
git commit -m "feat(espn): add team code normalizer with coverage test"
```

---

## Task 4: Event validator

**Files:**
- Create: `src/espn/validator.ts`
- Create: `src/espn/__tests__/validator.test.ts`
- Create: `src/espn/__fixtures__/malformed-one-competitor.json`

- [ ] **Step 1: Create the malformed fixture**

Create `src/espn/__fixtures__/malformed-one-competitor.json`:

```json
{
  "events": [
    {
      "id": "synthetic-malformed-1",
      "date": "2026-06-15T18:00:00Z",
      "status": { "type": { "name": "STATUS_FULL_TIME" } },
      "competitions": [
        {
          "competitors": [
            { "homeAway": "home", "score": "2", "team": { "abbreviation": "ARG" } }
          ]
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Write failing tests**

Create `src/espn/__tests__/validator.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateEvent } from "../validator";
import type { EspnEvent } from "../types";

function baseEvent(): EspnEvent {
  return {
    id: "e1",
    dateUtc: "2026-06-15T18:00:00Z",
    statusName: "STATUS_FULL_TIME",
    home: { abbreviation: "ARG", score: 2 },
    away: { abbreviation: "MEX", score: 1 },
  };
}

describe("validateEvent", () => {
  it("accepts a well-formed FT event", () => {
    expect(validateEvent(baseEvent())).toEqual({ ok: true });
  });

  it("rejects non-terminal status", () => {
    const ev = { ...baseEvent(), statusName: "STATUS_IN_PROGRESS" as const };
    expect(validateEvent(ev)).toEqual({ ok: false, reason: "non_terminal_status" });
  });

  it("rejects postponed", () => {
    const ev = { ...baseEvent(), statusName: "STATUS_POSTPONED" as const };
    expect(validateEvent(ev)).toEqual({ ok: false, reason: "non_terminal_status" });
  });

  it("rejects non-integer scores", () => {
    const ev = { ...baseEvent(), home: { abbreviation: "ARG", score: 2.5 } };
    expect(validateEvent(ev)).toEqual({ ok: false, reason: "invalid_score" });
  });

  it("rejects negative scores", () => {
    const ev = { ...baseEvent(), away: { abbreviation: "MEX", score: -1 } };
    expect(validateEvent(ev)).toEqual({ ok: false, reason: "invalid_score" });
  });

  it("rejects implausibly high scores", () => {
    const ev = { ...baseEvent(), home: { abbreviation: "ARG", score: 99 } };
    expect(validateEvent(ev)).toEqual({ ok: false, reason: "invalid_score" });
  });

  it("rejects PEN status without shootout", () => {
    const ev = { ...baseEvent(), statusName: "STATUS_FINAL_PEN" as const };
    expect(validateEvent(ev)).toEqual({ ok: false, reason: "missing_shootout" });
  });

  it("accepts PEN with valid shootout", () => {
    const ev: EspnEvent = {
      ...baseEvent(),
      statusName: "STATUS_FINAL_PEN",
      shootout: { home: 4, away: 3 },
    };
    expect(validateEvent(ev)).toEqual({ ok: true });
  });

  it("rejects invalid shootout values", () => {
    const ev: EspnEvent = {
      ...baseEvent(),
      statusName: "STATUS_FINAL_PEN",
      shootout: { home: 4, away: -1 },
    };
    expect(validateEvent(ev)).toEqual({ ok: false, reason: "invalid_shootout" });
  });

  it("rejects non-finite dateUtc", () => {
    const ev = { ...baseEvent(), dateUtc: "not-a-date" };
    expect(validateEvent(ev)).toEqual({ ok: false, reason: "invalid_date" });
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run: `pnpm test src/espn/__tests__/validator.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement the validator**

Create `src/espn/validator.ts`:

```ts
// src/espn/validator.ts
import type { EspnEvent } from "./types";
import { TERMINAL_STATUSES } from "./types";

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: ValidationReason };

export type ValidationReason =
  | "non_terminal_status"
  | "invalid_score"
  | "missing_shootout"
  | "invalid_shootout"
  | "invalid_date";

const MAX_SCORE = 20;
const MAX_SHOOTOUT = 30;

function isValidScore(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MAX_SCORE;
}

function isValidShootoutScore(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MAX_SHOOTOUT;
}

export function validateEvent(ev: EspnEvent): ValidationResult {
  if (!Number.isFinite(new Date(ev.dateUtc).getTime())) {
    return { ok: false, reason: "invalid_date" };
  }
  if (!TERMINAL_STATUSES.has(ev.statusName)) {
    return { ok: false, reason: "non_terminal_status" };
  }
  if (!isValidScore(ev.home.score) || !isValidScore(ev.away.score)) {
    return { ok: false, reason: "invalid_score" };
  }
  if (ev.statusName === "STATUS_FINAL_PEN") {
    if (!ev.shootout) return { ok: false, reason: "missing_shootout" };
    if (!isValidShootoutScore(ev.shootout.home) || !isValidShootoutScore(ev.shootout.away)) {
      return { ok: false, reason: "invalid_shootout" };
    }
  }
  return { ok: true };
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `pnpm test src/espn/__tests__/validator.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 6: Commit**

```bash
git add src/espn/validator.ts src/espn/__tests__/validator.test.ts src/espn/__fixtures__/malformed-one-competitor.json
git commit -m "feat(espn): add event validator with terminal-status + score sanity"
```

---

## Task 5: Parser + recorded fixtures

**Files:**
- Create: `src/espn/parser.ts`
- Create: `src/espn/__tests__/parser.test.ts`
- Create: `src/espn/__fixtures__/wc2022-group-arg-mex.json` (recorded from live ESPN)
- Create: `src/espn/__fixtures__/wc2022-ko-cro-jpn-pen.json` (recorded from live ESPN)
- Create: `src/espn/__fixtures__/wc2022-day-empty.json` (recorded or synthetic)

- [ ] **Step 1: Record the WC 2022 group fixture**

Run in a terminal:

```bash
curl -s "https://site.api.espn.com/apis/site/v3/sports/soccer/fifa.world/scoreboard?dates=20221126" \
  > src/espn/__fixtures__/wc2022-group-arg-mex.json
```

Verify the file opens and contains events with `"abbreviation": "ARG"` and `"abbreviation": "MEX"` in `competitors`. If ESPN's schema has drifted and fields are missing, adjust the parser and this task together rather than committing mismatched code.

- [ ] **Step 2: Record the WC 2022 knockout penalty fixture**

```bash
curl -s "https://site.api.espn.com/apis/site/v3/sports/soccer/fifa.world/scoreboard?dates=20221205" \
  > src/espn/__fixtures__/wc2022-ko-cro-jpn-pen.json
```

Verify it contains Croatia vs Japan and ended in penalties (status STATUS_FINAL_PEN or similar).

- [ ] **Step 3: Record an empty day fixture**

```bash
curl -s "https://site.api.espn.com/apis/site/v3/sports/soccer/fifa.world/scoreboard?dates=20260101" \
  > src/espn/__fixtures__/wc2022-day-empty.json
```

Verify `events` is empty or missing.

- [ ] **Step 4: Write failing tests**

Create `src/espn/__tests__/parser.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseScoreboard } from "../parser";
import argMex from "../__fixtures__/wc2022-group-arg-mex.json";
import croJpnPen from "../__fixtures__/wc2022-ko-cro-jpn-pen.json";
import emptyDay from "../__fixtures__/wc2022-day-empty.json";
import malformed from "../__fixtures__/malformed-one-competitor.json";

describe("parseScoreboard", () => {
  it("parses a group-stage FT match", () => {
    const events = parseScoreboard(argMex);
    const match = events.find(
      (e) =>
        (e.home.abbreviation === "ARG" && e.away.abbreviation === "MEX") ||
        (e.home.abbreviation === "MEX" && e.away.abbreviation === "ARG"),
    );
    expect(match).toBeDefined();
    expect(match?.statusName).toMatch(/FULL_TIME|FINAL/);
    expect(Number.isInteger(match?.home.score)).toBe(true);
    expect(Number.isInteger(match?.away.score)).toBe(true);
  });

  it("parses a knockout match ending in penalties and extracts shootout", () => {
    const events = parseScoreboard(croJpnPen);
    const pen = events.find(
      (e) =>
        (e.home.abbreviation === "CRO" && e.away.abbreviation === "JPN") ||
        (e.home.abbreviation === "JPN" && e.away.abbreviation === "CRO"),
    );
    expect(pen).toBeDefined();
    expect(pen?.statusName).toBe("STATUS_FINAL_PEN");
    expect(pen?.shootout).toBeDefined();
    expect(Number.isInteger(pen?.shootout?.home)).toBe(true);
    expect(Number.isInteger(pen?.shootout?.away)).toBe(true);
  });

  it("returns empty array for a day with no events", () => {
    expect(parseScoreboard(emptyDay)).toEqual([]);
  });

  it("drops events with fewer than 2 competitors", () => {
    expect(parseScoreboard(malformed)).toEqual([]);
  });

  it("returns empty array for unrelated JSON", () => {
    expect(parseScoreboard({})).toEqual([]);
    expect(parseScoreboard(null)).toEqual([]);
    expect(parseScoreboard("not json" as unknown)).toEqual([]);
  });
});
```

- [ ] **Step 5: Run tests to verify failure**

Run: `pnpm test src/espn/__tests__/parser.test.ts`
Expected: FAIL.

- [ ] **Step 6: Implement the parser**

Create `src/espn/parser.ts`:

```ts
// src/espn/parser.ts
import type {
  EspnEvent,
  EspnRawScoreboard,
  EspnRawEvent,
  EspnRawCompetitor,
  EspnStatusName,
} from "./types";

const KNOWN_STATUSES: ReadonlySet<EspnStatusName> = new Set<EspnStatusName>([
  "STATUS_FULL_TIME",
  "STATUS_FINAL",
  "STATUS_FINAL_AET",
  "STATUS_FINAL_PEN",
  "STATUS_SCHEDULED",
  "STATUS_IN_PROGRESS",
  "STATUS_HALFTIME",
  "STATUS_POSTPONED",
  "STATUS_FORFEIT",
  "STATUS_CANCELED",
  "STATUS_UNKNOWN",
]);

function narrowStatus(raw: string | undefined): EspnStatusName {
  if (raw && (KNOWN_STATUSES as Set<string>).has(raw)) return raw as EspnStatusName;
  return "STATUS_UNKNOWN";
}

function toScore(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === "string") {
    const n = Number(raw);
    return Number.isFinite(n) ? Math.trunc(n) : NaN;
  }
  return NaN;
}

function extractShootout(
  home: EspnRawCompetitor | undefined,
  away: EspnRawCompetitor | undefined,
): { home: number; away: number } | undefined {
  if (!home || !away) return undefined;
  const h = home.shootoutScore;
  const a = away.shootoutScore;
  if (typeof h === "number" && typeof a === "number") return { home: h, away: a };
  return undefined;
}

function parseRawEvent(raw: EspnRawEvent): EspnEvent | null {
  if (!raw || typeof raw !== "object") return null;

  const comp = raw.competitions?.[0];
  const competitors = comp?.competitors ?? [];
  if (competitors.length < 2) return null;

  const home = competitors.find((c) => c.homeAway === "home") ?? competitors[0];
  const away = competitors.find((c) => c.homeAway === "away") ?? competitors[1];

  const homeAbbr = home.team?.abbreviation;
  const awayAbbr = away.team?.abbreviation;
  if (!homeAbbr || !awayAbbr) return null;

  const statusName = narrowStatus(comp?.status?.type?.name ?? raw.status?.type?.name);

  const homeScore = toScore(home.score);
  const awayScore = toScore(away.score);
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;

  const ev: EspnEvent = {
    id: raw.id ?? "unknown",
    dateUtc: raw.date ?? "",
    statusName,
    home: { abbreviation: homeAbbr, score: homeScore },
    away: { abbreviation: awayAbbr, score: awayScore },
  };

  const shootout = extractShootout(home, away);
  if (shootout) ev.shootout = shootout;

  return ev;
}

export function parseScoreboard(raw: unknown): EspnEvent[] {
  if (!raw || typeof raw !== "object") return [];
  const events = (raw as EspnRawScoreboard).events;
  if (!Array.isArray(events)) return [];
  const out: EspnEvent[] = [];
  for (const rawEvent of events) {
    const ev = parseRawEvent(rawEvent);
    if (ev) out.push(ev);
  }
  return out;
}
```

- [ ] **Step 7: Run tests to verify pass**

Run: `pnpm test src/espn/__tests__/parser.test.ts`
Expected: PASS (5 tests).

If the penalty fixture test fails because ESPN encodes shootout scores differently than `shootoutScore`, inspect the raw JSON and adjust `extractShootout` to read from wherever ESPN puts it (e.g. a sibling `scoreFormat` or a `linescores` array). Update the type definition `EspnRawCompetitor` accordingly. Commit both together.

- [ ] **Step 8: Commit**

```bash
git add src/espn/parser.ts src/espn/__tests__/parser.test.ts src/espn/__fixtures__/
git commit -m "feat(espn): add scoreboard parser with recorded WC 2022 fixtures"
```

---

## Task 6: Client (fetch wrapper)

**Files:**
- Create: `src/espn/client.ts`

No test here — we don't mock `fetch` in this project and the caller (`useAutoResultSync`) tests the full stack end-to-end. Keep the client a tiny, untyped-fetch wrapper.

- [ ] **Step 1: Write the client**

Create `src/espn/client.ts`:

```ts
// src/espn/client.ts
import type { EspnRawScoreboard } from "./types";

const BASE_URL = "https://site.api.espn.com/apis/site/v3/sports/soccer";
const FETCH_TIMEOUT_MS = 10_000;

export class AutoSyncNetworkError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AutoSyncNetworkError";
    this.status = status;
  }
}

export interface FetchScoreboardOptions {
  leagueSlug?: string; // default "fifa.world"
  dates: string;       // "YYYYMMDD-YYYYMMDD" or "YYYYMMDD"
  signal?: AbortSignal;
}

export async function fetchScoreboard(
  opts: FetchScoreboardOptions,
): Promise<EspnRawScoreboard> {
  const { leagueSlug = "fifa.world", dates, signal } = opts;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const chained =
    signal != null
      ? new AbortController()
      : controller;
  if (signal) {
    signal.addEventListener("abort", () => chained.abort(), { once: true });
    controller.signal.addEventListener("abort", () => chained.abort(), { once: true });
  }

  try {
    const url = `${BASE_URL}/${leagueSlug}/scoreboard?dates=${encodeURIComponent(dates)}`;
    const res = await fetch(url, {
      signal: chained.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new AutoSyncNetworkError(`HTTP ${res.status}`, res.status);
    }
    return (await res.json()) as EspnRawScoreboard;
  } catch (err) {
    if (err instanceof AutoSyncNetworkError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new AutoSyncNetworkError(msg);
  } finally {
    window.clearTimeout(timeoutId);
  }
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/espn/client.ts
git commit -m "feat(espn): add fetch client with timeout + AutoSyncNetworkError"
```

---

## Task 7: Matcher

**Files:**
- Create: `src/espn/matcher.ts`
- Create: `src/espn/__tests__/matcher.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/espn/__tests__/matcher.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { matchEvent } from "../matcher";
import type { EspnEvent } from "../types";
import type { GroupMatch, KnockoutMatch } from "../../types";

function groupMatch(overrides: Partial<GroupMatch>): GroupMatch {
  return {
    id: "G-A-1",
    group: "A",
    homeTeamId: "ARG",
    awayTeamId: "MEX",
    dateUtc: "2026-06-15T18:00:00Z",
    venue: "Test",
    result: null,
    prediction: null,
    ...overrides,
  };
}

function koMatch(overrides: Partial<KnockoutMatch>): KnockoutMatch {
  return {
    id: "KO-R32-1",
    round: "R32",
    homeSlot: { type: "group", group: "A", position: 1 },
    awaySlot: { type: "group", group: "B", position: 2 },
    homeTeamId: "CRO",
    awayTeamId: "JPN",
    dateUtc: "2026-06-28T20:00:00Z",
    venue: "Test",
    result: null,
    prediction: null,
    ...overrides,
  };
}

function baseEvent(overrides: Partial<EspnEvent> = {}): EspnEvent {
  return {
    id: "e1",
    dateUtc: "2026-06-15T18:00:00Z",
    statusName: "STATUS_FULL_TIME",
    home: { abbreviation: "ARG", score: 2 },
    away: { abbreviation: "MEX", score: 1 },
    ...overrides,
  };
}

describe("matchEvent", () => {
  it("matches by team ids + date within ±2h", () => {
    const matches = [groupMatch({})];
    const result = matchEvent(baseEvent(), matches);
    expect(result).toEqual({ ok: true, matchId: "G-A-1" });
  });

  it("tolerates ±2h drift", () => {
    const matches = [groupMatch({ dateUtc: "2026-06-15T17:00:00Z" })];
    const result = matchEvent(baseEvent(), matches);
    expect(result).toEqual({ ok: true, matchId: "G-A-1" });
  });

  it("rejects drift > 2h", () => {
    const matches = [groupMatch({ dateUtc: "2026-06-15T14:00:00Z" })];
    const result = matchEvent(baseEvent(), matches);
    expect(result).toEqual({ ok: false, reason: "no_match" });
  });

  it("rejects when team ids don't match", () => {
    const matches = [groupMatch({ homeTeamId: "BRA" })];
    const result = matchEvent(baseEvent(), matches);
    expect(result).toEqual({ ok: false, reason: "no_match" });
  });

  it("rejects unknown ESPN team code", () => {
    const matches = [groupMatch({})];
    const ev = baseEvent({ home: { abbreviation: "ZZZ", score: 2 } });
    expect(matchEvent(ev, matches)).toEqual({ ok: false, reason: "unknown_team_code" });
  });

  it("rejects ambiguous matches (two candidates)", () => {
    const matches = [groupMatch({}), groupMatch({ id: "G-A-2" })];
    expect(matchEvent(baseEvent(), matches)).toEqual({
      ok: false,
      reason: "ambiguous",
    });
  });

  it("matches knockout by team ids when resolved", () => {
    const matches = [koMatch({})];
    const ev = baseEvent({
      dateUtc: "2026-06-28T20:00:00Z",
      home: { abbreviation: "CRO", score: 1 },
      away: { abbreviation: "JPN", score: 1 },
      statusName: "STATUS_FINAL_PEN",
      shootout: { home: 3, away: 1 },
    });
    expect(matchEvent(ev, matches)).toEqual({ ok: true, matchId: "KO-R32-1" });
  });

  it("skips knockout matches whose teams aren't resolved yet", () => {
    const matches = [koMatch({ homeTeamId: null, awayTeamId: null })];
    const ev = baseEvent({
      dateUtc: "2026-06-28T20:00:00Z",
      home: { abbreviation: "CRO", score: 1 },
      away: { abbreviation: "JPN", score: 1 },
    });
    expect(matchEvent(ev, matches)).toEqual({ ok: false, reason: "no_match" });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test src/espn/__tests__/matcher.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the matcher**

Create `src/espn/matcher.ts`:

```ts
// src/espn/matcher.ts
import type { EspnEvent } from "./types";
import type { GroupMatch, KnockoutMatch } from "../types";
import { normalizeTeamCode } from "./normalizer";

export type MatchResult =
  | { ok: true; matchId: string }
  | { ok: false; reason: MatchFailure };

export type MatchFailure = "unknown_team_code" | "no_match" | "ambiguous";

const DATE_TOLERANCE_MS = 2 * 60 * 60 * 1000; // 2 hours

export function matchEvent(
  ev: EspnEvent,
  matches: ReadonlyArray<GroupMatch | KnockoutMatch>,
): MatchResult {
  const home = normalizeTeamCode(ev.home.abbreviation);
  const away = normalizeTeamCode(ev.away.abbreviation);
  if (!home || !away) return { ok: false, reason: "unknown_team_code" };

  const evMs = new Date(ev.dateUtc).getTime();

  const candidates = matches.filter((m) => {
    if (!m.homeTeamId || !m.awayTeamId) return false;
    const sameTeams =
      (m.homeTeamId === home && m.awayTeamId === away) ||
      (m.homeTeamId === away && m.awayTeamId === home);
    if (!sameTeams) return false;
    const matchMs = new Date(m.dateUtc).getTime();
    return Math.abs(matchMs - evMs) <= DATE_TOLERANCE_MS;
  });

  if (candidates.length === 0) return { ok: false, reason: "no_match" };
  if (candidates.length > 1) return { ok: false, reason: "ambiguous" };
  return { ok: true, matchId: candidates[0].id };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm test src/espn/__tests__/matcher.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/espn/matcher.ts src/espn/__tests__/matcher.test.ts
git commit -m "feat(espn): add event-to-match lookup with strict tolerance"
```

---

## Task 8: Grace-period lock

**Files:**
- Create: `src/espn/graceLock.ts`
- Create: `src/espn/__tests__/graceLock.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/espn/__tests__/graceLock.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isMatchEditable, GRACE_PERIOD_GROUP_MS, GRACE_PERIOD_KO_MS } from "../graceLock";
import type { GroupMatch, KnockoutMatch } from "../../types";

function groupMatch(overrides: Partial<GroupMatch> = {}): GroupMatch {
  return {
    id: "G-A-1",
    group: "A",
    homeTeamId: "ARG",
    awayTeamId: "MEX",
    dateUtc: "2026-06-15T18:00:00Z",
    venue: "Test",
    result: null,
    prediction: null,
    ...overrides,
  };
}

function koMatch(overrides: Partial<KnockoutMatch> = {}): KnockoutMatch {
  return {
    id: "KO-R32-1",
    round: "R32",
    homeSlot: { type: "group", group: "A", position: 1 },
    awaySlot: { type: "group", group: "B", position: 2 },
    homeTeamId: "CRO",
    awayTeamId: "JPN",
    dateUtc: "2026-06-28T20:00:00Z",
    venue: "Test",
    result: null,
    prediction: null,
    ...overrides,
  };
}

const kickoff = new Date("2026-06-15T18:00:00Z").getTime();

describe("isMatchEditable", () => {
  it("is editable when auto-sync is disabled", () => {
    expect(
      isMatchEditable(groupMatch(), {
        autoSyncEnabled: false,
        circuitBreakerTripped: false,
        now: kickoff - 10_000,
      }),
    ).toBe(true);
  });

  it("is editable when circuit breaker is tripped", () => {
    expect(
      isMatchEditable(groupMatch(), {
        autoSyncEnabled: true,
        circuitBreakerTripped: true,
        now: kickoff - 10_000,
      }),
    ).toBe(true);
  });

  it("is locked when auto-sync enabled, breaker off, kickoff in future, no result", () => {
    expect(
      isMatchEditable(groupMatch(), {
        autoSyncEnabled: true,
        circuitBreakerTripped: false,
        now: kickoff - 10_000,
      }),
    ).toBe(false);
  });

  it("is locked within grace period after kickoff when no result", () => {
    expect(
      isMatchEditable(groupMatch(), {
        autoSyncEnabled: true,
        circuitBreakerTripped: false,
        now: kickoff + GRACE_PERIOD_GROUP_MS - 60_000,
      }),
    ).toBe(false);
  });

  it("is editable after grace period if still no result", () => {
    expect(
      isMatchEditable(groupMatch(), {
        autoSyncEnabled: true,
        circuitBreakerTripped: false,
        now: kickoff + GRACE_PERIOD_GROUP_MS + 60_000,
      }),
    ).toBe(true);
  });

  it("is locked after grace period when a result already exists", () => {
    expect(
      isMatchEditable(groupMatch({ result: { home: 2, away: 1 } }), {
        autoSyncEnabled: true,
        circuitBreakerTripped: false,
        now: kickoff + GRACE_PERIOD_GROUP_MS + 60_000,
      }),
    ).toBe(false);
  });

  it("uses the knockout grace period for knockout matches", () => {
    const koKickoff = new Date("2026-06-28T20:00:00Z").getTime();
    // Just before knockout grace expiry: still locked.
    expect(
      isMatchEditable(koMatch(), {
        autoSyncEnabled: true,
        circuitBreakerTripped: false,
        now: koKickoff + GRACE_PERIOD_KO_MS - 60_000,
      }),
    ).toBe(false);
    // Just after: editable.
    expect(
      isMatchEditable(koMatch(), {
        autoSyncEnabled: true,
        circuitBreakerTripped: false,
        now: koKickoff + GRACE_PERIOD_KO_MS + 60_000,
      }),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test src/espn/__tests__/graceLock.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the lock**

Create `src/espn/graceLock.ts`:

```ts
// src/espn/graceLock.ts
import type { GroupMatch, KnockoutMatch } from "../types";

export const GRACE_PERIOD_GROUP_MS = 3 * 60 * 60 * 1000; // 3h
export const GRACE_PERIOD_KO_MS = 4.5 * 60 * 60 * 1000; // 4.5h

export interface EditabilityContext {
  autoSyncEnabled: boolean;
  circuitBreakerTripped: boolean;
  now: number;
}

function isKnockout(m: GroupMatch | KnockoutMatch): m is KnockoutMatch {
  return "round" in m;
}

export function isMatchEditable(
  match: GroupMatch | KnockoutMatch,
  ctx: EditabilityContext,
): boolean {
  if (!ctx.autoSyncEnabled) return true;
  if (ctx.circuitBreakerTripped) return true;

  const kickoff = new Date(match.dateUtc).getTime();
  const grace = isKnockout(match) ? GRACE_PERIOD_KO_MS : GRACE_PERIOD_GROUP_MS;
  const stale = ctx.now > kickoff + grace && match.result === null;
  if (stale) return true;

  return false;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm test src/espn/__tests__/graceLock.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/espn/graceLock.ts src/espn/__tests__/graceLock.test.ts
git commit -m "feat(espn): add grace-period editability logic"
```

---

## Task 9: Circuit breaker

**Files:**
- Create: `src/espn/circuitBreaker.ts`
- Create: `src/espn/__tests__/circuitBreaker.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/espn/__tests__/circuitBreaker.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  evaluateTick,
  loadBreakerState,
  saveBreakerState,
  resetBreaker,
  BREAKER_STORAGE_KEY,
} from "../circuitBreaker";

beforeEach(() => {
  localStorage.clear();
});

describe("evaluateTick", () => {
  it("does not trip on a successful tick", () => {
    const next = evaluateTick(
      { tripped: false, trippedAt: null, reason: null, consecutiveFailures: 0 },
      { applied: 5, skipped: 0, networkFailed: false },
      Date.now(),
    );
    expect(next.tripped).toBe(false);
    expect(next.consecutiveFailures).toBe(0);
  });

  it("does not trip with mild skips", () => {
    const next = evaluateTick(
      { tripped: false, trippedAt: null, reason: null, consecutiveFailures: 0 },
      { applied: 5, skipped: 1, networkFailed: false },
      Date.now(),
    );
    expect(next.tripped).toBe(false);
  });

  it("trips when skips outweigh applies by 2x (≥ 3 skips)", () => {
    const next = evaluateTick(
      { tripped: false, trippedAt: null, reason: null, consecutiveFailures: 0 },
      { applied: 1, skipped: 4, networkFailed: false },
      1_000,
    );
    expect(next.tripped).toBe(true);
    expect(next.reason).toBe("many_skips");
    expect(next.trippedAt).toBe(1_000);
  });

  it("increments consecutive failures on network fail without tripping immediately", () => {
    const s1 = evaluateTick(
      { tripped: false, trippedAt: null, reason: null, consecutiveFailures: 0 },
      { applied: 0, skipped: 0, networkFailed: true },
      1_000,
    );
    expect(s1.tripped).toBe(false);
    expect(s1.consecutiveFailures).toBe(1);
  });

  it("trips after 5 consecutive network failures", () => {
    let state = { tripped: false, trippedAt: null as number | null, reason: null as string | null, consecutiveFailures: 0 };
    for (let i = 0; i < 5; i++) {
      state = evaluateTick(state, { applied: 0, skipped: 0, networkFailed: true }, 1_000 + i);
    }
    expect(state.tripped).toBe(true);
    expect(state.reason).toBe("repeated_network_failures");
  });

  it("resets consecutive failures on a successful tick", () => {
    const s1 = evaluateTick(
      { tripped: false, trippedAt: null, reason: null, consecutiveFailures: 3 },
      { applied: 1, skipped: 0, networkFailed: false },
      Date.now(),
    );
    expect(s1.consecutiveFailures).toBe(0);
  });
});

describe("persistence", () => {
  it("round-trips breaker state through localStorage", () => {
    saveBreakerState({
      tripped: true,
      trippedAt: 1234,
      reason: "many_skips",
      consecutiveFailures: 0,
    });
    expect(loadBreakerState()).toEqual({
      tripped: true,
      trippedAt: 1234,
      reason: "many_skips",
      consecutiveFailures: 0,
    });
  });

  it("returns a fresh state when storage is empty", () => {
    expect(loadBreakerState()).toEqual({
      tripped: false,
      trippedAt: null,
      reason: null,
      consecutiveFailures: 0,
    });
  });

  it("resetBreaker clears the storage key", () => {
    saveBreakerState({ tripped: true, trippedAt: 1, reason: "many_skips", consecutiveFailures: 0 });
    resetBreaker();
    expect(localStorage.getItem(BREAKER_STORAGE_KEY)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test src/espn/__tests__/circuitBreaker.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the circuit breaker**

Create `src/espn/circuitBreaker.ts`:

```ts
// src/espn/circuitBreaker.ts

export const BREAKER_STORAGE_KEY = "wc2026-autosync-breaker";

export type BreakerReason = "many_skips" | "repeated_network_failures";

export interface BreakerState {
  tripped: boolean;
  trippedAt: number | null;
  reason: BreakerReason | null;
  consecutiveFailures: number;
}

export interface TickOutcome {
  applied: number;
  skipped: number;
  networkFailed: boolean;
}

const INITIAL: BreakerState = {
  tripped: false,
  trippedAt: null,
  reason: null,
  consecutiveFailures: 0,
};

export function loadBreakerState(): BreakerState {
  try {
    const raw = localStorage.getItem(BREAKER_STORAGE_KEY);
    if (!raw) return { ...INITIAL };
    const parsed = JSON.parse(raw) as Partial<BreakerState>;
    return {
      tripped: Boolean(parsed.tripped),
      trippedAt: typeof parsed.trippedAt === "number" ? parsed.trippedAt : null,
      reason:
        parsed.reason === "many_skips" || parsed.reason === "repeated_network_failures"
          ? parsed.reason
          : null,
      consecutiveFailures:
        typeof parsed.consecutiveFailures === "number" ? parsed.consecutiveFailures : 0,
    };
  } catch {
    return { ...INITIAL };
  }
}

export function saveBreakerState(state: BreakerState): void {
  try {
    localStorage.setItem(BREAKER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage quota; non-fatal */
  }
}

export function resetBreaker(): void {
  try {
    localStorage.removeItem(BREAKER_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function evaluateTick(
  prev: BreakerState,
  outcome: TickOutcome,
  now: number,
): BreakerState {
  if (prev.tripped) return prev;

  if (outcome.networkFailed) {
    const consecutiveFailures = prev.consecutiveFailures + 1;
    if (consecutiveFailures >= 5) {
      return {
        tripped: true,
        trippedAt: now,
        reason: "repeated_network_failures",
        consecutiveFailures,
      };
    }
    return { ...prev, consecutiveFailures };
  }

  // Not a network failure: check skip/apply ratio.
  if (outcome.skipped >= 3 && outcome.skipped > outcome.applied * 2) {
    return {
      tripped: true,
      trippedAt: now,
      reason: "many_skips",
      consecutiveFailures: 0,
    };
  }

  return { ...prev, consecutiveFailures: 0 };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm test src/espn/__tests__/circuitBreaker.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/espn/circuitBreaker.ts src/espn/__tests__/circuitBreaker.test.ts
git commit -m "feat(espn): add circuit breaker with persistence and tick evaluation"
```

---

## Task 10: Meta persistence + settings persistence

**Files:**
- Create: `src/espn/autoSyncMeta.ts`

A small module with localStorage readers/writers for: the on/off toggle, the last-fetch timestamp, and the per-match `autoSyncedAt` map (used by the tooltip).

- [ ] **Step 1: Write the module**

Create `src/espn/autoSyncMeta.ts`:

```ts
// src/espn/autoSyncMeta.ts

const ENABLED_KEY = "wc2026-autosync-enabled";
const META_KEY = "wc2026-autosync-meta";

export interface AutoSyncMeta {
  lastFetchAt: number | null;
  autoSyncedAt: Record<string, number>; // matchId → ts of last successful apply
  lastSkipped: Array<{ matchId: string | null; reason: string }>;
  lastApplied: string[]; // match ids applied during the last tick
}

const EMPTY_META: AutoSyncMeta = {
  lastFetchAt: null,
  autoSyncedAt: {},
  lastSkipped: [],
  lastApplied: [],
};

export function loadAutoSyncEnabled(): boolean {
  try {
    const raw = localStorage.getItem(ENABLED_KEY);
    if (raw === null) return true; // default ON per spec
    return raw === "true";
  } catch {
    return true;
  }
}

export function saveAutoSyncEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? "true" : "false");
  } catch {
    /* ignore */
  }
}

export function loadAutoSyncMeta(): AutoSyncMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { ...EMPTY_META, autoSyncedAt: {}, lastSkipped: [], lastApplied: [] };
    const parsed = JSON.parse(raw) as Partial<AutoSyncMeta>;
    return {
      lastFetchAt: typeof parsed.lastFetchAt === "number" ? parsed.lastFetchAt : null,
      autoSyncedAt:
        parsed.autoSyncedAt && typeof parsed.autoSyncedAt === "object"
          ? (parsed.autoSyncedAt as Record<string, number>)
          : {},
      lastSkipped: Array.isArray(parsed.lastSkipped) ? parsed.lastSkipped : [],
      lastApplied: Array.isArray(parsed.lastApplied) ? parsed.lastApplied : [],
    };
  } catch {
    return { ...EMPTY_META, autoSyncedAt: {}, lastSkipped: [], lastApplied: [] };
  }
}

export function saveAutoSyncMeta(meta: AutoSyncMeta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/espn/autoSyncMeta.ts
git commit -m "feat(espn): add auto-sync toggle + meta persistence helpers"
```

---

## Task 11: Orchestrator hook (+ new reducer action)

**Files:**
- Modify: `src/types.ts`
- Modify: `src/context/FixtureContext.tsx`
- Create: `src/hooks/useAutoResultSync.ts`

**Why this task includes a reducer change:** `SET_GROUP_SCORE` / `SET_KNOCKOUT_SCORE` write to `prediction` when `state.mode === "predictions"`. The hook must never touch predictions — only real results. A new action `APPLY_AUTOSYNC_RESULTS` writes directly to the `result` field regardless of mode, and only fills voids.

- [ ] **Step 1: Extend `FixtureAction` union in `src/types.ts`**

Edit `src/types.ts` — at the bottom of the `FixtureAction` union add one more variant:

```ts
export type FixtureAction =
  | { type: "SET_GROUP_SCORE"; matchId: string; score: Score | null }
  // ...existing variants unchanged...
  | { type: "RESET_SIMULATION" }
  | {
      type: "APPLY_AUTOSYNC_RESULTS";
      groupResults: Record<string, Score>;
      knockoutResults: Record<string, Score>;
    };
```

- [ ] **Step 2: Handle the new action in the reducer**

Edit `src/context/FixtureContext.tsx`. In the `switch (action.type)` block, add a new case before `default`:

```ts
case "APPLY_AUTOSYNC_RESULTS": {
  // Auto-sync: only fill voids. Never overwrite an existing result, regardless of source.
  // Never touch predictions. Never touch syncedResultIds (that's for Nostr admin push).
  const groupMatches = state.groupMatches.map((m) => {
    if (m.result !== null) return m;
    const incoming = action.groupResults[m.id];
    return incoming ? { ...m, result: incoming } : m;
  });
  const knockoutMatches = state.knockoutMatches.map((m) => {
    if (m.result !== null) return m;
    const incoming = action.knockoutResults[m.id];
    return incoming ? { ...m, result: incoming } : m;
  });
  return { ...state, groupMatches, knockoutMatches };
}
```

- [ ] **Step 3: Add a reducer test for the new action**

Create `src/context/__tests__/fixtureReducer.autoSync.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fixtureReducer } from "../FixtureContext";
import type { FixtureState, GroupMatch, KnockoutMatch } from "../../types";
import { TEAMS } from "../../data/teams";

function state(groupMatches: GroupMatch[], knockoutMatches: KnockoutMatch[] = []): FixtureState {
  return {
    mode: "predictions",
    teams: TEAMS,
    groupMatches,
    knockoutMatches,
    activeView: { type: "schedule" },
    playerName: "",
    rivals: [],
    members: [],
    syncedResultIds: [],
    simulationActive: false,
    simulationSnapshot: null,
  };
}

function gm(id: string, overrides: Partial<GroupMatch> = {}): GroupMatch {
  return {
    id,
    group: "A",
    homeTeamId: "ARG",
    awayTeamId: "MEX",
    dateUtc: "2026-06-15T18:00:00Z",
    venue: "Test",
    result: null,
    prediction: null,
    ...overrides,
  };
}

describe("APPLY_AUTOSYNC_RESULTS", () => {
  it("fills a null group result", () => {
    const s = state([gm("G-A-1")]);
    const next = fixtureReducer(s, {
      type: "APPLY_AUTOSYNC_RESULTS",
      groupResults: { "G-A-1": { home: 2, away: 1 } },
      knockoutResults: {},
    });
    expect(next.groupMatches[0].result).toEqual({ home: 2, away: 1 });
  });

  it("does not overwrite an existing result", () => {
    const s = state([gm("G-A-1", { result: { home: 3, away: 3 } })]);
    const next = fixtureReducer(s, {
      type: "APPLY_AUTOSYNC_RESULTS",
      groupResults: { "G-A-1": { home: 2, away: 1 } },
      knockoutResults: {},
    });
    expect(next.groupMatches[0].result).toEqual({ home: 3, away: 3 });
  });

  it("does not touch predictions even in predictions mode", () => {
    const s = state([gm("G-A-1", { prediction: { home: 1, away: 1 } })]);
    expect(s.mode).toBe("predictions");
    const next = fixtureReducer(s, {
      type: "APPLY_AUTOSYNC_RESULTS",
      groupResults: { "G-A-1": { home: 2, away: 1 } },
      knockoutResults: {},
    });
    expect(next.groupMatches[0].prediction).toEqual({ home: 1, away: 1 });
    expect(next.groupMatches[0].result).toEqual({ home: 2, away: 1 });
  });

  it("does not modify syncedResultIds", () => {
    const s = { ...state([gm("G-A-1")]), syncedResultIds: ["G-A-2"] };
    const next = fixtureReducer(s, {
      type: "APPLY_AUTOSYNC_RESULTS",
      groupResults: { "G-A-1": { home: 2, away: 1 } },
      knockoutResults: {},
    });
    expect(next.syncedResultIds).toEqual(["G-A-2"]);
  });
});
```

Run: `pnpm test src/context/__tests__/fixtureReducer.autoSync.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 4: Write the hook**

Create `src/hooks/useAutoResultSync.ts`:

```ts
// src/hooks/useAutoResultSync.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { useFixture } from "../context/FixtureContext";
import {
  fetchScoreboard,
  AutoSyncNetworkError,
} from "../espn/client";
import { parseScoreboard } from "../espn/parser";
import { validateEvent } from "../espn/validator";
import { matchEvent } from "../espn/matcher";
import {
  buildFetchDates,
  isWithinTournamentWindow,
} from "../espn/tournamentWindow";
import {
  evaluateTick,
  loadBreakerState,
  saveBreakerState,
  type BreakerState,
  type TickOutcome,
} from "../espn/circuitBreaker";
import {
  loadAutoSyncEnabled,
  loadAutoSyncMeta,
  saveAutoSyncMeta,
  type AutoSyncMeta,
} from "../espn/autoSyncMeta";
import { getEffectiveNow } from "../utils/devClock";
import type { EspnEvent } from "../espn/types";
import type { Score } from "../types";

const INTERVAL_MS = 30 * 60 * 1000;

function scoreFromEvent(ev: EspnEvent): Score {
  const score: Score = { home: ev.home.score, away: ev.away.score };
  if (ev.statusName === "STATUS_FINAL_PEN" && ev.shootout) {
    score.penalties = { home: ev.shootout.home, away: ev.shootout.away };
  }
  return score;
}

export function useAutoResultSync(): void {
  const { state, dispatch } = useFixture();
  const inFlightRef = useRef<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Breaker state is mirrored in React so the UI re-renders on trip.
  const [breaker, setBreaker] = useState<BreakerState>(() => loadBreakerState());
  const breakerRef = useRef<BreakerState>(breaker);
  breakerRef.current = breaker;

  const runTick = useCallback(async (): Promise<void> => {
    const enabled = loadAutoSyncEnabled();
    if (!enabled) return;
    if (breakerRef.current.tripped) return;
    if (typeof document !== "undefined" && document.hidden) return;
    const now = getEffectiveNow();
    if (!isWithinTournamentWindow(now)) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    abortRef.current = new AbortController();

    const tickOutcome: TickOutcome = { applied: 0, skipped: 0, networkFailed: false };
    const appliedIds: string[] = [];
    const skipped: AutoSyncMeta["lastSkipped"] = [];
    const perMatchTs: Record<string, number> = { ...loadAutoSyncMeta().autoSyncedAt };

    try {
      const raw = await fetchScoreboard({
        dates: buildFetchDates(now),
        signal: abortRef.current.signal,
      });
      const events = parseScoreboard(raw);
      const allMatches = [...state.groupMatches, ...state.knockoutMatches];

      const groupResults: Record<string, Score> = {};
      const knockoutResults: Record<string, Score> = {};

      for (const ev of events) {
        const v = validateEvent(ev);
        if (!v.ok) {
          skipped.push({ matchId: null, reason: v.reason });
          tickOutcome.skipped += 1;
          console.warn(`[autosync] skip event ${ev.id}: ${v.reason}`);
          continue;
        }
        const mr = matchEvent(ev, allMatches);
        if (!mr.ok) {
          skipped.push({ matchId: null, reason: mr.reason });
          tickOutcome.skipped += 1;
          console.warn(`[autosync] skip event ${ev.id}: ${mr.reason}`);
          continue;
        }
        const existing = allMatches.find((m) => m.id === mr.matchId);
        if (!existing) continue;
        if (existing.result !== null) {
          // Not counted as skipped for breaker purposes; this is the idempotent / admin-wins case.
          continue;
        }
        const score = scoreFromEvent(ev);
        const isGroup = existing.id.startsWith("G-");
        if (isGroup) groupResults[existing.id] = score;
        else knockoutResults[existing.id] = score;
        appliedIds.push(existing.id);
        perMatchTs[existing.id] = now;
        tickOutcome.applied += 1;
      }

      if (appliedIds.length > 0) {
        dispatch({
          type: "APPLY_AUTOSYNC_RESULTS",
          groupResults,
          knockoutResults,
        });
      }
    } catch (err) {
      tickOutcome.networkFailed = true;
      const msg = err instanceof AutoSyncNetworkError ? err.message : String(err);
      console.warn(`[autosync] network: ${msg}`);
    } finally {
      inFlightRef.current = false;
      abortRef.current = null;
    }

    const nextBreaker = evaluateTick(breakerRef.current, tickOutcome, now);
    if (nextBreaker !== breakerRef.current) {
      saveBreakerState(nextBreaker);
      breakerRef.current = nextBreaker;
      setBreaker(nextBreaker);
    }

    saveAutoSyncMeta({
      lastFetchAt: now,
      autoSyncedAt: perMatchTs,
      lastSkipped: skipped,
      lastApplied: appliedIds,
    });
  }, [state.groupMatches, state.knockoutMatches, dispatch]);

  // Fire on mount + set up interval.
  useEffect(() => {
    runTick();
    timerRef.current = setInterval(runTick, INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      abortRef.current?.abort();
    };
  }, [runTick]);

  // Resume on visibility change if enough time passed.
  useEffect(() => {
    function onVisibility(): void {
      if (document.hidden) return;
      const meta = loadAutoSyncMeta();
      const elapsed = getEffectiveNow() - (meta.lastFetchAt ?? 0);
      if (elapsed > INTERVAL_MS) runTick();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [runTick]);
}
```

- [ ] **Step 5: Verify build + test**

Run: `pnpm run build && pnpm test`
Expected: PASS (all existing + the 4 new reducer tests).

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/context/FixtureContext.tsx src/context/__tests__/fixtureReducer.autoSync.test.ts src/hooks/useAutoResultSync.ts
git commit -m "feat(autosync): add APPLY_AUTOSYNC_RESULTS action + orchestrator hook"
```

---

## Task 12: Plumb `isMatchEditable` through `ScoreInput` and views

**Files:**
- Modify: `src/components/ScoreInput.tsx`
- Modify: `src/components/GroupView.tsx`
- Modify: `src/components/BracketView.tsx`
- Modify: `src/components/ScheduleView.tsx`

- [ ] **Step 1: Read current signatures**

Run: `grep -n "interface\|function ScoreInput" src/components/ScoreInput.tsx`

Note the current prop signature. If it already accepts a `disabled` prop, we add `lockedReason?: string`. If not, we add both.

- [ ] **Step 2: Modify `ScoreInput.tsx`**

Edit `src/components/ScoreInput.tsx` — locate the props interface and the input JSX. Add:

```tsx
interface ScoreInputProps {
  // ...existing props
  disabled?: boolean;
  lockedReason?: string;
}
```

On each `<input>` element that edits home/away scores, add:

```tsx
<input
  // ...existing props
  disabled={props.disabled}
  title={props.disabled ? props.lockedReason : undefined}
  aria-disabled={props.disabled ? true : undefined}
/>
```

If the existing component already has a `disabled` path (for the predictions-mode `isMatchLocked`), merge: `disabled={existingDisabled || props.disabled}`.

- [ ] **Step 3: Wire `isMatchEditable` into GroupView**

Edit `src/components/GroupView.tsx`. Near the top add:

```tsx
import { isMatchEditable } from "../espn/graceLock";
import { loadAutoSyncEnabled } from "../espn/autoSyncMeta";
import { loadBreakerState } from "../espn/circuitBreaker";
import { getEffectiveNow } from "../utils/devClock";
import { useLocale } from "../i18n";
```

Inside the component, where `<ScoreInput>` is rendered for a match, compute:

```tsx
const autoSyncEnabled = loadAutoSyncEnabled();
const breaker = loadBreakerState();
const editable = isMatchEditable(match, {
  autoSyncEnabled,
  circuitBreakerTripped: breaker.tripped,
  now: getEffectiveNow(),
});
const { t } = useLocale();

<ScoreInput
  // ...existing props
  disabled={!editable && state.mode === "results"}
  lockedReason={t("autoSync.waitingResult")}
/>
```

(Replace `state.mode === "results"` with whatever the existing mode guard uses; keep predictions-mode behavior unchanged.)

- [ ] **Step 4: Wire into BracketView**

Same edit as Step 3, applied to `src/components/BracketView.tsx`.

- [ ] **Step 5: Wire into ScheduleView**

Same edit applied to `src/components/ScheduleView.tsx`.

- [ ] **Step 6: Verify build + tests**

Run: `pnpm run build && pnpm test`
Expected: both pass. If `t("autoSync.waitingResult")` fails the i18n consistency check, that's expected — Task 13 adds the string.

If the build fails because `t("autoSync.waitingResult")` is undefined at runtime during tests, temporarily use the literal string `"Esperando resultado automático"` and replace with `t(...)` in Task 13. Commit the temp literal here.

- [ ] **Step 7: Commit**

```bash
git add src/components/ScoreInput.tsx src/components/GroupView.tsx src/components/BracketView.tsx src/components/ScheduleView.tsx
git commit -m "feat(components): disable score inputs per auto-sync grace-lock"
```

---

## Task 13: i18n strings + SettingsModal

**Files:**
- Modify: `src/i18n/locales/es.ts`
- Modify: `src/i18n/locales/en.ts`
- Modify: `src/i18n/locales/pt.ts`
- Create: `src/components/SettingsModal.tsx`
- Create: `src/components/SettingsModal.css`
- Modify: `src/components/SidebarFooter.tsx`

- [ ] **Step 1: Add strings to `es.ts`**

Open `src/i18n/locales/es.ts`. Find the top-level object and add a new key after `common`:

```ts
autoSync: {
  sectionTitle: "Auto-sync de resultados",
  toggleLabel: "Actualizar resultados automáticamente",
  toggleHelp: "Trae los resultados desde ESPN cada 30 minutos. Si te equivocaste tipeando, te lo corrige.",
  lastFetchNever: "Nunca",
  lastFetchAgo: "Último fetch: {relative}",
  verifyButton: "Verificar auto-sync",
  verifyRunning: "Verificando...",
  verifyReportTitle: "Reporte de auto-sync",
  verifyMatched: "{applied}/{total} matches reconocidos",
  verifySkipReason: {
    non_terminal_status: "Partido no terminado",
    invalid_score: "Score inválido",
    missing_shootout: "Falta shootout",
    invalid_shootout: "Shootout inválido",
    invalid_date: "Fecha inválida",
    unknown_team_code: "Código de equipo desconocido",
    no_match: "No coincide con ningún partido",
    ambiguous: "Match ambiguo",
  },
  waitingResult: "Esperando resultado automático",
  autoSyncedTooltip: "Actualizado automáticamente desde ESPN el {datetime}",
  breakerTrippedTitle: "Auto-sync pausado",
  breakerTrippedMessage: "Los resultados de ESPN no coinciden con el fixture. Podés re-activarlo en Configuración.",
  breakerReenable: "Re-activar auto-sync",
  sidebarEntry: "Configuración",
},
```

- [ ] **Step 2: Add matching strings to `en.ts`**

Open `src/i18n/locales/en.ts` and add the same block (translated):

```ts
autoSync: {
  sectionTitle: "Auto-sync results",
  toggleLabel: "Update results automatically",
  toggleHelp: "Fetches results from ESPN every 30 minutes. If you mistyped one, it corrects it.",
  lastFetchNever: "Never",
  lastFetchAgo: "Last fetch: {relative}",
  verifyButton: "Verify auto-sync",
  verifyRunning: "Verifying...",
  verifyReportTitle: "Auto-sync report",
  verifyMatched: "{applied}/{total} matches recognized",
  verifySkipReason: {
    non_terminal_status: "Match not finished",
    invalid_score: "Invalid score",
    missing_shootout: "Missing shootout",
    invalid_shootout: "Invalid shootout",
    invalid_date: "Invalid date",
    unknown_team_code: "Unknown team code",
    no_match: "No fixture match",
    ambiguous: "Ambiguous match",
  },
  waitingResult: "Waiting for automatic result",
  autoSyncedTooltip: "Automatically updated from ESPN on {datetime}",
  breakerTrippedTitle: "Auto-sync paused",
  breakerTrippedMessage: "ESPN results do not match the fixture. You can re-enable it in Settings.",
  breakerReenable: "Re-enable auto-sync",
  sidebarEntry: "Settings",
},
```

- [ ] **Step 3: Add Portuguese strings to `pt.ts`**

Open `src/i18n/locales/pt.ts` and add:

```ts
autoSync: {
  sectionTitle: "Sincronização automática",
  toggleLabel: "Atualizar resultados automaticamente",
  toggleHelp: "Busca os resultados do ESPN a cada 30 minutos. Se você errou ao digitar, ele corrige.",
  lastFetchNever: "Nunca",
  lastFetchAgo: "Última busca: {relative}",
  verifyButton: "Verificar sincronização",
  verifyRunning: "Verificando...",
  verifyReportTitle: "Relatório de sincronização",
  verifyMatched: "{applied}/{total} jogos reconhecidos",
  verifySkipReason: {
    non_terminal_status: "Jogo não terminado",
    invalid_score: "Placar inválido",
    missing_shootout: "Sem pênaltis",
    invalid_shootout: "Pênaltis inválidos",
    invalid_date: "Data inválida",
    unknown_team_code: "Código de equipe desconhecido",
    no_match: "Sem correspondência",
    ambiguous: "Correspondência ambígua",
  },
  waitingResult: "Aguardando resultado automático",
  autoSyncedTooltip: "Atualizado automaticamente do ESPN em {datetime}",
  breakerTrippedTitle: "Sincronização pausada",
  breakerTrippedMessage: "Os resultados do ESPN não coincidem com o fixture. Reative em Configurações.",
  breakerReenable: "Reativar sincronização",
  sidebarEntry: "Configurações",
},
```

- [ ] **Step 4: Run i18n consistency test**

Run: `pnpm test src/i18n`
Expected: PASS (the locales consistency test should now see matching keys across ES/EN/PT).

- [ ] **Step 5: Create SettingsModal**

Create `src/components/SettingsModal.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "../i18n";
import {
  loadAutoSyncEnabled,
  saveAutoSyncEnabled,
  loadAutoSyncMeta,
} from "../espn/autoSyncMeta";
import { loadBreakerState, resetBreaker } from "../espn/circuitBreaker";
import { fetchScoreboard } from "../espn/client";
import { parseScoreboard } from "../espn/parser";
import { validateEvent } from "../espn/validator";
import { matchEvent } from "../espn/matcher";
import { buildFetchDates } from "../espn/tournamentWindow";
import { getEffectiveNow } from "../utils/devClock";
import { useFixture } from "../context/FixtureContext";
import "./SettingsModal.css";

interface VerifyReport {
  applied: number;
  total: number;
  skipped: Array<{ matchId: string | null; reason: string }>;
}

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { t } = useLocale();
  const { state } = useFixture();

  const [enabled, setEnabled] = useState<boolean>(loadAutoSyncEnabled());
  const [verifying, setVerifying] = useState<boolean>(false);
  const [report, setReport] = useState<VerifyReport | null>(null);

  const breaker = loadBreakerState();
  const meta = useMemo(() => loadAutoSyncMeta(), []);

  const toggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    saveAutoSyncEnabled(next);
  }, [enabled]);

  const verify = useCallback(async () => {
    setVerifying(true);
    setReport(null);
    try {
      const raw = await fetchScoreboard({ dates: buildFetchDates(getEffectiveNow()) });
      const events = parseScoreboard(raw);
      const all = [...state.groupMatches, ...state.knockoutMatches];
      let applied = 0;
      const skipped: VerifyReport["skipped"] = [];
      for (const ev of events) {
        const v = validateEvent(ev);
        if (!v.ok) {
          skipped.push({ matchId: null, reason: v.reason });
          continue;
        }
        const mr = matchEvent(ev, all);
        if (!mr.ok) {
          skipped.push({ matchId: null, reason: mr.reason });
          continue;
        }
        applied += 1;
      }
      setReport({ applied, total: events.length, skipped });
    } catch (err) {
      setReport({ applied: 0, total: 0, skipped: [{ matchId: null, reason: String(err) }] });
    } finally {
      setVerifying(false);
    }
  }, [state.groupMatches, state.knockoutMatches]);

  const reenable = useCallback(() => {
    resetBreaker();
    // Force a re-render by closing and letting the consumer re-open if needed.
    onClose();
  }, [onClose]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const lastFetchText = meta.lastFetchAt
    ? t("autoSync.lastFetchAgo", {
        relative: new Date(meta.lastFetchAt).toLocaleString(),
      })
    : t("autoSync.lastFetchNever");

  return (
    <div className="settings-modal-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <button className="settings-modal-close" onClick={onClose}>×</button>
        <h2>{t("autoSync.sectionTitle")}</h2>

        <label className="settings-toggle">
          <input type="checkbox" checked={enabled} onChange={toggle} />
          <span>{t("autoSync.toggleLabel")}</span>
        </label>
        <p className="settings-help">{t("autoSync.toggleHelp")}</p>

        <p className="settings-last-fetch">{lastFetchText}</p>

        {breaker.tripped && (
          <div className="settings-breaker">
            <strong>{t("autoSync.breakerTrippedTitle")}</strong>
            <p>{t("autoSync.breakerTrippedMessage")}</p>
            <button onClick={reenable}>{t("autoSync.breakerReenable")}</button>
          </div>
        )}

        <button onClick={verify} disabled={verifying}>
          {verifying ? t("autoSync.verifyRunning") : t("autoSync.verifyButton")}
        </button>

        {report && (
          <div className="settings-report">
            <h3>{t("autoSync.verifyReportTitle")}</h3>
            <p>{t("autoSync.verifyMatched", { applied: String(report.applied), total: String(report.total) })}</p>
            {report.skipped.length > 0 && (
              <ul>
                {report.skipped.map((s, i) => (
                  <li key={i}>{s.reason}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create the CSS**

Create `src/components/SettingsModal.css`:

```css
.settings-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}
.settings-modal {
  background: var(--surface, #fff);
  color: var(--text, #000);
  border-radius: 8px;
  padding: 1.5rem 1.25rem;
  max-width: 440px;
  width: 92vw;
  max-height: 86vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}
.settings-modal-close {
  position: absolute;
  top: 0.5rem;
  right: 0.75rem;
  background: transparent;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: inherit;
}
.settings-modal h2 {
  margin: 0 0 1rem 0;
}
.settings-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}
.settings-help {
  font-size: 0.9rem;
  opacity: 0.8;
  margin: 0.25rem 0 1rem;
}
.settings-last-fetch {
  font-size: 0.85rem;
  opacity: 0.7;
  margin: 0.5rem 0 1rem;
}
.settings-breaker {
  background: rgba(200, 80, 0, 0.15);
  border: 1px solid rgba(200, 80, 0, 0.4);
  border-radius: 6px;
  padding: 0.75rem;
  margin-bottom: 1rem;
}
.settings-breaker button {
  margin-top: 0.5rem;
}
.settings-report {
  margin-top: 1rem;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 6px;
}
.settings-report ul {
  margin: 0.5rem 0 0 1rem;
  padding: 0;
  font-size: 0.85rem;
}
```

- [ ] **Step 7: Add Settings entry in SidebarFooter**

Open `src/components/SidebarFooter.tsx`. Find the menu structure (buttons for `myAccount`, `donate`, `github`). Add a new entry above `myAccount`:

```tsx
<button onClick={() => setShowSettings(true)}>
  {t("autoSync.sidebarEntry")}
</button>
```

and the state + conditional render:

```tsx
const [showSettings, setShowSettings] = useState(false);
// ...
{showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
```

Import: `import { SettingsModal } from "./SettingsModal";` and `import { useState } from "react";`.

- [ ] **Step 8: Verify build + tests**

Run: `pnpm run build && pnpm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/i18n/locales/ src/components/SettingsModal.tsx src/components/SettingsModal.css src/components/SidebarFooter.tsx
git commit -m "feat(settings): add auto-sync settings modal with verify action + i18n"
```

---

## Task 14: Circuit-breaker banner

**Files:**
- Create: `src/components/AutoSyncBanner.tsx`
- Create: `src/components/AutoSyncBanner.css`

- [ ] **Step 1: Create the banner**

Create `src/components/AutoSyncBanner.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useLocale } from "../i18n";
import { loadBreakerState, resetBreaker } from "../espn/circuitBreaker";
import "./AutoSyncBanner.css";

const DISMISSED_KEY = "wc2026-autosync-banner-dismissed";

export function AutoSyncBanner() {
  const { t } = useLocale();
  const [tripped, setTripped] = useState<boolean>(() => loadBreakerState().tripped);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    function onStorage(): void {
      setTripped(loadBreakerState().tripped);
    }
    window.addEventListener("storage", onStorage);
    const interval = setInterval(onStorage, 60_000);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(interval);
    };
  }, []);

  if (!tripped || dismissed) return null;

  return (
    <div className="autosync-banner" role="alert">
      <strong>{t("autoSync.breakerTrippedTitle")}</strong>
      <span>{t("autoSync.breakerTrippedMessage")}</span>
      <button
        onClick={() => {
          resetBreaker();
          setTripped(false);
        }}
      >
        {t("autoSync.breakerReenable")}
      </button>
      <button
        aria-label="dismiss"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(DISMISSED_KEY, "true");
          } catch {
            /* ignore */
          }
        }}
      >
        ×
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create the CSS**

Create `src/components/AutoSyncBanner.css`:

```css
.autosync-banner {
  position: fixed;
  left: 50%;
  bottom: 1rem;
  transform: translateX(-50%);
  background: rgba(200, 80, 0, 0.95);
  color: #fff;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  max-width: 92vw;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  z-index: 150;
  font-size: 0.9rem;
}
.autosync-banner button {
  background: rgba(255, 255, 255, 0.2);
  color: inherit;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 4px;
  padding: 0.25rem 0.6rem;
  cursor: pointer;
}
.autosync-banner button:hover {
  background: rgba(255, 255, 255, 0.3);
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/components/AutoSyncBanner.tsx src/components/AutoSyncBanner.css
git commit -m "feat(ui): add circuit-breaker banner with dismiss + re-enable"
```

---

## Task 15: Dev-mode inspector

**Files:**
- Create: `src/components/AutoSyncInspector.tsx`
- Create: `src/components/AutoSyncInspector.css`

- [ ] **Step 1: Create the inspector**

Create `src/components/AutoSyncInspector.tsx`:

```tsx
import { useCallback, useState } from "react";
import { fetchScoreboard } from "../espn/client";
import { parseScoreboard } from "../espn/parser";
import { validateEvent } from "../espn/validator";
import { matchEvent } from "../espn/matcher";
import { buildFetchDates } from "../espn/tournamentWindow";
import { getEffectiveNow } from "../utils/devClock";
import { useFixture } from "../context/FixtureContext";
import type { EspnEvent } from "../espn/types";
import "./AutoSyncInspector.css";

const LEAGUE_OPTIONS = [
  "fifa.world",
  "fifa.wwc",
  "uefa.champions",
  "uefa.europa",
  "eng.1",
  "esp.1",
  "ger.1",
  "ita.1",
  "fra.1",
  "usa.1",
  "mex.1",
] as const;

type InspectorRow =
  | { kind: "ok"; ev: EspnEvent; matchId: string }
  | { kind: "skip"; ev: EspnEvent; reason: string }
  | { kind: "idempotent"; ev: EspnEvent; matchId: string };

export function AutoSyncInspector() {
  const { state } = useFixture();
  const [league, setLeague] = useState<string>("fifa.world");
  const [dates, setDates] = useState<string>(() => buildFetchDates(getEffectiveNow()));
  const [rows, setRows] = useState<InspectorRow[]>([]);
  const [raw, setRaw] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setRows([]);
    setRaw("");
    try {
      const body = await fetchScoreboard({ leagueSlug: league, dates });
      setRaw(JSON.stringify(body, null, 2));
      const events = parseScoreboard(body);
      const all = [...state.groupMatches, ...state.knockoutMatches];
      const out: InspectorRow[] = [];
      for (const ev of events) {
        const v = validateEvent(ev);
        if (!v.ok) {
          out.push({ kind: "skip", ev, reason: v.reason });
          continue;
        }
        const mr = matchEvent(ev, all);
        if (!mr.ok) {
          out.push({ kind: "skip", ev, reason: mr.reason });
          continue;
        }
        const existing = all.find((m) => m.id === mr.matchId);
        if (existing?.result !== null && existing?.result !== undefined) {
          out.push({ kind: "idempotent", ev, matchId: mr.matchId });
        } else {
          out.push({ kind: "ok", ev, matchId: mr.matchId });
        }
      }
      setRows(out);
    } catch (err) {
      setRaw(String(err));
    } finally {
      setLoading(false);
    }
  }, [league, dates, state.groupMatches, state.knockoutMatches]);

  return (
    <div className="autosync-inspector">
      <h2>Auto-sync inspector (dev)</h2>
      <div className="autosync-inspector-controls">
        <label>
          League:
          <select value={league} onChange={(e) => setLeague(e.target.value)}>
            {LEAGUE_OPTIONS.map((slug) => (
              <option key={slug} value={slug}>{slug}</option>
            ))}
          </select>
        </label>
        <label>
          Dates:
          <input value={dates} onChange={(e) => setDates(e.target.value)} />
        </label>
        <button onClick={run} disabled={loading}>{loading ? "Fetching..." : "Fetch"}</button>
      </div>
      <p>Events returned: {rows.length}</p>
      <ul className="autosync-inspector-rows">
        {rows.map((r, i) => {
          const label = `${r.ev.home.abbreviation} ${r.ev.home.score}-${r.ev.away.score} ${r.ev.away.abbreviation}`;
          if (r.kind === "ok") return <li key={i} className="ok">✓ {label} → {r.matchId} ({r.ev.statusName})</li>;
          if (r.kind === "idempotent") return <li key={i} className="idem">- {label} → {r.matchId} (idempotent)</li>;
          return <li key={i} className="skip">✗ event {r.ev.id}: {r.reason}</li>;
        })}
      </ul>
      {raw && (
        <details>
          <summary>Raw JSON</summary>
          <pre>{raw}</pre>
        </details>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the CSS**

Create `src/components/AutoSyncInspector.css`:

```css
.autosync-inspector {
  position: fixed;
  inset: 0;
  background: #fafafa;
  color: #111;
  padding: 1rem;
  overflow-y: auto;
  z-index: 500;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.9rem;
}
.autosync-inspector-controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  align-items: center;
}
.autosync-inspector-rows {
  list-style: none;
  padding: 0;
  margin: 0;
}
.autosync-inspector-rows li {
  padding: 0.25rem 0;
  border-bottom: 1px solid #eee;
}
.autosync-inspector-rows li.ok { color: #0a6; }
.autosync-inspector-rows li.skip { color: #c33; }
.autosync-inspector-rows li.idem { color: #888; }
.autosync-inspector pre {
  background: #fff;
  padding: 0.5rem;
  max-height: 40vh;
  overflow: auto;
  border: 1px solid #ddd;
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/components/AutoSyncInspector.tsx src/components/AutoSyncInspector.css
git commit -m "feat(dev): add AutoSyncInspector for live-league rehearsal"
```

---

## Task 16: Wire everything into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Read current App.tsx**

Run: `cat src/App.tsx | head -80`

Note where `useNostrSync()` is called — the new hook goes next to it. Note the JSX root for overlay placement.

- [ ] **Step 2: Mount the hook and overlays**

Edit `src/App.tsx`:

Add imports near the existing hook imports:

```tsx
import { useAutoResultSync } from "./hooks/useAutoResultSync";
import { AutoSyncBanner } from "./components/AutoSyncBanner";
import { AutoSyncInspector } from "./components/AutoSyncInspector";
```

Inside the component that already calls `useNostrSync()`:

```tsx
useNostrSync();
useAutoResultSync();
```

Detect dev-mode URL param (once, at component top-level):

```tsx
const showInspector =
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("devSync");
```

In the JSX root, add the overlays as siblings of the main layout:

```tsx
<>
  {/* ...existing layout */}
  <AutoSyncBanner />
  {showInspector && <AutoSyncInspector />}
</>
```

- [ ] **Step 3: Verify build + tests**

Run: `pnpm run build && pnpm test`
Expected: PASS.

- [ ] **Step 4: Smoke test in dev**

Run: `pnpm run dev` and open http://localhost:5173.

- Open DevTools console. You should see `[autosync]` warn lines if the tournament window gate allows it (April 2026 is outside the window; expect no tick).
- Temporarily force a tick by opening the inspector: http://localhost:5173/?devSync=1
- Pick `league=eng.1`, `dates=` (a date range with recent Premier League matches), click Fetch.
- Verify the response parses, some events show as `skip: no_match` (expected — the fixture is WC teams), and raw JSON is readable.

Record observations:
- Any unknown ESPN team code → add to `ESPN_TEAM_CODE_MAP`.
- Unknown `statusName` values → add to the `EspnStatusName` union and to `KNOWN_STATUSES` in the parser.

If you add entries, make commits in the appropriate task's file (`normalizer.ts`, `types.ts`, `parser.ts`) with a small targeted commit.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): mount useAutoResultSync + banner + dev inspector"
```

---

## Task 17: Score tooltip for auto-synced matches

**Files:**
- Modify: `src/components/ScoreInput.tsx` (or wherever the result score is displayed in read-only mode — identify in Step 1)

- [ ] **Step 1: Identify the score display surface**

Run: `grep -rn "match.result\|result?.home\|result\.home" src/components/ | head -20`

The tooltip must appear on any element rendering a match's auto-synced final score. In most views, this is the same `<input>` shown in ScoreInput (with `disabled` when read-only). The `title` attribute on the input serves as the tooltip.

- [ ] **Step 2: Add tooltip based on autoSyncedAt**

Edit `src/components/ScoreInput.tsx`. Near the top, read the meta once:

```tsx
import { loadAutoSyncMeta } from "../espn/autoSyncMeta";
import { useLocale } from "../i18n";
```

Inside the component:

```tsx
const { t } = useLocale();
const ts = loadAutoSyncMeta().autoSyncedAt[props.matchId]; // props.matchId exists in the existing interface
const autoSyncTooltip = ts
  ? t("autoSync.autoSyncedTooltip", { datetime: new Date(ts).toLocaleString() })
  : undefined;
```

On the score `<input>` elements, set:

```tsx
title={props.disabled ? (props.lockedReason ?? autoSyncTooltip) : autoSyncTooltip}
```

(Prefer the lock reason if locked; otherwise show the auto-sync timestamp if present.)

- [ ] **Step 3: Verify build + tests**

Run: `pnpm run build && pnpm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ScoreInput.tsx
git commit -m "feat(ui): tooltip on auto-synced scores showing ESPN timestamp"
```

---

## Task 18: Final verification + manual QA checklist

**Files:** none created. Final integration check.

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: PASS — all new tests + all existing tests green.

- [ ] **Step 2: Full build**

Run: `pnpm run build`
Expected: success.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no NEW errors beyond the 9 pre-existing ones documented in CLAUDE.md.

- [ ] **Step 4: Manual QA — gates**

Run: `pnpm run dev`

1. Open app with today's real date (outside tournament window). Open DevTools console. Verify no `[autosync]` network lines appear (gate should block).
2. In DevTools console run `window.__devClock.setNow("2026-06-15T12:00:00Z")`. Reload. Verify at least one `[autosync]` log line appears or the console shows a fetch attempt to `site.api.espn.com`.
3. Run `window.__devClock.clear()` to restore.

- [ ] **Step 5: Manual QA — settings**

1. Click the Sidebar footer's "Configuración" entry. The SettingsModal opens.
2. Toggle auto-sync OFF. Reload. In devtools: `localStorage.getItem("wc2026-autosync-enabled")` should be `"false"`.
3. Click "Verificar auto-sync". Reports either "X/Y matches reconocidos" or lists skip reasons. Should NOT crash.
4. Toggle back ON.

- [ ] **Step 6: Manual QA — dev inspector**

Open http://localhost:5173/?devSync=1. The inspector overlay appears.

1. Select `league=eng.1`. Click Fetch.
2. Verify events list shows rows — most as `skip: no_match` (correct; fixture is WC teams), but status + scores parse correctly.
3. If any row shows `skip: unknown_team_code`, inspect raw JSON and add a mapping in `ESPN_TEAM_CODE_MAP`.
4. If any event's statusName is `STATUS_UNKNOWN` but should be valid, widen the `EspnStatusName` union + `KNOWN_STATUSES` set.

- [ ] **Step 7: Manual QA — editability**

With dev-clock set to a date during the tournament:

1. Open a GroupView for a group with upcoming matches.
2. Switch to "Resultados" mode.
3. Try clicking into a score input for a future match. It should be disabled; hover shows "Esperando resultado automático".
4. Now turn off auto-sync in Settings. Reload. The same input is editable.
5. Turn auto-sync back on. Reload. Input returns to disabled.

- [ ] **Step 8: Final commit (if any open changes)**

If any fixups from QA remain:

```bash
git add -A
git commit -m "chore(autosync): QA fixes from end-to-end smoke test"
```

---

## Self-review checklist (for plan author, run once before handoff)

Spec coverage:

- [x] API choice (ESPN v3) → Task 6 (`client.ts`).
- [x] Every client polls → Task 11 (`useAutoResultSync`).
- [x] Gates (enabled + visible + window) → Task 11.
- [x] Read-only when auto-sync working → Task 8 (`graceLock`) + Task 12 (wiring).
- [x] Unlock conditions → Task 8 covers all three.
- [x] API fills voids only → Task 11 write guard.
- [x] Validation (7 checks) → Task 4 + Task 7 (matcher).
- [x] Three testing layers: Layer 1 → Tasks 2-9. Layer 2 → Task 15. Layer 3 → Task 13.
- [x] No new FixtureState → localStorage in `autoSyncMeta.ts` + `circuitBreaker.ts`.
- [x] Circuit breaker → Task 9 + Task 14 (banner).
- [x] Dev inspector hidden behind `?devSync=1` → Task 15 + Task 16.
- [x] i18n in ES/EN/PT → Task 13.
- [x] Tournament window → Task 2.
- [x] Settings modal → Task 13.
- [x] Tooltip on auto-synced scores → Task 17.
- [x] Error handling matrix → implemented in Task 11 + Task 9.

No placeholders found on review; all steps have concrete code, exact paths, and run commands.

Type/name consistency: `EspnStatusName`, `EspnEvent`, `EspnCompetitor` used throughout; `isMatchEditable` signature matches between Task 8 test and Task 12 consumer; `loadAutoSyncMeta`/`saveAutoSyncMeta` consistent between Tasks 10 and 11; `loadBreakerState`/`saveBreakerState`/`resetBreaker`/`evaluateTick` consistent between Tasks 9, 11, 13, 14.

Scope: single feature, single plan — no decomposition needed.
