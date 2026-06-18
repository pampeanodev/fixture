import { useState, useEffect } from "react";
import { getTeam } from "../../data/teams";
import { useLocale } from "../../i18n";
import { indicatorFor } from "../../utils/scoring";
import type { Score } from "../../types";

export interface ScheduleCardMatch {
  id: string;
  dateUtc: string;
  venue: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  isKnockout: boolean;
  prediction: Score | null;
  result: Score | null;
}

interface ScheduleMatchCardProps {
  match: ScheduleCardMatch;
  label: string;
  predictionLocked: boolean;
  resultEditable: boolean;
  synced?: boolean;
  autoSyncTooltip?: string;
  onPredictionChange: (score: Score | null) => void;
  onResultChange: (score: Score | null) => void;
}

export function ScheduleMatchCard(props: ScheduleMatchCardProps) {
  const { match, label, predictionLocked, resultEditable, synced, autoSyncTooltip,
    onPredictionChange, onResultChange } = props;
  const { t, formatTime } = useLocale();

  const [homeStr, setHomeStr] = useState(match.prediction?.home?.toString() ?? "");
  const [awayStr, setAwayStr] = useState(match.prediction?.away?.toString() ?? "");
  useEffect(() => {
    setHomeStr(match.prediction?.home?.toString() ?? "");
    setAwayStr(match.prediction?.away?.toString() ?? "");
  }, [match.prediction]);

  function commitPrediction(hStr: string, aStr: string) {
    const h = parseInt(hStr, 10);
    const a = parseInt(aStr, 10);
    if (!isNaN(h) && !isNaN(a) && h >= 0 && a >= 0) onPredictionChange({ home: h, away: a });
    else if (hStr === "" && aStr === "") onPredictionChange(null);
  }

  const homeTeam = match.homeTeamId ? getTeam(match.homeTeamId) : null;
  const awayTeam = match.awayTeamId ? getTeam(match.awayTeamId) : null;
  const bothKnown = match.homeTeamId !== null && match.awayTeamId !== null;
  const time = formatTime(match.dateUtc);
  const inputTitle = predictionLocked ? undefined : autoSyncTooltip;
  const scored = indicatorFor(match.result, match.prediction);

  return (
    <div className={`schedule-match-card ${match.isKnockout ? "knockout" : ""} ${match.result ? "has-result" : ""}`}>
      <div className="schedule-match-top">
        <span>{time}</span>
        <span className={`schedule-badge ${match.isKnockout ? "ko" : "group"}`}>{label}</span>
        <span className="schedule-match-venue">{match.venue}</span>
      </div>
      <div className="schedule-team-row">
        {homeTeam ? (
          <>
            <span className="team-flag">{homeTeam.flag}</span>
            <span className="schedule-team-row-name">{t(`teams.${homeTeam.id}`)}</span>
          </>
        ) : (
          <span className="schedule-team-row-name pending">{match.id}</span>
        )}
        {bothKnown && (
          <input type="number" min="0" max="99"
            className={`schedule-score-input prediction ${predictionLocked ? "locked" : ""}`}
            disabled={predictionLocked} title={inputTitle}
            value={homeStr}
            onChange={(e) => { setHomeStr(e.target.value); commitPrediction(e.target.value, awayStr); }} />
        )}
      </div>
      <div className="schedule-team-row">
        {awayTeam ? (
          <>
            <span className="team-flag">{awayTeam.flag}</span>
            <span className="schedule-team-row-name">{t(`teams.${awayTeam.id}`)}</span>
          </>
        ) : (
          <span className="schedule-team-row-name pending">{match.id}</span>
        )}
        {bothKnown && (
          <input type="number" min="0" max="99"
            className={`schedule-score-input prediction ${predictionLocked ? "locked" : ""}`}
            disabled={predictionLocked} title={inputTitle}
            value={awayStr}
            onChange={(e) => { setAwayStr(e.target.value); commitPrediction(homeStr, e.target.value); }} />
        )}
      </div>
      {synced && <div className="schedule-synced" title={t("schedule.matchCard.syncedTitle")}>{t("schedule.matchCard.synced")}</div>}
      <ScheduleResultRow result={match.result} editable={resultEditable && bothKnown} onChange={onResultChange}
        label={t("schedule.matchCard.real")}
        indicator={scored ? { className: scored.kind, text: scored.label } : null} />
    </div>
  );
}

function ScheduleResultRow({ result, editable, onChange, label, indicator }: {
  result: Score | null;
  editable: boolean;
  onChange: (score: Score | null) => void;
  label: string;
  indicator: { className: string; text: string } | null;
}) {
  const [h, setH] = useState(result?.home?.toString() ?? "");
  const [a, setA] = useState(result?.away?.toString() ?? "");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- controlled-input resync to external result, matches the prediction-input pattern above
  useEffect(() => { setH(result?.home?.toString() ?? ""); setA(result?.away?.toString() ?? ""); }, [result]);
  function commit(hStr: string, aStr: string) {
    const hh = parseInt(hStr, 10), aa = parseInt(aStr, 10);
    if (!isNaN(hh) && !isNaN(aa) && hh >= 0 && aa >= 0) onChange({ home: hh, away: aa });
    else if (hStr === "" && aStr === "") onChange(null);
  }
  if (editable) {
    return (
      <div className="schedule-result-row editable">
        <span>{label}:</span>
        <input type="number" min="0" max="99" className="schedule-score-input" value={h}
          onChange={(e) => { setH(e.target.value); commit(e.target.value, a); }} />
        <span>–</span>
        <input type="number" min="0" max="99" className="schedule-score-input" value={a}
          onChange={(e) => { setA(e.target.value); commit(h, e.target.value); }} />
      </div>
    );
  }
  if (!result) return null;
  return (
    <div className="schedule-result-row">
      {label}: {result.home} - {result.away}
      {indicator && <span className={`prediction-indicator ${indicator.className}`}>{indicator.text}</span>}
    </div>
  );
}
