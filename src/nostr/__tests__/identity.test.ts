import { describe, it, expect, beforeEach } from "vitest";
import {
  generateIdentity,
  restoreFromMnemonic,
  persistIdentity,
  loadIdentity,
  clearIdentity,
} from "../identity";

beforeEach(() => {
  localStorage.clear();
});

describe("generateIdentity", () => {
  it("creates identity with 12-word mnemonic", () => {
    const id = generateIdentity();
    expect(id.mnemonic.split(" ")).toHaveLength(12);
    expect(id.secretKey).toBeInstanceOf(Uint8Array);
    expect(id.secretKey.length).toBe(32);
    expect(id.pubkey).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique identities each call", () => {
    const a = generateIdentity();
    const b = generateIdentity();
    expect(a.pubkey).not.toBe(b.pubkey);
  });
});

describe("restoreFromMnemonic", () => {
  it("restores the same keypair from the same mnemonic", () => {
    const original = generateIdentity();
    const restored = restoreFromMnemonic(original.mnemonic);
    expect(restored.pubkey).toBe(original.pubkey);
    expect(restored.mnemonic).toBe(original.mnemonic);
  });

  it("throws on invalid mnemonic", () => {
    expect(() => restoreFromMnemonic("invalid words here")).toThrow();
  });
});

describe("persist and load", () => {
  it("round-trips identity through localStorage", () => {
    const original = generateIdentity();
    persistIdentity(original);
    const loaded = loadIdentity();
    expect(loaded).not.toBeNull();
    expect(loaded!.pubkey).toBe(original.pubkey);
    expect(loaded!.mnemonic).toBe(original.mnemonic);
  });

  it("returns null when no identity persisted", () => {
    expect(loadIdentity()).toBeNull();
  });

  it("clears persisted identity", () => {
    persistIdentity(generateIdentity());
    clearIdentity();
    expect(loadIdentity()).toBeNull();
  });
});
