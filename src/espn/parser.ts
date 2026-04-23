// src/espn/parser.ts
import type {
  EspnEvent,
  EspnRawScoreboard,
  EspnRawEvent,
  EspnRawCompetitor,
  EspnStatusName,
} from "./types";

const KNOWN_STATUSES: ReadonlySet<EspnStatusName> = new Set<EspnStatusName>([
  "STATUS_FULL_TIME",
  "STATUS_FINAL",
  "STATUS_FINAL_AET",
  "STATUS_FINAL_PEN",
  "STATUS_SCHEDULED",
  "STATUS_IN_PROGRESS",
  "STATUS_HALFTIME",
  "STATUS_POSTPONED",
  "STATUS_FORFEIT",
  "STATUS_CANCELED",
  "STATUS_UNKNOWN",
]);

function narrowStatus(raw: string | undefined): EspnStatusName {
  if (raw && (KNOWN_STATUSES as Set<string>).has(raw)) return raw as EspnStatusName;
  return "STATUS_UNKNOWN";
}

function toScore(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === "string") {
    const n = Number(raw);
    return Number.isFinite(n) ? Math.trunc(n) : NaN;
  }
  return NaN;
}

function extractShootout(
  home: EspnRawCompetitor | undefined,
  away: EspnRawCompetitor | undefined,
): { home: number; away: number } | undefined {
  if (!home || !away) return undefined;
  const h = home.shootoutScore;
  const a = away.shootoutScore;
  if (typeof h === "number" && typeof a === "number") return { home: h, away: a };
  return undefined;
}

function parseRawEvent(raw: EspnRawEvent): EspnEvent | null {
  if (!raw || typeof raw !== "object") return null;

  const comp = raw.competitions?.[0];
  const competitors = comp?.competitors ?? [];
  if (competitors.length < 2) return null;

  const home = competitors.find((c) => c.homeAway === "home") ?? competitors[0];
  const away = competitors.find((c) => c.homeAway === "away") ?? competitors[1];

  const homeAbbr = home.team?.abbreviation;
  const awayAbbr = away.team?.abbreviation;
  if (!homeAbbr || !awayAbbr) return null;

  const statusName = narrowStatus(comp?.status?.type?.name ?? raw.status?.type?.name);

  const homeScore = toScore(home.score);
  const awayScore = toScore(away.score);
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;

  const ev: EspnEvent = {
    id: raw.id ?? "unknown",
    dateUtc: raw.date ?? "",
    statusName,
    home: { abbreviation: homeAbbr, score: homeScore },
    away: { abbreviation: awayAbbr, score: awayScore },
  };

  const shootout = extractShootout(home, away);
  if (shootout) ev.shootout = shootout;

  return ev;
}

export function parseScoreboard(raw: unknown): EspnEvent[] {
  if (!raw || typeof raw !== "object") return [];
  const events = (raw as EspnRawScoreboard).events;
  if (!Array.isArray(events)) return [];
  const out: EspnEvent[] = [];
  for (const rawEvent of events) {
    const ev = parseRawEvent(rawEvent);
    if (ev) out.push(ev);
  }
  return out;
}
