import { describe, expect, it } from "vitest";
import { effectiveScore } from "../effectiveScore";
import type { Score } from "../../types";

const result: Score = { home: 2, away: 0 };
const prediction: Score = { home: 1, away: 1 };

describe("effectiveScore", () => {
  it("'result' reads only the real result", () => {
    expect(effectiveScore({ result, prediction }, "result")).toBe(result);
    expect(effectiveScore({ result: null, prediction }, "result")).toBeNull();
  });

  it("'prediction' reads only the prediction", () => {
    expect(effectiveScore({ result, prediction }, "prediction")).toBe(prediction);
    expect(effectiveScore({ result, prediction: null }, "prediction")).toBeNull();
  });

  it("'hybrid' prefers the real result when it exists", () => {
    expect(effectiveScore({ result, prediction }, "hybrid")).toBe(result);
  });

  it("'hybrid' falls back to the prediction when there is no result", () => {
    expect(effectiveScore({ result: null, prediction }, "hybrid")).toBe(prediction);
  });

  it("'hybrid' is null when neither exists", () => {
    expect(effectiveScore({ result: null, prediction: null }, "hybrid")).toBeNull();
  });
});
