// src/utils/effectiveScore.ts
import type { Score, ScoreSource } from "../types";

/**
 * Resolve the score a match contributes to group standings and knockout
 * projection. "hybrid" projects the tournament forward: it uses the real result
 * once one exists, otherwise the prediction — so completed fixtures reflect
 * reality while not-yet-played ones keep advancing teams from the user's
 * (locked) predictions. "result" / "prediction" read that single field only.
 */
export function effectiveScore(
  match: { result: Score | null; prediction: Score | null },
  source: ScoreSource,
): Score | null {
  if (source === "hybrid") return match.result ?? match.prediction;
  return match[source];
}
