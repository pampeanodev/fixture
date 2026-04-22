import { describe, it, expect } from "vitest";
import { createT } from "../translate";
import { es } from "../locales/es";

describe("createT", () => {
  const t = createT(es, "es");

  it("returns a simple string by path", () => {
    expect(t("topbar.mode.predictions")).toBe("Predicciones");
  });
  it("interpolates variables", () => {
    expect(t("groups.title", { group: "A" })).toBe("Grupo A");
  });
  it("handles plural base with count=1 → One", () => {
    expect(t("ranking.points", { count: 1 })).toBe("1 punto");
  });
  it("handles plural base with count=5 → Other", () => {
    expect(t("ranking.points", { count: 5 })).toBe("5 puntos");
  });
  it("interpolates count itself into plural variants", () => {
    expect(t("ranking.points", { count: 0 })).toBe("0 puntos");
  });
  it("returns the key itself if path is missing (dev-visible fallback)", () => {
    // @ts-expect-error — forzar path inválido
    expect(t("nonexistent.path")).toBe("nonexistent.path");
  });
  it("works for dynamic team keys", () => {
    expect(t("teams.ARG")).toBe("Argentina");
  });
});
