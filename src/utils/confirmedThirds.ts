// src/utils/confirmedThirds.ts
import type { GroupMatch, Score, StandingRow } from "../types";
import { calculateStandings } from "./standings";
import { selectBestThirds, type ThirdPlaceEntry } from "./bestThirds";
import { assignThirdPlaceSlots, type ThirdPlaceAssignment } from "../data/thirdPlaceMapping";

export interface GroupThirdInput {
  group: string;
  matches: GroupMatch[]; // that group's matches (real results read from `result`)
  teamIds: string[];
}

export interface ConfirmedThirds {
  /** group → R32 match id, only for groups whose third-place slot is locked. */
  assignment: ThirdPlaceAssignment;
  /** the groups whose third is confirmed (always a subset of completed groups). */
  qualifyingGroups: string[];
}

// Goal ceiling when enumerating the scorelines of unplayed matches. The lock
// decision only ever turns on whether a *variable* third can pass a *fixed*
// (completed-group) third on goal difference / goals, and completed thirds sit
// in a narrow GD band — a swing of ±(2·GOAL_CAP) per remaining match dwarfs it,
// so the result is invariant above a small cap (verified stable for cap 3→10).
const GOAL_CAP = 6;
// Per-group scoreline budget: (GOAL_CAP+1)^(2·remaining). 2 unplayed matches =
// 7^4 = 2401; 3 would be 7^6 ≈ 118k, past which we bail (see below).
const PER_GROUP_SCENARIOS = 50_000;
// Cross-product budget across incomplete groups. Beyond this we can't afford to
// enumerate, so we confirm nothing (callers fall back to the projected bracket).
const MAX_COMBOS = 1_000_000;

const empty: ConfirmedThirds = { assignment: {}, qualifyingGroups: [] };

/**
 * The third-placed teams whose Round-of-32 slot is already mathematically locked
 * by real results — even before every group has finished.
 *
 * A third's R32 slot depends on the *whole* set of 8 qualifying third-groups
 * (FIFA's Annexe C is a per-combination lookup). So a completed group's third is
 * confirmed only when, across every still-possible completion of the unfinished
 * groups, (a) that group always lands among the 8 best thirds and (b) it always
 * maps to the same R32 match. Both conditions are checked by enumerating the
 * possible third-place outcomes of the unfinished groups.
 *
 * Sound by construction — it never confirms a slot that some legal completion
 * could change — and conservative when the search space is too large (returns
 * nothing rather than guessing). Only completed groups can be confirmed: an
 * unfinished group's third-placed *team* isn't settled yet.
 */
export function confirmedThirds(groups: GroupThirdInput[]): ConfirmedThirds {
  // Distinct possible third-place rows per group. A completed group yields one
  // row (its actual third); an unfinished one yields every reachable third.
  const completed: { group: string; row: StandingRow }[] = [];
  const variable: { group: string; rows: StandingRow[] }[] = [];

  for (const g of groups) {
    const remaining = g.matches.filter((m) => m.result === null);
    if (remaining.length === 0) {
      const standings = calculateStandings(g.matches, g.teamIds, "result");
      if (standings.length >= 3) completed.push({ group: g.group, row: standings[2] });
      continue;
    }
    if ((GOAL_CAP + 1) ** (2 * remaining.length) > PER_GROUP_SCENARIOS) return empty;
    variable.push({ group: g.group, rows: possibleThirdRows(g, remaining) });
  }

  if (completed.length === 0) return empty;

  let combos = 1;
  for (const v of variable) combos *= v.rows.length;
  if (combos > MAX_COMBOS) return empty;

  // Walk every combination of unfinished-group outcomes. For each, rank all 12
  // thirds and record, per completed group, whether it qualifies and into which
  // slot. A group stays "locked" only while it qualifies in every combination
  // with one and the same slot.
  const slotsByGroup = new Map<string, Set<string | null>>();
  for (const c of completed) slotsByGroup.set(c.group, new Set());

  const fixed: ThirdPlaceEntry[] = completed.map((c) => ({ group: c.group, standing: c.row }));

  const visit = (i: number, picked: ThirdPlaceEntry[]) => {
    if (i === variable.length) {
      const qualifying = selectBestThirds([...fixed, ...picked]).qualifying;
      const qualifyingGroups = qualifying.map((t) => t.group);
      const assignment = assignThirdPlaceSlots(qualifyingGroups);
      const qualifyingSet = new Set(qualifyingGroups);
      for (const c of completed) {
        slotsByGroup.get(c.group)!.add(qualifyingSet.has(c.group) ? assignment[c.group] : null);
      }
      return;
    }
    for (const row of variable[i].rows) {
      picked.push({ group: variable[i].group, standing: row });
      visit(i + 1, picked);
      picked.pop();
    }
  };
  visit(0, []);

  const assignment: ThirdPlaceAssignment = {};
  const qualifyingGroups: string[] = [];
  for (const c of completed) {
    const slots = slotsByGroup.get(c.group)!;
    if (slots.size === 1) {
      const [slot] = slots;
      if (slot !== null) {
        assignment[c.group] = slot;
        qualifyingGroups.push(c.group);
      }
    }
  }
  return { assignment, qualifyingGroups };
}

// Every distinct third-place row a group can still finish with, deduped by the
// fields that decide the cross-group ranking (team, points, GD, goals for).
function possibleThirdRows(g: GroupThirdInput, remaining: GroupMatch[]): StandingRow[] {
  const seen = new Map<string, StandingRow>();
  const scores: Score[] = [];

  const enumerate = (i: number) => {
    if (i === remaining.length) {
      const hypothetical = g.matches.map((m) => {
        const idx = remaining.indexOf(m);
        return idx === -1 ? m : { ...m, result: scores[idx] };
      });
      const third = calculateStandings(hypothetical, g.teamIds, "result")[2];
      if (third) {
        const key = `${third.teamId}|${third.points}|${third.goalDifference}|${third.goalsFor}`;
        if (!seen.has(key)) seen.set(key, third);
      }
      return;
    }
    for (let home = 0; home <= GOAL_CAP; home++) {
      for (let away = 0; away <= GOAL_CAP; away++) {
        scores[i] = { home, away };
        enumerate(i + 1);
      }
    }
  };
  enumerate(0);
  return [...seen.values()];
}
