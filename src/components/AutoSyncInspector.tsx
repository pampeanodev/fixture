import { useCallback, useMemo, useState } from "react";
import { fetchScoreboard } from "../espn/client";
import { parseScoreboard } from "../espn/parser";
import { validateEvent } from "../espn/validator";
import { matchEvent } from "../espn/matcher";
import { buildFetchDates } from "../espn/tournamentWindow";
import { getEffectiveNow } from "../utils/devClock";
import { useFixture } from "../context/FixtureContext";
import type { EspnEvent, EspnRawScoreboard, EspnRawEvent } from "../espn/types";
import "./AutoSyncInspector.css";

const LEAGUE_OPTIONS = [
  "fifa.world",
  "fifa.wwc",
  "uefa.champions",
  "uefa.europa",
  "eng.1",
  "esp.1",
  "ger.1",
  "ita.1",
  "fra.1",
  "usa.1",
  "mex.1",
] as const;

type RowKind = "ok" | "idempotent" | "skip";

interface InspectorRow {
  kind: RowKind;
  ev: EspnEvent;
  matchId?: string;
  reason?: string;
  rawEvent: EspnRawEvent | undefined;
}

interface FetchResult {
  scoreboard: EspnRawScoreboard;
  rows: InspectorRow[];
  counts: {
    raw: number;
    parsed: number;
    matched: number;
    idempotent: number;
    skipped: number;
  };
}

function findRawEvent(
  scoreboard: EspnRawScoreboard | undefined,
  eventId: string,
): EspnRawEvent | undefined {
  return scoreboard?.events?.find((e) => e.id === eventId);
}

function formatScore(ev: EspnEvent): string {
  const base = `${ev.home.abbreviation} ${ev.home.score}–${ev.away.score} ${ev.away.abbreviation}`;
  if (ev.shootout) {
    return `${base}  (pen ${ev.shootout.home}–${ev.shootout.away})`;
  }
  return base;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function kindIcon(kind: RowKind): string {
  if (kind === "ok") return "✓";
  if (kind === "idempotent") return "·";
  return "✗";
}

function normalizedJson(ev: EspnEvent): string {
  return JSON.stringify(ev, null, 2);
}

interface EventRowProps {
  row: InspectorRow;
}

function EventRow({ row }: EventRowProps) {
  const [openRaw, setOpenRaw] = useState(false);
  const [openNormalized, setOpenNormalized] = useState(false);
  const [copied, setCopied] = useState<"raw" | "norm" | null>(null);

  const copy = useCallback((payload: string, which: "raw" | "norm") => {
    navigator.clipboard.writeText(payload).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    });
  }, []);

  return (
    <li className={`asi-row asi-row--${row.kind}`}>
      <div className="asi-row-head">
        <span className="asi-row-icon" aria-hidden="true">
          {kindIcon(row.kind)}
        </span>
        <span className="asi-row-score">{formatScore(row.ev)}</span>
        <span className="asi-row-status">{row.ev.statusName}</span>
        <span className="asi-row-verdict">
          {row.kind === "ok" && <>matched → <code>{row.matchId}</code></>}
          {row.kind === "idempotent" && <>idempotent (already synced) · <code>{row.matchId}</code></>}
          {row.kind === "skip" && <>skip: <code>{row.reason}</code></>}
        </span>
      </div>
      <div className="asi-row-meta">
        <span>id <code>{row.ev.id}</code></span>
        <span>{formatDate(row.ev.dateUtc)}</span>
      </div>
      <div className="asi-row-actions">
        <button onClick={() => setOpenNormalized((v) => !v)}>
          {openNormalized ? "hide" : "show"} parsed
        </button>
        <button
          onClick={() => copy(normalizedJson(row.ev), "norm")}
          title="Copy the EspnEvent the pipeline sees"
        >
          {copied === "norm" ? "copied" : "copy parsed"}
        </button>
        {row.rawEvent && (
          <>
            <button onClick={() => setOpenRaw((v) => !v)}>
              {openRaw ? "hide" : "show"} raw
            </button>
            <button
              onClick={() => copy(JSON.stringify(row.rawEvent, null, 2), "raw")}
              title="Copy the ESPN JSON for just this event"
            >
              {copied === "raw" ? "copied" : "copy raw"}
            </button>
          </>
        )}
      </div>
      {openNormalized && (
        <pre className="asi-row-json asi-row-json--norm">{normalizedJson(row.ev)}</pre>
      )}
      {openRaw && row.rawEvent && (
        <pre className="asi-row-json asi-row-json--raw">
          {JSON.stringify(row.rawEvent, null, 2)}
        </pre>
      )}
    </li>
  );
}

