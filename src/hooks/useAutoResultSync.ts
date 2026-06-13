// src/hooks/useAutoResultSync.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { useFixture } from "../context/FixtureContext";
import {
  fetchScoreboard,
  AutoSyncNetworkError,
} from "../espn/client";
import { parseScoreboard } from "../espn/parser";
import { validateEvent } from "../espn/validator";
import { matchEvent } from "../espn/matcher";
import {
  buildFetchDates,
  isWithinTournamentWindow,
} from "../espn/tournamentWindow";
import {
  countsTowardBreaker,
  evaluateTick,
  loadBreakerState,
  saveBreakerState,
  type BreakerState,
  type TickOutcome,
} from "../espn/circuitBreaker";
import {
  loadAutoSyncMeta,
  saveAutoSyncMeta,
  type AutoSyncMeta,
} from "../espn/autoSyncMeta";
import { getEffectiveNow } from "../utils/devClock";
import { hasKickedOff } from "../utils/resultsGuard";
import type { EspnEvent } from "../espn/types";
import type { Score } from "../types";

const INTERVAL_MS = 30 * 60 * 1000;

function scoreFromEvent(ev: EspnEvent): Score {
  const score: Score = { home: ev.home.score, away: ev.away.score };
  if (ev.statusName === "STATUS_FINAL_PEN" && ev.shootout) {
    score.penalties = { home: ev.shootout.home, away: ev.shootout.away };
  }
  return score;
}

function scoresDiffer(a: Score, b: Score): boolean {
  if (a.home !== b.home || a.away !== b.away) return true;
  if (!a.penalties !== !b.penalties) return true;
  if (a.penalties && b.penalties) {
    return a.penalties.home !== b.penalties.home || a.penalties.away !== b.penalties.away;
  }
  return false;
}

export function useAutoResultSync(): void {
  const { state, dispatch } = useFixture();
  const inFlightRef = useRef<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Latest state via ref so runTick stays referentially stable — the mount
  // effect must not tear down/refire the interval (and refetch) on every
  // state change.
  const stateRef = useRef(state);
  stateRef.current = state;

  // Breaker state is mirrored in React so the UI re-renders on trip.
  const [breaker, setBreaker] = useState<BreakerState>(() => loadBreakerState());
  const breakerRef = useRef<BreakerState>(breaker);
  breakerRef.current = breaker;

  const runTick = useCallback(async (): Promise<void> => {
    if (breakerRef.current.tripped) return;
    if (typeof document !== "undefined" && document.hidden) return;
    // Never write over an active simulation; results are re-imposed next tick.
    if (stateRef.current.simulationActive) return;
    const now = getEffectiveNow();
    if (!isWithinTournamentWindow(now)) return;
    if (inFlightRef.current) return;

    // Self-clean before fetching: a local result for a match that hasn't
    // kicked off is garbage by definition (manual entry during an outage,
    // legacy bugs) and ESPN has no final to overwrite it with.
    const premature = [
      ...stateRef.current.groupMatches,
      ...stateRef.current.knockoutMatches,
    ]
      .filter((m) => m.result !== null && !hasKickedOff(m.id, now))
      .map((m) => m.id);
    if (premature.length > 0) {
      console.warn(`[autosync] clearing premature local results: ${premature.join(", ")}`);
      dispatch({ type: "CLEAR_PREMATURE_RESULTS", matchIds: premature });
    }

    inFlightRef.current = true;
    abortRef.current = new AbortController();

    const tickOutcome: TickOutcome = { applied: 0, skipped: 0, networkFailed: false };
    const appliedIds: string[] = [];
    const skipped: AutoSyncMeta["lastSkipped"] = [];
    const perMatchTs: Record<string, number> = { ...loadAutoSyncMeta().autoSyncedAt };

    try {
      const raw = await fetchScoreboard({
        dates: buildFetchDates(now),
        signal: abortRef.current.signal,
      });
      const events = parseScoreboard(raw);
      const allMatches = [
        ...stateRef.current.groupMatches,
        ...stateRef.current.knockoutMatches,
      ];

      const groupResults: Record<string, Score> = {};
      const knockoutResults: Record<string, Score> = {};

      for (const ev of events) {
        const v = validateEvent(ev);
        if (!v.ok) {
          skipped.push({ matchId: null, reason: v.reason });
          if (countsTowardBreaker(v.reason)) {
            tickOutcome.skipped += 1;
            console.warn(`[autosync] skip event ${ev.id}: ${v.reason}`);
          }
          continue;
        }
        const mr = matchEvent(ev, allMatches);
        if (!mr.ok) {
          skipped.push({ matchId: null, reason: mr.reason });
          if (countsTowardBreaker(mr.reason)) {
            tickOutcome.skipped += 1;
            console.warn(`[autosync] skip event ${ev.id}: ${mr.reason}`);
          }
          continue;
        }
        const existing = allMatches.find((m) => m.id === mr.matchId);
        if (!existing) continue;
        if (!hasKickedOff(existing.id, now)) {
          // A "final" result before kickoff is bogus API data (scheduled events
          // carry placeholder 0-0 scores) — anomalous, counts toward the breaker.
          skipped.push({ matchId: existing.id, reason: "premature_result" });
          tickOutcome.skipped += 1;
          console.warn(`[autosync] skip event ${ev.id}: premature_result`);
          continue;
        }
        const score = scoreFromEvent(ev);
        if (existing.result !== null && !scoresDiffer(existing.result, score)) {
          // Already in sync — idempotent no-op, not a skip.
          continue;
        }
        const isGroup = existing.id.startsWith("G-");
        if (isGroup) groupResults[existing.id] = score;
        else knockoutResults[existing.id] = score;
        appliedIds.push(existing.id);
        perMatchTs[existing.id] = now;
        tickOutcome.applied += 1;
      }

      if (appliedIds.length > 0) {
        dispatch({
          type: "APPLY_AUTOSYNC_RESULTS",
          groupResults,
          knockoutResults,
        });
      }
    } catch (err) {
      tickOutcome.networkFailed = true;
      const msg = err instanceof AutoSyncNetworkError ? err.message : String(err);
      console.warn(`[autosync] network: ${msg}`);
    } finally {
      inFlightRef.current = false;
      abortRef.current = null;
    }

    const nextBreaker = evaluateTick(breakerRef.current, tickOutcome, now);
    if (nextBreaker !== breakerRef.current) {
      saveBreakerState(nextBreaker);
      breakerRef.current = nextBreaker;
      setBreaker(nextBreaker);
    }

    saveAutoSyncMeta({
      lastFetchAt: now,
      autoSyncedAt: perMatchTs,
      lastSkipped: skipped,
      lastApplied: appliedIds,
    });
  }, [dispatch]);

  // Fire on mount + set up interval.
  useEffect(() => {
    runTick();
    timerRef.current = setInterval(runTick, INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      abortRef.current?.abort();
    };
  }, [runTick]);

  // Resume on visibility change if enough time passed.
  useEffect(() => {
    function onVisibility(): void {
      if (document.hidden) return;
      const meta = loadAutoSyncMeta();
      const elapsed = getEffectiveNow() - (meta.lastFetchAt ?? 0);
      if (elapsed > INTERVAL_MS) runTick();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [runTick]);
}
