import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "../i18n";
import {
  loadAutoSyncEnabled,
  saveAutoSyncEnabled,
  loadAutoSyncMeta,
} from "../espn/autoSyncMeta";
import { loadBreakerState, resetBreaker } from "../espn/circuitBreaker";
import { fetchScoreboard } from "../espn/client";
import { parseScoreboard } from "../espn/parser";
import { validateEvent } from "../espn/validator";
import { matchEvent } from "../espn/matcher";
import { buildFetchDates } from "../espn/tournamentWindow";
import { getEffectiveNow } from "../utils/devClock";
import { useFixture } from "../context/FixtureContext";
import "./SettingsModal.css";

interface VerifyReport {
  applied: number;
  total: number;
  skipped: Array<{ matchId: string | null; reason: string }>;
}

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { t } = useLocale();
  const { state } = useFixture();

  const [enabled, setEnabled] = useState<boolean>(loadAutoSyncEnabled());
  const [verifying, setVerifying] = useState<boolean>(false);
  const [report, setReport] = useState<VerifyReport | null>(null);

  const breaker = loadBreakerState();
  const meta = useMemo(() => loadAutoSyncMeta(), []);

  const toggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    saveAutoSyncEnabled(next);
  }, [enabled]);

  const verify = useCallback(async () => {
    setVerifying(true);
    setReport(null);
    try {
      const raw = await fetchScoreboard({ dates: buildFetchDates(getEffectiveNow()) });
      const events = parseScoreboard(raw);
      const all = [...state.groupMatches, ...state.knockoutMatches];
      let applied = 0;
      const skipped: VerifyReport["skipped"] = [];
      for (const ev of events) {
        const v = validateEvent(ev);
        if (!v.ok) {
          skipped.push({ matchId: null, reason: v.reason });
          continue;
        }
        const mr = matchEvent(ev, all);
        if (!mr.ok) {
          skipped.push({ matchId: null, reason: mr.reason });
          continue;
        }
        applied += 1;
      }
      setReport({ applied, total: events.length, skipped });
    } catch (err) {
      setReport({ applied: 0, total: 0, skipped: [{ matchId: null, reason: String(err) }] });
    } finally {
      setVerifying(false);
    }
  }, [state.groupMatches, state.knockoutMatches]);

  const reenable = useCallback(() => {
    resetBreaker();
    onClose();
  }, [onClose]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const lastFetchText = meta.lastFetchAt
    ? t("autoSync.lastFetchAgo", {
        relative: new Date(meta.lastFetchAt).toLocaleString(),
      })
    : t("autoSync.lastFetchNever");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t("autoSync.sectionTitle")}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-section">
          <label className="settings-toggle">
            <input type="checkbox" checked={enabled} onChange={toggle} />
            <span>{t("autoSync.toggleLabel")}</span>
          </label>
          <p className="settings-help">{t("autoSync.toggleHelp")}</p>
        </div>

        <div className="modal-section settings-meta">
          <span className="settings-meta-label">{lastFetchText}</span>
        </div>

        {breaker.tripped && (
          <div className="modal-section settings-breaker">
            <strong>{t("autoSync.breakerTrippedTitle")}</strong>
            <p>{t("autoSync.breakerTrippedMessage")}</p>
            <button className="modal-btn" onClick={reenable}>
              {t("autoSync.breakerReenable")}
            </button>
          </div>
        )}

        <div className="modal-section">
          <button className="modal-btn" onClick={verify} disabled={verifying}>
            {verifying ? t("autoSync.verifyRunning") : t("autoSync.verifyButton")}
          </button>
        </div>

        {report && (
          <div className="modal-section settings-report">
            <h3>{t("autoSync.verifyReportTitle")}</h3>
            <p>
              {t("autoSync.verifyMatched", {
                applied: String(report.applied),
                total: String(report.total),
              })}
            </p>
            {report.skipped.length > 0 && (
              <ul className="settings-report-list">
                {report.skipped.map((s, i) => (
                  <li key={i}>{s.reason}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
