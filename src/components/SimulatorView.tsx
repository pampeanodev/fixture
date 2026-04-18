import { useState, useMemo } from "react";
import { useFixture } from "../context/FixtureContext";
import { nextPendingMatch } from "../simulator/matchOrder";
import {
  generateGroupResult,
  generateKnockoutResult,
} from "../simulator/resultGenerator";
import { ScoreInput } from "./ScoreInput";
import type { Score } from "../types";
import type { PendingMatch } from "../simulator/types";
import "./SimulatorView.css";

export function SimulatorView() {
  const { state, dispatch, resolvedKnockout } = useFixture();
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [manualEntry, setManualEntry] = useState(false);
  const [manualScore, setManualScore] = useState<Score | null>(null);

  const pending = useMemo(
    () => nextPendingMatch(state.groupMatches, resolvedKnockout, skipped),
    [state.groupMatches, resolvedKnockout, skipped],
  );

  function handleSimulate() {
    if (!pending) return;
    const { homeTeamId, awayTeamId } = pending.match;
    if (!homeTeamId || !awayTeamId) return;
    const score =
      pending.kind === "group"
        ? generateGroupResult(homeTeamId, awayTeamId)
        : generateKnockoutResult(homeTeamId, awayTeamId);
    dispatchResult(pending, score);
  }

  function handleManualSubmit() {
    if (!pending || !manualScore) return;
    dispatchResult(pending, manualScore);
    setManualEntry(false);
    setManualScore(null);
  }

  function handleSkip() {
    if (!pending) return;
    setSkipped((prev) => new Set(prev).add(pending.match.id));
    setManualEntry(false);
    setManualScore(null);
  }

  function dispatchResult(p: PendingMatch, score: Score) {
    if (p.kind === "group") {
      dispatch({ type: "SET_GROUP_SCORE", matchId: p.match.id, score });
    } else {
      dispatch({ type: "SET_KNOCKOUT_SCORE", matchId: p.match.id, score });
    }
  }

  function handleExit() {
    dispatch({ type: "EXIT_SIMULATION" });
    dispatch({ type: "SET_VIEW", view: { type: "ranking" } });
  }

  function handleReset() {
    dispatch({ type: "RESET_SIMULATION" });
    setSkipped(new Set());
    setManualEntry(false);
    setManualScore(null);
  }

  if (!pending) {
    return (
      <div className="simulator-view">
        <div className="simulator-empty">
          <h2>Simulación completa</h2>
          <p>No quedan partidos por simular.</p>
          <div className="simulator-actions">
            <button className="sim-btn primary" onClick={handleExit}>
              Salir y volver al prode real
            </button>
            <button className="sim-btn" onClick={handleReset}>
              Simular de nuevo
            </button>
          </div>
        </div>
      </div>
    );
  }

  const match = pending.match;
  const homeTeam = state.teams.find((t) => t.id === match.homeTeamId);
  const awayTeam = state.teams.find((t) => t.id === match.awayTeamId);
  const isKnockout = pending.kind === "knockout";
  const stageLabel =
    pending.kind === "group"
      ? `Grupo ${(match as { group?: string }).group ?? ""}`
      : (match as { round: string }).round;

  return (
    <div className="simulator-view">
      <div className="simulator-header">
        <h2>Simulación</h2>
        <div className="simulator-header-actions">
          <button className="sim-btn" onClick={handleReset}>Resetear</button>
          <button className="sim-btn danger" onClick={handleExit}>Salir</button>
        </div>
      </div>

      <div className="simulator-match">
        <div className="simulator-match-meta">
          {stageLabel} · {new Date(match.dateUtc).toLocaleString()}
        </div>
        <div className="simulator-match-teams">
          <div className="sim-team">
            <span className="sim-team-flag">{homeTeam?.flag}</span>
            <span className="sim-team-name">{homeTeam?.name}</span>
          </div>
          <span className="sim-vs">vs</span>
          <div className="sim-team">
            <span className="sim-team-flag">{awayTeam?.flag}</span>
            <span className="sim-team-name">{awayTeam?.name}</span>
          </div>
        </div>
      </div>

      {manualEntry ? (
        <div className="simulator-manual">
          <p>Ingresá el resultado:</p>
          <ScoreInput
            score={manualScore}
            onScoreChange={setManualScore}
            allowPenalties={isKnockout}
          />
          <div className="simulator-actions">
            <button
              className="sim-btn primary"
              onClick={handleManualSubmit}
              disabled={!manualScore}
            >
              Confirmar
            </button>
            <button className="sim-btn" onClick={() => { setManualEntry(false); setManualScore(null); }}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="simulator-actions">
          <button className="sim-btn primary" onClick={handleSimulate}>
            ▶ Simular random
          </button>
          <button className="sim-btn" onClick={() => setManualEntry(true)}>
            ✎ Ingresar manual
          </button>
          <button className="sim-btn" onClick={handleSkip}>
            ⏭ Saltar
          </button>
        </div>
      )}
    </div>
  );
}
