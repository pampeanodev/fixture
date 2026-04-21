// Dev-only time travel for testing commit-reveal flow before the real World Cup.
// In production builds (import.meta.env.DEV === false) every function is a no-op
// and getEffectiveNow() always returns Date.now(). Never ship a simulated clock.

const STORAGE_KEY = "wc2026-dev-clock-offset-ms";

function isDev(): boolean {
  return import.meta.env.DEV === true;
}

function readOffset(): number {
  if (!isDev()) return 0;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeOffset(offsetMs: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(offsetMs));
  } catch {
    /* storage full */
  }
}

export function getEffectiveNow(): number {
  if (!isDev()) return Date.now();
  return Date.now() + readOffset();
}

export function setSimulatedNow(target: Date | string | number): void {
  if (!isDev()) {
    console.warn("[devClock] ignored: not a dev build");
    return;
  }
  const targetMs =
    typeof target === "number"
      ? target
      : target instanceof Date
        ? target.getTime()
        : new Date(target).getTime();
  if (!Number.isFinite(targetMs)) {
    console.warn("[devClock] invalid target:", target);
    return;
  }
  const offset = targetMs - Date.now();
  writeOffset(offset);
  console.info(
    `[devClock] simulated now = ${new Date(targetMs).toISOString()} (offset ${Math.round(offset / 86400000)}d)`,
  );
}

export function clearSimulatedNow(): void {
  if (!isDev()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.info("[devClock] cleared — back to real time");
  } catch {
    /* ignore */
  }
}

export function getSimulatedNowIso(): string | null {
  if (!isDev()) return null;
  const offset = readOffset();
  if (offset === 0) return null;
  return new Date(Date.now() + offset).toISOString();
}

if (isDev() && typeof window !== "undefined") {
  const w = window as Window & {
    __devClock?: {
      setNow: typeof setSimulatedNow;
      clear: typeof clearSimulatedNow;
      now: () => string;
    };
  };
  w.__devClock = {
    setNow: setSimulatedNow,
    clear: clearSimulatedNow,
    now: () => new Date(getEffectiveNow()).toISOString(),
  };
}
