import { describe, it, expect, vi, afterEach } from "vitest";
import { detectLocale } from "../detect";

function mockLanguages(langs: string[]) {
  Object.defineProperty(navigator, "languages", {
    value: langs, configurable: true,
  });
}

describe("detectLocale", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns 'es' when browser prefers Spanish", () => {
    mockLanguages(["es-AR", "en"]);
    expect(detectLocale()).toBe("es");
  });
  it("returns 'en' when browser prefers English", () => {
    mockLanguages(["en-US"]);
    expect(detectLocale()).toBe("en");
  });
  it("returns 'pt' for pt-BR", () => {
    mockLanguages(["pt-BR"]);
    expect(detectLocale()).toBe("pt");
  });
  it("returns 'pt' for pt-PT", () => {
    mockLanguages(["pt-PT"]);
    expect(detectLocale()).toBe("pt");
  });
  it("picks the first supported language in the preference order", () => {
    mockLanguages(["fr-FR", "en-GB", "es-AR"]);
    expect(detectLocale()).toBe("en");
  });
  it("falls back to 'es' when no language is supported", () => {
    mockLanguages(["ja-JP", "ko-KR"]);
    expect(detectLocale()).toBe("es");
  });
  it("handles empty navigator.languages", () => {
    mockLanguages([]);
    expect(detectLocale()).toBe("es");
  });
});
