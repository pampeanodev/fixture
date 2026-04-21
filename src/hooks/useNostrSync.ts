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
  buildResultsEvent,
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
  ResultsPayload,
  RoomManifest,
} from "../nostr/types";
import type { Member, Score, Rival } from "../types";
import { isMatchLocked } from "../utils/lockTime";
import type { Event } from "nostr-tools/core";

export function useNostrSync(): void {
  const { identity, activeRoomId, connectionStatus, rooms } = useNostr();
  const { state, dispatch } = useFixture();
  const subRef = useRef<{ close: () => void } | null>(null);
  const resultsSubRef = useRef<{ close: () => void } | null>(null);
  const commitmentsCache = useRef<Map<string, Record<string, string>>>(new Map());
  const nostrRivalsRef = useRef<Set<string>>(new Set());
  const creatorRef = useRef<string | null>(null);

  function memberNameFor(pubkey: string, claimed: string | undefined): string {
    const trimmed = claimed?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : pubkey.slice(0, 8);
  }

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
    // Clear rivals + members from previous room
    for (const name of nostrRivalsRef.current) {
      dispatch({ type: "REMOVE_RIVAL", name });
    }
    nostrRivalsRef.current.clear();
    commitmentsCache.current.clear();
    dispatch({ type: "CLEAR_MEMBERS" });

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
              dispatch({
                type: "UPSERT_MEMBER",
                member: {
                  pubkey: event.pubkey,
                  name: memberNameFor(event.pubkey, payload.playerName),
                },
              });
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
      const authoritativeMembers: Member[] = [];
      for (const event of commitEvents) {
        if (event.pubkey === identity.pubkey) continue;
        const payload = parseEventContent<CommitmentPayload>(event.content);
        if (payload) {
          commitmentsCache.current.set(event.pubkey, payload.commitments);
          authoritativeMembers.push({
            pubkey: event.pubkey,
            name: memberNameFor(event.pubkey, payload.playerName),
          });
        }
      }
      dispatch({ type: "SET_MEMBERS", members: authoritativeMembers });
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

    const event = buildCommitmentEvent(activeRoomId, commitments, state.playerName);
    publishEvent(event, identity).catch(() => {
      enqueueEvent({ eventTemplate: event, createdAt: Date.now() });
    });
  }, [identity, activeRoomId, connectionStatus, state.groupMatches, state.knockoutMatches, state.playerName]);

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

  // Fetch manifest + subscribe/apply admin result broadcasts
  useEffect(() => {
    if (!activeRoomId || !identity || connectionStatus !== "connected") return;

    resultsSubRef.current?.close();
    resultsSubRef.current = null;
    dispatch({ type: "CLEAR_SYNCED_RESULTS" });

    // Fast path: I created this room locally, so I know I'm the creator.
    // publishResults uses creatorRef synchronously; skip the relay roundtrip.
    const myMembership = rooms.find((r) => r.roomId === activeRoomId);
    if (myMembership?.role === "creator") {
      creatorRef.current = identity.pubkey;
      return () => {
        resultsSubRef.current?.close();
        resultsSubRef.current = null;
      };
    }

    // Member path: fetch manifest to know creator pubkey, then subscribe filtered.
    creatorRef.current = null;
    const manifestDTag = getDTag(activeRoomId, "manifest");
    const resultsDTag = getDTag(activeRoomId, "results");
    let cancelled = false;

    function applyResultsEvent(event: Event, expectedCreator: string): void {
      if (event.pubkey !== expectedCreator) return;
      const payload = parseEventContent<ResultsPayload>(event.content);
      if (!payload) return;
      dispatch({
        type: "APPLY_SYNCED_RESULTS",
        groupResults: payload.groupResults,
        knockoutResults: payload.knockoutResults,
      });
    }

    queryEvents({ kinds: [NOSTR_KIND], "#d": [manifestDTag] }).then((events) => {
      if (cancelled) return;
      const latest = events.sort((a, b) => b.created_at - a.created_at)[0];
      if (!latest) return;
      const manifest = parseEventContent<RoomManifest>(latest.content);
      if (!manifest) return;
      creatorRef.current = manifest.creator;

      resultsSubRef.current = subscribe(
        { kinds: [NOSTR_KIND], "#d": [resultsDTag], authors: [manifest.creator] },
        {
          onevent(event: Event) {
            applyResultsEvent(event, manifest.creator);
          },
        },
      );

      queryEvents({ kinds: [NOSTR_KIND], "#d": [resultsDTag], authors: [manifest.creator] }).then(
        (pastEvents) => {
          if (cancelled) return;
          const latestResults = pastEvents.sort((a, b) => b.created_at - a.created_at)[0];
          if (latestResults) applyResultsEvent(latestResults, manifest.creator);
        },
      );
    });

    return () => {
      cancelled = true;
      resultsSubRef.current?.close();
      resultsSubRef.current = null;
    };
  }, [activeRoomId, identity, connectionStatus, rooms, dispatch]);

  // Publish room results (creator only, not during simulation)
  const publishResults = useCallback(() => {
    if (!identity || !activeRoomId || connectionStatus !== "connected") return;
    if (state.simulationActive) return;
    if (creatorRef.current !== identity.pubkey) return;

    const groupResults: ResultsPayload["groupResults"] = {};
    for (const match of state.groupMatches) {
      if (match.result) {
        groupResults[match.id] = { home: match.result.home, away: match.result.away };
      }
    }
    const knockoutResults: ResultsPayload["knockoutResults"] = {};
    for (const match of state.knockoutMatches) {
      if (match.result) {
        knockoutResults[match.id] = {
          home: match.result.home,
          away: match.result.away,
          penalties: match.result.penalties,
        };
      }
    }

    if (Object.keys(groupResults).length === 0 && Object.keys(knockoutResults).length === 0) {
      return;
    }

    const event = buildResultsEvent(activeRoomId, groupResults, knockoutResults);
    publishEvent(event, identity).catch(() => {
      enqueueEvent({ eventTemplate: event, createdAt: Date.now() });
    });
  }, [identity, activeRoomId, connectionStatus, state.groupMatches, state.knockoutMatches, state.simulationActive]);

  // Debounce commitment publishing on prediction changes
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!activeRoomId || !identity) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      publishCommitments();
      publishReveals();
      publishResults();
    }, 2000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeRoomId, identity, publishCommitments, publishReveals, publishResults]);
}
