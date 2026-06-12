import { describe, it, expect } from "vitest";
import { randomizePredictions } from "../randomize";
import { TEAMS } from "../../data/teams";
import { INITIAL_GROUP_MATCHES } from "../../data/groupMatches";
import { INITIAL_KNOCKOUT_MATCHES } from "../../data/knockoutStructure";

// Tests inject a lock predicate: the default (real isMatchLocked) depends on
// the wall clock, which moves through the tournament window.
const NOTHING_LOCKED = () => false;

describe("randomizePredictions", () => {
  it("populates predictions for every group match", () => {
    const { groupMatches } = randomizePredictions(
      INITIAL_GROUP_MATCHES,
      INITIAL_KNOCKOUT_MATCHES,
      TEAMS,
      NOTHING_LOCKED,
    );
    for (const m of groupMatches) {
      expect(m.prediction).not.toBeNull();
      expect(Number.isInteger(m.prediction!.home)).toBe(true);
      expect(Number.isInteger(m.prediction!.away)).toBe(true);
    }
  });

  it("populates predictions for knockout matches with resolved teams", () => {
    const { knockoutMatches } = randomizePredictions(
      INITIAL_GROUP_MATCHES,
      INITIAL_KNOCKOUT_MATCHES,
      TEAMS,
      NOTHING_LOCKED,
    );
    // After randomizing, every knockout match should have resolved teams and a prediction
    for (const m of knockoutMatches) {
      expect(m.homeTeamId).not.toBeNull();
      expect(m.awayTeamId).not.toBeNull();
      expect(m.prediction).not.toBeNull();
    }
  });

  it("preserves original result field (does not overwrite results)", () => {
    const withResult = INITIAL_GROUP_MATCHES.map((m, i) =>
      i === 0 ? { ...m, result: { home: 5, away: 5 } } : m,
    );
    const { groupMatches } = randomizePredictions(
      withResult,
      INITIAL_KNOCKOUT_MATCHES,
      TEAMS,
      NOTHING_LOCKED,
    );
    expect(groupMatches[0].result).toEqual({ home: 5, away: 5 });
    for (let i = 1; i < groupMatches.length; i++) {
      expect(groupMatches[i].result).toBeNull();
    }
  });

  it("never touches predictions of locked matches", () => {
    const original = { home: 2, away: 1 };
    const withLockedPrediction = INITIAL_GROUP_MATCHES.map((m, i) =>
      i === 0 ? { ...m, prediction: { ...original } } : m,
    );
    const lockedId = withLockedPrediction[0].id;
    const { groupMatches } = randomizePredictions(
      withLockedPrediction,
      INITIAL_KNOCKOUT_MATCHES,
      TEAMS,
      (dateUtc) => dateUtc === withLockedPrediction[0].dateUtc,
    );
    expect(groupMatches.find((m) => m.id === lockedId)!.prediction).toEqual(original);
  });

  it("knockout predictions for draws include penalties", () => {
    const { knockoutMatches } = randomizePredictions(
      INITIAL_GROUP_MATCHES,
      INITIAL_KNOCKOUT_MATCHES,
      TEAMS,
      NOTHING_LOCKED,
    );
    for (const m of knockoutMatches) {
      if (!m.prediction) continue;
      if (m.prediction.home === m.prediction.away) {
        expect(m.prediction.penalties).toBeDefined();
      } else {
        expect(m.prediction.penalties).toBeUndefined();
      }
    }
  });
});
