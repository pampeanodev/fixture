import { generateSeedWords, privateKeyFromSeedWords } from "nostr-tools/nip06";
import { getPublicKey } from "nostr-tools/pure";
import * as nip19 from "nostr-tools/nip19";
import type { NostrIdentity } from "./types";

const NSEC_KEY = "wc2026-nostr-nsec";
const MNEMONIC_KEY = "wc2026-nostr-mnemonic";

export function generateIdentity(): NostrIdentity {
  const mnemonic = generateSeedWords();
  return deriveIdentity(mnemonic);
}

export function restoreFromMnemonic(mnemonic: string): NostrIdentity {
  // privateKeyFromSeedWords throws on invalid mnemonic
  return deriveIdentity(mnemonic);
}

function deriveIdentity(mnemonic: string): NostrIdentity {
  const secretKey = privateKeyFromSeedWords(mnemonic);
  const pubkey = getPublicKey(secretKey);
  return { secretKey, pubkey, mnemonic };
}

export function persistIdentity(identity: NostrIdentity): void {
  try {
    localStorage.setItem(NSEC_KEY, nip19.nsecEncode(identity.secretKey));
    localStorage.setItem(MNEMONIC_KEY, identity.mnemonic);
  } catch {
    /* storage full or unavailable */
  }
}

export function loadIdentity(): NostrIdentity | null {
  try {
    const nsec = localStorage.getItem(NSEC_KEY);
    const mnemonic = localStorage.getItem(MNEMONIC_KEY);
    if (!nsec || !mnemonic) return null;
    const { type, data } = nip19.decode(nsec);
    if (type !== "nsec") return null;
    const secretKey = data;
    const pubkey = getPublicKey(secretKey);
    return { secretKey, pubkey, mnemonic };
  } catch {
    return null;
  }
}

export function clearIdentity(): void {
  localStorage.removeItem(NSEC_KEY);
  localStorage.removeItem(MNEMONIC_KEY);
}

export function encodeNsec(identity: NostrIdentity): string {
  return nip19.nsecEncode(identity.secretKey);
}

export function encodeNpub(identity: NostrIdentity): string {
  return nip19.npubEncode(identity.pubkey);
}
