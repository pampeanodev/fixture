import { describe, it, expect, beforeEach } from "vitest";
import {
  createRoom,
  generateInviteCode,
  persistRooms,
  loadRooms,
  addRoom,
  removeRoom,
  isValidMember,
} from "../rooms";
import type { RoomManifest, RoomMembership } from "../types";

beforeEach(() => localStorage.clear());

describe("createRoom", () => {
  it("returns an 8-char alphanumeric room ID", () => {
    const roomId = createRoom();
    expect(roomId).toMatch(/^[a-z0-9]{8}$/);
  });

  it("generates unique IDs", () => {
    const a = createRoom();
    const b = createRoom();
    expect(a).not.toBe(b);
  });
});

describe("generateInviteCode", () => {
  it("returns a 4-char alphanumeric code", () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[a-z0-9]{4}$/);
  });
});

describe("room persistence", () => {
  it("round-trips rooms through localStorage", () => {
    const rooms: RoomMembership[] = [
      { roomId: "abc12345", name: "Asado", joinedAt: 1000, role: "creator" },
    ];
    persistRooms(rooms);
    expect(loadRooms()).toEqual(rooms);
  });

  it("returns empty array when nothing persisted", () => {
    expect(loadRooms()).toEqual([]);
  });
});

describe("addRoom", () => {
  it("adds a new room to the list", () => {
    const rooms: RoomMembership[] = [];
    const updated = addRoom(rooms, {
      roomId: "abc12345", name: "Asado", joinedAt: 1000, role: "creator",
    });
    expect(updated).toHaveLength(1);
    expect(updated[0].roomId).toBe("abc12345");
  });

  it("does not duplicate if room already exists", () => {
    const rooms: RoomMembership[] = [
      { roomId: "abc12345", name: "Asado", joinedAt: 1000, role: "creator" },
    ];
    const updated = addRoom(rooms, {
      roomId: "abc12345", name: "Asado v2", joinedAt: 2000, role: "member",
    });
    expect(updated).toHaveLength(1);
    expect(updated[0].name).toBe("Asado v2");
  });
});

describe("removeRoom", () => {
  it("removes a room by ID", () => {
    const rooms: RoomMembership[] = [
      { roomId: "abc12345", name: "Asado", joinedAt: 1000, role: "creator" },
      { roomId: "def67890", name: "Oficina", joinedAt: 2000, role: "member" },
    ];
    expect(removeRoom(rooms, "abc12345")).toHaveLength(1);
    expect(removeRoom(rooms, "abc12345")[0].roomId).toBe("def67890");
  });
});

describe("isValidMember", () => {
  const openManifest: RoomManifest = {
    roomId: "abc12345", mode: "open", creator: "pubkey1", validInvites: [],
  };
  const closedManifest: RoomManifest = {
    roomId: "abc12345", mode: "closed", creator: "pubkey1", validInvites: ["t8f2", "n3k9"],
  };

  it("always allows members in open rooms", () => {
    expect(isValidMember(openManifest, "anyone", undefined, [])).toBe(true);
  });

  it("allows creator in closed rooms without invite", () => {
    expect(isValidMember(closedManifest, "pubkey1", undefined, [])).toBe(true);
  });

  it("allows members with a valid claimed invite in closed rooms", () => {
    const claims = [{ pubkey: "pubkey2", inviteCode: "t8f2", claimedAt: 1000 }];
    expect(isValidMember(closedManifest, "pubkey2", "t8f2", claims)).toBe(true);
  });

  it("rejects members without a valid invite in closed rooms", () => {
    expect(isValidMember(closedManifest, "pubkey2", undefined, [])).toBe(false);
  });

  it("rejects if invite code was claimed by someone else", () => {
    const claims = [{ pubkey: "pubkey3", inviteCode: "t8f2", claimedAt: 1000 }];
    expect(isValidMember(closedManifest, "pubkey2", "t8f2", claims)).toBe(false);
  });
});
