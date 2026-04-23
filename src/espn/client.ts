// src/espn/client.ts
import type { EspnRawScoreboard } from "./types";

const BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const FETCH_TIMEOUT_MS = 10_000;

export class AutoSyncNetworkError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AutoSyncNetworkError";
    this.status = status;
  }
}

export interface FetchScoreboardOptions {
  leagueSlug?: string; // default "fifa.world"
  dates: string;       // "YYYYMMDD-YYYYMMDD" or "YYYYMMDD"
  signal?: AbortSignal;
}

export async function fetchScoreboard(
  opts: FetchScoreboardOptions,
): Promise<EspnRawScoreboard> {
  const { leagueSlug = "fifa.world", dates, signal } = opts;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const chained =
    signal != null
      ? new AbortController()
      : controller;
  if (signal) {
    signal.addEventListener("abort", () => chained.abort(), { once: true });
    controller.signal.addEventListener("abort", () => chained.abort(), { once: true });
  }

  try {
    const url = `${BASE_URL}/${leagueSlug}/scoreboard?dates=${encodeURIComponent(dates)}`;
    const res = await fetch(url, {
      signal: chained.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new AutoSyncNetworkError(`HTTP ${res.status}`, res.status);
    }
    return (await res.json()) as EspnRawScoreboard;
  } catch (err) {
    if (err instanceof AutoSyncNetworkError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new AutoSyncNetworkError(msg);
  } finally {
    window.clearTimeout(timeoutId);
  }
}
