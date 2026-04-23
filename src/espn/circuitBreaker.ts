// src/espn/circuitBreaker.ts

export const BREAKER_STORAGE_KEY = "wc2026-autosync-breaker";

export type BreakerReason = "many_skips" | "repeated_network_failures";

export interface BreakerState {
  tripped: boolean;
  trippedAt: number | null;
  reason: BreakerReason | null;
  consecutiveFailures: number;
}

export interface TickOutcome {
  applied: number;
  skipped: number;
  networkFailed: boolean;
}

const INITIAL: BreakerState = {
  tripped: false,
  trippedAt: null,
  reason: null,
  consecutiveFailures: 0,
};

export function loadBreakerState(): BreakerState {
  try {
    const raw = localStorage.getItem(BREAKER_STORAGE_KEY);
    if (!raw) return { ...INITIAL };
    const parsed = JSON.parse(raw) as Partial<BreakerState>;
    return {
      tripped: Boolean(parsed.tripped),
      trippedAt: typeof parsed.trippedAt === "number" ? parsed.trippedAt : null,
      reason:
        parsed.reason === "many_skips" || parsed.reason === "repeated_network_failures"
          ? parsed.reason
          : null,
      consecutiveFailures:
        typeof parsed.consecutiveFailures === "number" ? parsed.consecutiveFailures : 0,
    };
  } catch {
    return { ...INITIAL };
  }
}

export function saveBreakerState(state: BreakerState): void {
  try {
    localStorage.setItem(BREAKER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage quota; non-fatal */
  }
}

export function resetBreaker(): void {
  try {
    localStorage.removeItem(BREAKER_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function evaluateTick(
  prev: BreakerState,
  outcome: TickOutcome,
  now: number,
): BreakerState {
  if (prev.tripped) return prev;

  if (outcome.networkFailed) {
    const consecutiveFailures = prev.consecutiveFailures + 1;
    if (consecutiveFailures >= 5) {
      return {
        tripped: true,
        trippedAt: now,
        reason: "repeated_network_failures",
        consecutiveFailures,
      };
    }
    return { ...prev, consecutiveFailures };
  }

  // Not a network failure: check skip/apply ratio.
  if (outcome.skipped >= 3 && outcome.skipped > outcome.applied * 2) {
    return {
      tripped: true,
      trippedAt: now,
      reason: "many_skips",
      consecutiveFailures: 0,
    };
  }

  return { ...prev, consecutiveFailures: 0 };
}