export function AutoSyncInspector() {
  const { state } = useFixture();
  const [league, setLeague] = useState<string>("fifa.world");
  const [dates, setDates] = useState<string>(() => buildFetchDates(getEffectiveNow()));
  const [result, setResult] = useState<FetchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const scoreboard = await fetchScoreboard({ leagueSlug: league, dates });
      const events = parseScoreboard(scoreboard);
      const all = [...state.groupMatches, ...state.knockoutMatches];
      const rows: InspectorRow[] = [];
      let matched = 0;
      let idempotent = 0;
      let skipped = 0;

      for (const ev of events) {
        const rawEvent = findRawEvent(scoreboard, ev.id);
        const v = validateEvent(ev);
        if (!v.ok) {
          rows.push({ kind: "skip", ev, reason: v.reason, rawEvent });
          skipped += 1;
          continue;
        }
        const mr = matchEvent(ev, all);
        if (!mr.ok) {
          rows.push({ kind: "skip", ev, reason: mr.reason, rawEvent });
          skipped += 1;
          continue;
        }
        const existing = all.find((m) => m.id === mr.matchId);
        if (existing?.result != null) {
          rows.push({ kind: "idempotent", ev, matchId: mr.matchId, rawEvent });
          idempotent += 1;
        } else {
          rows.push({ kind: "ok", ev, matchId: mr.matchId, rawEvent });
          matched += 1;
        }
      }

      setResult({
        scoreboard,
        rows,
        counts: {
          raw: scoreboard?.events?.length ?? 0,
          parsed: events.length,
          matched,
          idempotent,
          skipped,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [league, dates, state.groupMatches, state.knockoutMatches]);

  const allParsedJson = useMemo(() => {
    if (!result) return "";
    return JSON.stringify(
      result.rows.map((r) => ({ verdict: r.kind, reason: r.reason, matchId: r.matchId, event: r.ev })),
      null,
      2,
    );
  }, [result]);

  const copyAllParsed = useCallback(() => {
    if (allParsedJson) navigator.clipboard.writeText(allParsedJson);
  }, [allParsedJson]);

  return (
    <div className="autosync-inspector">
      <div className="asi-header">
        <h2>Auto-sync inspector <span className="asi-dev">dev</span></h2>
        <div className="asi-controls">
          <label>
            <span>League</span>
            <select value={league} onChange={(e) => setLeague(e.target.value)}>
              {LEAGUE_OPTIONS.map((slug) => (
                <option key={slug} value={slug}>{slug}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Dates</span>
            <input
              value={dates}
              onChange={(e) => setDates(e.target.value)}
              placeholder="YYYYMMDD or YYYYMMDD-YYYYMMDD"
            />
          </label>
          <button className="asi-fetch" onClick={run} disabled={loading}>
            {loading ? "Fetching…" : "Fetch"}
          </button>
        </div>
      </div>

      {error && <div className="asi-error">Fetch failed: {error}</div>}

      {result && (
        <>
          <div className="asi-summary">
            <span>raw events <b>{result.counts.raw}</b></span>
            <span>parsed <b>{result.counts.parsed}</b></span>
            <span className="asi-summary-ok">matched <b>{result.counts.matched}</b></span>
            <span className="asi-summary-idem">idempotent <b>{result.counts.idempotent}</b></span>
            <span className="asi-summary-skip">skipped <b>{result.counts.skipped}</b></span>
            <button className="asi-summary-copy" onClick={copyAllParsed}>copy all parsed</button>
          </div>

          <ul className="asi-rows">
            {result.rows.length === 0 && (
              <li className="asi-empty">No events in response.</li>
            )}
            {result.rows.map((r, i) => (
              <EventRow key={`${r.ev.id}-${i}`} row={r} />
            ))}
          </ul>

          <details className="asi-scoreboard">
            <summary>full scoreboard JSON (league metadata + all events)</summary>
            <pre>{JSON.stringify(result.scoreboard, null, 2)}</pre>
          </details>
        </>
      )}
    </div>
  );
}
