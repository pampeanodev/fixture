import { describe, it, expect } from "vitest";
import { es } from "../../../i18n/locales/es";
import { individualSteps, roomSteps, type Step } from "../steps";

function resolveKey(path: string): unknown {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, es);
}

function assertStepKeysResolve(steps: readonly Step[]): void {
  for (const step of steps) {
    expect(resolveKey(step.titleKey), `title key missing: ${step.titleKey}`).toEqual(
      expect.any(String),
    );
    expect(resolveKey(step.bodyKey), `body key missing: ${step.bodyKey}`).toEqual(
      expect.any(String),
    );
  }
}

describe("howToPlay steps", () => {
  it("individual has 7 steps", () => {
    expect(individualSteps).toHaveLength(7);
  });

  it("room has 5 steps", () => {
    expect(roomSteps).toHaveLength(5);
  });

  it("every individual step resolves to existing i18n keys", () => {
    assertStepKeysResolve(individualSteps);
  });

  it("every room step resolves to existing i18n keys", () => {
    assertStepKeysResolve(roomSteps);
  });
});
