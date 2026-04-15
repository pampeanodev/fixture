import { describe, it, expect, beforeEach } from "vitest";
import {
  generateSalt,
  computeCommitment,
  verifyReveal,
  persistSalts,
  loadSalts,
} from "../commitReveal";

describe("generateSalt", () => {
  it("returns a 32-char hex string (16 bytes)", () => {
    const salt = generateSalt();
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
  });

  it("generates unique salts", () => {
    const a = generateSalt();
    const b = generateSalt();
    expect(a).not.toBe(b);
  });
});

describe("computeCommitment", () => {
  it("returns a 64-char hex SHA-256 hash", () => {
    const hash = computeCommitment("G-A-1", 2, 1, "abcdef1234567890abcdef1234567890");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different hashes for different scores", () => {
    const salt = "abcdef1234567890abcdef1234567890";
    const a = computeCommitment("G-A-1", 2, 1, salt);
    const b = computeCommitment("G-A-1", 1, 0, salt);
    expect(a).not.toBe(b);
  });

  it("produces different hashes for different salts", () => {
    const a = computeCommitment("G-A-1", 2, 1, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1");
    const b = computeCommitment("G-A-1", 2, 1, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2");
    expect(a).not.toBe(b);
  });

  it("produces different hashes for different matchIds", () => {
    const salt = "abcdef1234567890abcdef1234567890";
    const a = computeCommitment("G-A-1", 2, 1, salt);
    const b = computeCommitment("G-A-2", 2, 1, salt);
    expect(a).not.toBe(b);
  });
});

describe("verifyReveal", () => {
  it("returns true when reveal matches commitment", () => {
    const salt = "abcdef1234567890abcdef1234567890";
    const commitment = computeCommitment("G-A-1", 2, 1, salt);
    expect(verifyReveal("G-A-1", 2, 1, salt, commitment)).toBe(true);
  });

  it("returns false when score was tampered", () => {
    const salt = "abcdef1234567890abcdef1234567890";
    const commitment = computeCommitment("G-A-1", 2, 1, salt);
    expect(verifyReveal("G-A-1", 3, 1, salt, commitment)).toBe(false);
  });

  it("returns false when salt was tampered", () => {
    const salt = "abcdef1234567890abcdef1234567890";
    const commitment = computeCommitment("G-A-1", 2, 1, salt);
    expect(verifyReveal("G-A-1", 2, 1, "00000000000000000000000000000000", commitment)).toBe(false);
  });
});

describe("salt persistence", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips salts through localStorage", () => {
    const salts: Record<string, string> = { "G-A-1": "aabb", "G-A-2": "ccdd" };
    persistSalts("room1", salts);
    expect(loadSalts("room1")).toEqual(salts);
  });

  it("returns empty object for unknown room", () => {
    expect(loadSalts("unknown")).toEqual({});
  });

  it("keeps salts separate per room", () => {
    persistSalts("room1", { "G-A-1": "aabb" });
    persistSalts("room2", { "G-A-1": "ccdd" });
    expect(loadSalts("room1")["G-A-1"]).toBe("aabb");
    expect(loadSalts("room2")["G-A-1"]).toBe("ccdd");
  });
});
