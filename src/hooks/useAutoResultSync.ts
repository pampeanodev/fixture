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
  evaluateTick,
  loadBreakerState,
  saveBreakerState,
  type BreakerState,
  type TickOutcome,
} from "../espn/circuitBreaker";
import {
  loadAutoSyncEnabled,
  loadAutoSyncMeta,
  saveAutoSyncMeta,
  type AutoSyncMeta,
} from "../espn/autoSyncMeta";
import { getEffectiveNow } from "../utils/devClock";
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

export function useAutoResultSync(): void {
  const { state, dispatch } = useFixture();
  const inFlightRef = useRef<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Breaker state is mirrored in React so the UI re-renders on trip.
  const [breaker, setBreaker] = useState<BreakerState>(() => loadBreakerState());
  const breakerRef = useRef<BreakerState>(breaker);
  breakerRef.current = breaker;

  const runTick = useCallback(async (): Promise<void> => {
    const enabled = loadAutoSyncEnabled();
    if (!enabled) return;
    if (breakerRef.current.tripped) return;
    if (typeof document !== "undefined" && document.hidden) return;
    const now = getEffectiveNow();
    if (!isWithinTournamentWindow(now)) return;
    if (inFlightRef.current) return;

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
      const allMatches = [...state.groupMatches, ...state.knockoutMatches];

      const groupResults: Record<string, Score> = {};
      const knockoutResults: Record<string, Score> = {};

      for (const ev of events) {
        const v = validateEvent(ev);
        if (!v.ok) {
          skipped.push({ matchId: null, reason: v.reason });
          tickOutcome.skipped += 1;
          console.warn(`[autosync] skip event ${ev.id}: ${v.reason}`);
          continue;
        }
        const mr = matchEvent(ev, allMatches);
        if (!mr.ok) {
          skipped.push({ matchId: null, reason: mr.reason });
          tickOutcome.skipped += 1;
          console.warn(`[autosync] skip event ${ev.id}: ${mr.reason}`);
          continue;
        }
        const existing = allMatches.find((m) => m.id === mr.matchId);
        if (!existing) continue;
        if (existing.result !== null) {
          // Not counted as skipped for breaker purposes; this is the idempotent / admin-wins case.
          continue;
        }
        const score = scoreFromEvent(ev);
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
  }, [state.groupMatches, state.knockoutMatches, dispatch]);

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
