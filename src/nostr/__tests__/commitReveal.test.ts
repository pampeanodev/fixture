import { describe, it, expect, beforeEach } from "vitest";
import {
  generateSalt,
  computeCommitment,
  verifyReveal,
  persistSalts,
  loadSalts,
  buildCommitmentMap,
} from "../commitReveal";

describe("buildCommitmentMap", () => {
  const open = { id: "G-A-2", dateUtc: "2026-06-20T18:00:00Z", prediction: { home: 1, away: 0 } };
  const locked = { id: "G-A-1", dateUtc: "2026-06-11T18:00:00Z", prediction: { home: 2, away: 1 } };
  const isLocked = (dateUtc: string) => dateUtc === locked.dateUtc;

  it("keeps previously committed hashes for locked matches (replaceable event must stay cumulative)", () => {
    const salt = "aa".repeat(16);
    const { commitments } = buildCommitmentMap([locked], { "G-A-1": salt }, isLocked);
    expect(commitments["G-A-1"]).toBe(computeCommitment("G-A-1", 2, 1, salt));
  });

  it("prefers the stored hash for locked matches over recomputing (post-lock prediction corruption must not rewrite the commitment)", () => {
    const salt = "aa".repeat(16);
    const originalHash = computeCommitment("G-A-1", 9, 9, salt); // committed pre-lock with a different prediction
    const { commitments } = buildCommitmentMap(
      [locked], // current prediction is 2-1, but that's NOT what was committed
      { "G-A-1": salt },
      isLocked,
      { "G-A-1": originalHash },
    );
    expect(commitments["G-A-1"]).toBe(originalHash);
  });

  it("recomputes unlocked matches even when a stored hash exists (prediction edits must update the commitment)", () => {
    const salt = "bb".repeat(16);
    const staleHash = computeCommitment("G-A-2", 9, 9, salt);
    const { commitments } = buildCommitmentMap(
      [open],
      { "G-A-2": salt },
      isLocked,
      { "G-A-2": staleHash },
    );
    expect(commitments["G-A-2"]).toBe(computeCommitment("G-A-2", 1, 0, salt));
  });

  it("never mints a commitment for a locked match without a prior salt", () => {
    const { commitments, salts } = buildCommitmentMap([locked], {}, isLocked);
    expect(commitments["G-A-1"]).toBeUndefined();
    expect(salts["G-A-1"]).toBeUndefined();
  });

  it("mints a salt and commitment for an open match", () => {
    const { commitments, salts } = buildCommitmentMap([open], {}, isLocked);
    expect(salts["G-A-2"]).toMatch(/^[0-9a-f]{32}$/);
    expect(commitments["G-A-2"]).toBe(computeCommitment("G-A-2", 1, 0, salts["G-A-2"]));
  });

  it("reuses the existing salt for an open match", () => {
    const salt = "bb".repeat(16);
    const { commitments, salts } = buildCommitmentMap([open], { "G-A-2": salt }, isLocked);
    expect(salts["G-A-2"]).toBe(salt);
    expect(commitments["G-A-2"]).toBe(computeCommitment("G-A-2", 1, 0, salt));
  });

  it("skips matches without a prediction and does not mutate the input salts", () => {
    const input: Record<string, string> = {};
    const noPred = { id: "G-A-3", dateUtc: "2026-06-21T18:00:00Z", prediction: null };
    const { commitments } = buildCommitmentMap([noPred], input, isLocked);
    expect(commitments).toEqual({});
    expect(input).toEqual({});
  });
});

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
