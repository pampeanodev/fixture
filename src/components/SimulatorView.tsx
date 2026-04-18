import { useState, useMemo } from "react";
import { useFixture } from "../context/FixtureContext";
import { nextPendingMatch } from "../simulator/matchOrder";
import {
  generateGroupResult,
  generateKnockoutResult,
} from "../simulator/resultGenerator";
import { ScoreInput } from "./ScoreInput";
import { computeRanking, scoreMatch } from "../utils/scoring";
import type { RankedPlayer } from "../utils/scoring";
import type { Score } from "../types";
import type { PendingMatch } from "../simulator/types";
import "./SimulatorView.css";

export function SimulatorView() {
  const { state, dispatch, resolvedKnockout } = useFixture();
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [manualEntry, setManualEntry] = useState(false);
  const [manualScore, setManualScore] = useState<Score | null>(null);
  const [lastResult, setLastResult] = useState<{
    matchId: string;
    kind: "group" | "knockout";
    score: Score;
    rankingBefore: RankedPlayer[];
  } | null>(null);

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
    const rankingBefore = computeRanking(state);
    dispatchResult(pending, score);
    setLastResult({ matchId: pending.match.id, kind: pending.kind, score, rankingBefore });
  }

  function handleManualSubmit() {
    if (!pending || !manualScore) return;
    const rankingBefore = computeRanking(state);
    dispatchResult(pending, manualScore);
    setLastResult({ matchId: pending.match.id, kind: pending.kind, score: manualScore, rankingBefore });
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
    setLastResult(null);
  }

  if (lastResult) {
    const rankingAfter = computeRanking(state);
    const prevMatch =
      lastResult.kind === "group"
        ? state.groupMatches.find((m) => m.id === lastResult.matchId)
        : resolvedKnockout.find((m) => m.id === lastResult.matchId);

    const prevHomeTeam = state.teams.find((t) => t.id === prevMatch?.homeTeamId);
    const prevAwayTeam = state.teams.find((t) => t.id === prevMatch?.awayTeamId);

    const winnerText = getWinnerText(lastResult.score, prevHomeTeam?.name, prevAwayTeam?.name);

    const deltas = rankingAfter.map((after) => {
      const before = lastResult.rankingBefore.find((p) => p.name === after.name);
      const delta = before ? after.total - before.total : 0;
      const posBefore = lastResult.rankingBefore.findIndex((p) => p.name === after.name);
      const posAfter = rankingAfter.findIndex((p) => p.name === after.name);
      let predScore: Score | null = null;
      if (after.isLocal) {
        predScore = prevMatch?.prediction ?? null;
      } else {
        const rival = state.rivals.find((r) => r.name === after.name);
        if (rival) {
          predScore =
            lastResult.kind === "group"
              ? (rival.groupPredictions[lastResult.matchId] ?? null)
              : (rival.knockoutPredictions[lastResult.matchId] ?? null);
        }
      }
      const matchPoints = scoreMatch(lastResult.score, predScore);
      return { player: after, delta, matchPoints, predScore, posBefore, posAfter };
    });

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
          <div className="simulator-match-teams">
            <div className="sim-team">
              <span className="sim-team-flag">{prevHomeTeam?.flag}</span>
              <span className="sim-team-name">{prevHomeTeam?.name}</span>
            </div>
            <span className="sim-final-score">
              {lastResult.score.home} - {lastResult.score.away}
              {lastResult.score.penalties && (
                <span className="sim-pen">
                  {" "}(pen {lastResult.score.penalties.home}-{lastResult.score.penalties.away})
                </span>
              )}
            </span>
            <div className="sim-team">
              <span className="sim-team-flag">{prevAwayTeam?.flag}</span>
              <span className="sim-team-name">{prevAwayTeam?.name}</span>
            </div>
          </div>
          <div className="simulator-winner">{winnerText}</div>
        </div>

        <div className="simulator-deltas">
          <h3>Puntos de este partido</h3>
          <table className="simulator-predictions-table">
            <tbody>
              {deltas.map((d) => (
                <tr key={d.player.name} className={d.player.isLocal ? "local" : ""}>
                  <td>{d.player.name}{d.player.isLocal && <span className="local-tag"> (vos)</span>}</td>
                  <td className="pred-score">
                    {d.predScore ? `${d.predScore.home}-${d.predScore.away}` : "—"}
                  </td>
                  <td className="sim-symbol">{symbolFor(d.matchPoints)}</td>
                  <td className="sim-delta">+{d.matchPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="simulator-deltas">
          <h3>Ranking actual</h3>
          <table className="simulator-predictions-table">
            <tbody>
              {deltas.map((d) => {
                const diff = d.posBefore >= 0 ? d.posBefore - d.posAfter : 0;
                const arrow = diff > 0 ? `↑${diff}` : diff < 0 ? `↓${-diff}` : "";
                return (
                  <tr key={d.player.name} className={d.player.isLocal ? "local" : ""}>
                    <td>{d.posAfter + 1}.</td>
                    <td>{d.player.name}{d.player.isLocal && <span className="local-tag"> (vos)</span>}</td>
                    <td className="pred-score">{d.player.total} pts</td>
                    <td className="sim-arrow">{arrow}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="simulator-actions">
          <button className="sim-btn primary" onClick={() => setLastResult(null)}>
            ▶ Siguiente partido
          </button>
        </div>
      </div>
    );
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

  const matchId = match.id;
  const localName = state.playerName.trim() || "Yo";
  const localPrediction: Score | null = match.prediction;
  type PredRow = { name: string; isLocal: boolean; score: Score | null };
  const predictionRows: PredRow[] = [
    { name: localName, isLocal: true, score: localPrediction },
    ...state.rivals.map((r) => ({
      name: r.name,
      isLocal: false,
      score:
        pending.kind === "group"
          ? (r.groupPredictions[matchId] ?? null)
          : (r.knockoutPredictions[matchId] ?? null),
    })),
  ];

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
        <>
          <div className="simulator-predictions">
            <h3>Predicciones del prode</h3>
            {predictionRows.length === 0 ? (
              <p className="simulator-predictions-empty">Nadie predijo este partido.</p>
            ) : (
              <table className="simulator-predictions-table">
                <tbody>
                  {predictionRows.map((row) => (
                    <tr key={row.name} className={row.isLocal ? "local" : ""}>
                      <td>{row.name}{row.isLocal && <span className="local-tag"> (vos)</span>}</td>
                      <td className="pred-score">
                        {row.score ? `${row.score.home} - ${row.score.away}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
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
        </>
      )}
    </div>
  );
}

function symbolFor(points: number): string {
  if (points === 3) return "✓";
  if (points === 1) return "½";
  return "✗";
}

function getWinnerText(
  score: Score,
  homeName: string | undefined,
  awayName: string | undefined,
): string {
  if (score.home > score.away) return `Gana ${homeName ?? "local"}`;
  if (score.away > score.home) return `Gana ${awayName ?? "visitante"}`;
  if (score.penalties) {
    const winner = score.penalties.home > score.penalties.away ? homeName : awayName;
    return `Empatan ${score.home}-${score.away}, ${winner} pasa por penales`;
  }
  return "Empatan";
}
