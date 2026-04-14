export interface NostrIdentity {
  secretKey: Uint8Array;
  pubkey: string;          // hex
  mnemonic: string;        // 12-word BIP-39 seed phrase
}

export interface RoomManifest {
  roomId: string;
  mode: "open" | "closed";
  creator: string;         // pubkey hex of creator
  validInvites: string[];  // invite codes (closed rooms only)
}

export interface InviteClaim {
  roomId: string;
  inviteCode: string;
}

export interface CommitmentPayload {
  commitments: Record<string, string>; // matchId -> SHA-256 hash hex
}

export interface RevealEntry {
  home: number;
  away: number;
  salt: string; // hex
}

export interface RevealPayload {
  playerName: string;  // display name of the player
  predictions: Record<string, RevealEntry>; // matchId -> prediction + salt
}

export interface RoomMembership {
  roomId: string;
  name: string;            // user-editable display name for the room
  joinedAt: number;        // unix timestamp
  inviteCode?: string;     // the code used to join (closed rooms)
  role: "creator" | "member";
}

export interface OutboxEntry {
  eventTemplate: {
    kind: number;
    created_at: number;
    tags: string[][];
    content: string;
  };
  createdAt: number;
}

export type ConnectionStatus = "offline" | "connecting" | "connected";

/** Nostr event kind for all fixture app events (NIP-78 arbitrary app data) */
export const NOSTR_KIND = 30078;

export const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band",
];

/** Prefix for all d-tags to namespace our events */
export const TAG_PREFIX = "fixture";
