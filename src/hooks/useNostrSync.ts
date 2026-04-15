import { useEffect, useRef, useCallback } from "react";
import { useNostr } from "../context/NostrContext";
import { useFixture } from "../context/FixtureContext";
import {
  subscribe,
  queryEvents,
  publishEvent,
} from "../nostr/relayPool";
import {
  getDTag,
  parseEventContent,
  buildCommitmentEvent,
  buildRevealEvent,
} from "../nostr/events";
import { enqueueEvent } from "../nostr/outbox";
import {
  computeCommitment,
  generateSalt,
  verifyReveal,
  loadSalts,
  persistSalts,
} from "../nostr/commitReveal";
import { NOSTR_KIND } from "../nostr/types";
import type {
  CommitmentPayload,
  RevealPayload,
  RevealEntry,
} from "../nostr/types";
import type { Score, Rival } from "../types";
import { isMatchLocked } from "../utils/lockTime";
import type { Event } from "nostr-tools/core";

export function useNostrSync(): void {
  const { identity, activeRoomId, connectionStatus } = useNostr();
  const { state, dispatch } = useFixture();
  const subRef = useRef<{ close: () => void } | null>(null);
  const commitmentsCache = useRef<Map<string, Record<string, string>>>(new Map());
  const nostrRivalsRef = useRef<Set<string>>(new Set());

  const processReveal = useCallback(
    (
      peerPubkey: string,
      payload: RevealPayload,
      peerCommitments: Record<string, string> | undefined,
    ): void => {
      // Strict commit-reveal: without a committed hash for this peer, we cannot verify — reject all.
      if (!peerCommitments) return;

      const groupPredictions: Record<string, Score> = {};
      const knockoutPredictions: Record<string, Score> = {};

      for (const [matchId, entry] of Object.entries(payload.predictions)) {
        const commitment = peerCommitments[matchId];
        if (!commitment) continue; // no commitment for this match — reject
        if (!verifyReveal(matchId, entry.home, entry.away, entry.salt, commitment)) {
          continue; // tampered — reject
        }
        const score: Score = { home: entry.home, away: entry.away };
        if (matchId.startsWith("G-")) {
          groupPredictions[matchId] = score;
        } else {
          knockoutPredictions[matchId] = score;
        }
      }

      // If no predictions verified, don't create a rival at all
      if (
        Object.keys(groupPredictions).length === 0 &&
        Object.keys(knockoutPredictions).length === 0
      ) {
        return;
      }

      const rivalName = payload.playerName || peerPubkey.slice(0, 8);
      const rival: Rival = {
        name: rivalName,
        groupPredictions,
        knockoutPredictions,
      };
      nostrRivalsRef.current.add(rivalName);
      dispatch({ type: "ADD_RIVAL", rival });
    },
    [dispatch],
  );

  // Subscribe to room events
  useEffect(() => {
    if (!activeRoomId || !identity || connectionStatus !== "connected") return;

    subRef.current?.close();
    // Clear rivals from previous room
    for (const name of nostrRivalsRef.current) {
      dispatch({ type: "REMOVE_RIVAL", name });
    }
    nostrRivalsRef.current.clear();
    commitmentsCache.current.clear();

    const commitDTag = getDTag(activeRoomId, "commit");
    const revealDTag = getDTag(activeRoomId, "reveal");

    subRef.current = subscribe(
      { kinds: [NOSTR_KIND], "#d": [commitDTag, revealDTag] },
      {
        onevent(event: Event) {
          if (event.pubkey === identity.pubkey) return;

          const dTag = event.tags.find((t) => t[0] === "d")?.[1];
          if (!dTag) return;

          if (dTag === commitDTag) {
            const payload = parseEventContent<CommitmentPayload>(event.content);
            if (payload) {
              commitmentsCache.current.set(event.pubkey, payload.commitments);
            }
          }

          if (dTag === revealDTag) {
            const payload = parseEventContent<RevealPayload>(event.content);
            if (!payload) return;
            const peerCommitments = commitmentsCache.current.get(event.pubkey);
            processReveal(event.pubkey, payload, peerCommitments);
          }
        },
      },
    );

    // Hydrate in order: collect commits first, then reveals, to avoid verification gaps.
    let cancelled = false;

    Promise.all([
      queryEvents({ kinds: [NOSTR_KIND], "#d": [commitDTag] }),
      queryEvents({ kinds: [NOSTR_KIND], "#d": [revealDTag] }),
    ]).then(([commitEvents, revealEvents]) => {
      if (cancelled) return;
      for (const event of commitEvents) {
        if (event.pubkey === identity.pubkey) continue;
        const payload = parseEventContent<CommitmentPayload>(event.content);
        if (payload) {
          commitmentsCache.current.set(event.pubkey, payload.commitments);
        }
      }
      for (const event of revealEvents) {
        if (event.pubkey === identity.pubkey) continue;
        const payload = parseEventContent<RevealPayload>(event.content);
        if (!payload) continue;
        const peerCommitments = commitmentsCache.current.get(event.pubkey);
        processReveal(event.pubkey, payload, peerCommitments);
      }
    });

    return () => {
      cancelled = true;
      subRef.current?.close();
      subRef.current = null;
    };
  }, [activeRoomId, identity, connectionStatus, dispatch, processReveal]);

  // Publish commitments when predictions change
  const publishCommitments = useCallback(() => {
    if (!identity || !activeRoomId || connectionStatus !== "connected") return;

    const salts = loadSalts(activeRoomId);
    const commitments: Record<string, string> = {};

    for (const match of state.groupMatches) {
      if (!match.prediction || isMatchLocked(match.dateUtc)) continue;
      if (!salts[match.id]) salts[match.id] = generateSalt();
      commitments[match.id] = computeCommitment(
        match.id,
        match.prediction.home,
        match.prediction.away,
        salts[match.id],
      );
    }
    for (const match of state.knockoutMatches) {
      if (!match.prediction || isMatchLocked(match.dateUtc)) continue;
      if (!salts[match.id]) salts[match.id] = generateSalt();
      commitments[match.id] = computeCommitment(
        match.id,
        match.prediction.home,
        match.prediction.away,
        salts[match.id],
      );
    }

    persistSalts(activeRoomId, salts);

    if (Object.keys(commitments).length === 0) return;

    const event = buildCommitmentEvent(activeRoomId, commitments);
    publishEvent(event, identity).catch(() => {
      enqueueEvent({ eventTemplate: event, createdAt: Date.now() });
    });
  }, [identity, activeRoomId, connectionStatus, state.groupMatches, state.knockoutMatches]);

  // Publish reveals for locked matches
  const publishReveals = useCallback(() => {
    if (!identity || !activeRoomId || connectionStatus !== "connected") return;

    const salts = loadSalts(activeRoomId);
    const predictions: Record<string, RevealEntry> = {};

    for (const match of state.groupMatches) {
      if (!match.prediction || !isMatchLocked(match.dateUtc)) continue;
      const salt = salts[match.id];
      if (!salt) continue;
      predictions[match.id] = {
        home: match.prediction.home,
        away: match.prediction.away,
        salt,
      };
    }
    for (const match of state.knockoutMatches) {
      if (!match.prediction || !isMatchLocked(match.dateUtc)) continue;
      const salt = salts[match.id];
      if (!salt) continue;
      predictions[match.id] = {
        home: match.prediction.home,
        away: match.prediction.away,
        salt,
      };
    }

    if (Object.keys(predictions).length === 0) return;

    const event = buildRevealEvent(activeRoomId, state.playerName, predictions);
    publishEvent(event, identity).catch(() => {
      enqueueEvent({ eventTemplate: event, createdAt: Date.now() });
    });
  }, [
    identity,
    activeRoomId,
    connectionStatus,
    state.groupMatches,
    state.knockoutMatches,
    state.playerName,
  ]);

  // Debounce commitment publishing on prediction changes
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!activeRoomId || !identity) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      publishCommitments();
      publishReveals();
    }, 2000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeRoomId, identity, publishCommitments, publishReveals]);
}
