import { describe, it, expect } from "vitest";
import { formatMatchDate, formatNumber } from "../format";

const FIXED_UTC = "2026-06-11T20:00:00Z";

describe("formatMatchDate", () => {
  it("formats in es-AR with 24h time", () => {
    const result = formatMatchDate(FIXED_UTC, "es");
    expect(result).toMatch(/·/);
    expect(result).not.toMatch(/AM|PM|a\.\s?m\.|p\.\s?m\./i);
  });
  it("formats in en-US with 12h time", () => {
    const result = formatMatchDate(FIXED_UTC, "en");
    expect(result).toMatch(/·/);
    expect(result).toMatch(/AM|PM/i);
  });
  it("formats in pt-BR with 24h time", () => {
    const result = formatMatchDate(FIXED_UTC, "pt");
    expect(result).toMatch(/·/);
    expect(result).not.toMatch(/AM|PM/i);
  });
  it("produces different output per locale", () => {
    const es = formatMatchDate(FIXED_UTC, "es");
    const en = formatMatchDate(FIXED_UTC, "en");
    const pt = formatMatchDate(FIXED_UTC, "pt");
    expect(es).not.toBe(en);
    expect(en).not.toBe(pt);
  });
});

describe("formatNumber", () => {
  it("formats integers per locale", () => {
    expect(formatNumber(1234, "en")).toBe("1,234");
    expect(formatNumber(1234, "es")).toBe("1.234");
    expect(formatNumber(1234, "pt")).toBe("1.234");
  });
});
