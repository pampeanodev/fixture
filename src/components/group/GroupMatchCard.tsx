import { useState, useEffect } from "react";
import { getTeam } from "../../data/teams";
import { useLocale } from "../../i18n";
import { indicatorFor } from "../../utils/scoring";
import type { Score } from "../../types";
import "./GroupMatchCard.css";

interface GroupMatchCardProps {
  homeTeamId: string;
  awayTeamId: string;
  dateUtc: string;
  prediction: Score | null;
  result: Score | null;
  predictionLocked: boolean;   // isMatchLocked -> prediction inputs read-only
  resultEditable: boolean;     // fallback -> result becomes editable inline
  synced?: boolean;
  autoSyncTooltip?: string;
  onPredictionChange: (score: Score | null) => void;
  onResultChange: (score: Score | null) => void;
}

export function GroupMatchCard(props: GroupMatchCardProps) {
  const {
    homeTeamId, awayTeamId, dateUtc, prediction, result,
    predictionLocked, resultEditable, synced, autoSyncTooltip,
    onPredictionChange, onResultChange,
  } = props;
  const { t, formatDate } = useLocale();

  const [homeStr, setHomeStr] = useState(prediction?.home?.toString() ?? "");
  const [awayStr, setAwayStr] = useState(prediction?.away?.toString() ?? "");
  useEffect(() => {
    setHomeStr(prediction?.home?.toString() ?? "");
    setAwayStr(prediction?.away?.toString() ?? "");
  }, [prediction]);

  function commitPrediction(hStr: string, aStr: string) {
    const h = parseInt(hStr, 10);
    const a = parseInt(aStr, 10);
    if (!isNaN(h) && !isNaN(a) && h >= 0 && a >= 0) onPredictionChange({ home: h, away: a });
    else if (hStr === "" && aStr === "") onPredictionChange(null);
  }

  const homeTeam = getTeam(homeTeamId);
  const awayTeam = getTeam(awayTeamId);
  const scored = indicatorFor(result, prediction);

  return (
    <div className="group-match-card">
      <div className="group-match-date">{formatDate(dateUtc)}</div>
      <div className="group-match-team-row">
        <span className="team-flag">{homeTeam?.flag}</span>
        <span className="group-match-team-name">{homeTeam ? t(`teams.${homeTeam.id}`) : ""}</span>
        <input type="number" min="0" max="99"
          className={`group-match-score-input prediction ${predictionLocked ? "locked" : ""}`}
          disabled={predictionLocked} title={predictionLocked ? undefined : autoSyncTooltip}
          value={homeStr}
          onChange={(e) => { setHomeStr(e.target.value); commitPrediction(e.target.value, awayStr); }} />
      </div>
      <div className="group-match-team-row">
        <span className="team-flag">{awayTeam?.flag}</span>
        <span className="group-match-team-name">{awayTeam ? t(`teams.${awayTeam.id}`) : ""}</span>
        <input type="number" min="0" max="99"
          className={`group-match-score-input prediction ${predictionLocked ? "locked" : ""}`}
          disabled={predictionLocked} title={predictionLocked ? undefined : autoSyncTooltip}
          value={awayStr}
          onChange={(e) => { setAwayStr(e.target.value); commitPrediction(homeStr, e.target.value); }} />
      </div>
      {synced && <div className="group-match-synced" title={t("groups.matchCard.syncedTitle")}>{t("groups.matchCard.synced")}</div>}
      <ResultRow result={result} editable={resultEditable} onChange={onResultChange}
        label={t("groups.matchCard.real")}
        locked={predictionLocked} lockedLabel={t("groups.matchCard.locked")}
        indicator={scored ? { className: scored.kind, text: scored.label } : null} />
    </div>
  );
}

function ResultRow({ result, editable, onChange, label, locked, lockedLabel, indicator }: {
  result: Score | null;
  editable: boolean;
  onChange: (score: Score | null) => void;
  label: string;
  locked: boolean;
  lockedLabel: string;
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
      <div className="group-match-result-row editable">
        <span>{label}:</span>
        <input type="number" min="0" max="99" className="group-match-score-input" value={h}
          onChange={(e) => { setH(e.target.value); commit(e.target.value, a); }} />
        <span>–</span>
        <input type="number" min="0" max="99" className="group-match-score-input" value={a}
          onChange={(e) => { setA(e.target.value); commit(h, e.target.value); }} />
      </div>
    );
  }
  if (!result) {
    // No result yet. While predictions are locked (match in progress / closed),
    // show the lock indicator instead of leaving the row blank.
    return locked ? <div className="group-match-locked">{lockedLabel}</div> : null;
  }
  return (
    <div className="group-match-result-row">
      {label}: {result.home} - {result.away}
      {indicator && <span className={`prediction-indicator ${indicator.className}`}>{indicator.text}</span>}
    </div>
  );
}
