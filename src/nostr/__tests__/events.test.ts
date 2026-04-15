import { describe, it, expect } from "vitest";
import {
  buildManifestEvent,
  buildClaimEvent,
  buildCommitmentEvent,
  buildRevealEvent,
  parseEventContent,
  getDTag,
} from "../events";
import { NOSTR_KIND, TAG_PREFIX } from "../types";
import type { RoomManifest, CommitmentPayload, RevealPayload } from "../types";

describe("getDTag", () => {
  it("builds correct d-tag for manifest", () => {
    expect(getDTag("abc123", "manifest")).toBe(`${TAG_PREFIX}:abc123:manifest`);
  });
});

describe("buildManifestEvent", () => {
  it("creates a valid event template with correct tags and content", () => {
    const manifest: RoomManifest = {
      roomId: "abc123", mode: "closed", creator: "pk1", validInvites: ["t8f2"],
    };
    const event = buildManifestEvent(manifest);
    expect(event.kind).toBe(NOSTR_KIND);
    expect(event.tags).toContainEqual(["d", `${TAG_PREFIX}:abc123:manifest`]);
    const content = JSON.parse(event.content) as RoomManifest;
    expect(content.mode).toBe("closed");
    expect(content.validInvites).toEqual(["t8f2"]);
  });
});

describe("buildClaimEvent", () => {
  it("creates event with room ID and invite code", () => {
    const event = buildClaimEvent("abc123", "t8f2");
    expect(event.tags).toContainEqual(["d", `${TAG_PREFIX}:abc123:claim`]);
    const content = JSON.parse(event.content);
    expect(content.inviteCode).toBe("t8f2");
  });
});

describe("buildCommitmentEvent", () => {
  it("creates event with commitment hashes", () => {
    const commitments: Record<string, string> = { "G-A-1": "hash1", "G-A-2": "hash2" };
    const event = buildCommitmentEvent("abc123", commitments);
    expect(event.tags).toContainEqual(["d", `${TAG_PREFIX}:abc123:commit`]);
    const content = JSON.parse(event.content) as CommitmentPayload;
    expect(content.commitments["G-A-1"]).toBe("hash1");
  });
});

describe("buildRevealEvent", () => {
  it("creates event with revealed predictions and player name", () => {
    const predictions = {
      "G-A-1": { home: 2, away: 1, salt: "aabb" },
    };
    const event = buildRevealEvent("abc123", "Agus", predictions);
    expect(event.tags).toContainEqual(["d", `${TAG_PREFIX}:abc123:reveal`]);
    const content = JSON.parse(event.content) as RevealPayload;
    expect(content.playerName).toBe("Agus");
    expect(content.predictions["G-A-1"].home).toBe(2);
    expect(content.predictions["G-A-1"].salt).toBe("aabb");
  });
});

describe("parseEventContent", () => {
  it("parses valid JSON content", () => {
    const result = parseEventContent<CommitmentPayload>('{"commitments":{"a":"b"}}');
    expect(result).not.toBeNull();
    expect(result!.commitments.a).toBe("b");
  });

  it("returns null for invalid JSON", () => {
    expect(parseEventContent("not json")).toBeNull();
  });
});
