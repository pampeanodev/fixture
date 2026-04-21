import { useMemo, useState } from "react";
import { useFixture } from "../context/FixtureContext";
import { computeRanking } from "../utils/scoring";
import type { RankedPlayer } from "../utils/scoring";
import "./RankingView.css";

export function RankingView() {
  const { state, dispatch } = useFixture();

  const ranking = useMemo(() => {
    const base = computeRanking(state);
    const totalMatches = state.groupMatches.length + state.knockoutMatches.length;
    const existingNames = new Set(base.map((p) => p.name));
    const extras: RankedPlayer[] = state.members
      .filter((m) => !existingNames.has(m.name))
      .map((m) => ({
        name: m.name,
        isLocal: false,
        total: 0,
        exact: 0,
        winner: 0,
        wrong: 0,
        pending: totalMatches,
      }));
    return [...base, ...extras];
  }, [state]);

  const hasPlayers = ranking.length > 1;
  const [showRules, setShowRules] = useState(false);

  return (
    <div className="ranking-view">
      <div className="ranking-header">
        <h2>Ranking del Prode</h2>
        <button className="ranking-rules-btn" onClick={() => setShowRules((v) => !v)}>
          {showRules ? "Cerrar" : "¿Cómo funciona?"}
        </button>
      </div>

      {showRules && (
        <div className="ranking-rules">
          <h3>Puntuación</h3>
          <div className="ranking-rules-grid">
            <div className="ranking-rule-card exact">
              <div className="ranking-rule-points">3 pts</div>
              <div className="ranking-rule-icon">✓</div>
              <div className="ranking-rule-label">Resultado exacto</div>
              <div className="ranking-rule-example">Predecís 2-1 y sale 2-1</div>
            </div>
            <div className="ranking-rule-card winner">
              <div className="ranking-rule-points">1 pt</div>
              <div className="ranking-rule-icon">½</div>
              <div className="ranking-rule-label">Ganador correcto</div>
              <div className="ranking-rule-example">Predecís 2-0 pero sale 3-1</div>
            </div>
            <div className="ranking-rule-card wrong">
              <div className="ranking-rule-points">0 pts</div>
              <div className="ranking-rule-icon">✗</div>
              <div className="ranking-rule-label">Resultado errado</div>
              <div className="ranking-rule-example">Predecís victoria local y gana el visitante</div>
            </div>
          </div>

          <h3>Desempate</h3>
          <p>Si dos jugadores tienen los mismos puntos, se desempata por:</p>
          <ol>
            <li>Mayor cantidad de resultados exactos (✓)</li>
            <li>Mayor cantidad de ganadores correctos (½)</li>
          </ol>

          <h3>¿Cómo competir?</h3>
          <ol>
            <li>Cada jugador pone su nombre y carga sus predicciones en modo "Predicciones"</li>
            <li>Exporta su prode desde el menú ⋯ → "Exportar mi prode"</li>
            <li>Comparte el archivo JSON con sus amigos</li>
            <li>Cada uno importa los prodes de los demás desde ⋯ → "Importar prode rival"</li>
            <li>A medida que se cargan los resultados reales, el ranking se actualiza solo</li>
          </ol>
        </div>
      )}

      {!hasPlayers ? (
        <div className="ranking-empty">
          <p>Todavía no hay rivales.</p>
          <p><strong>1.</strong> Creá o uníte a una sala desde el menú lateral</p>
          <p><strong>2.</strong> Compartí el link con tus amigos</p>
          <p><strong>3.</strong> A medida que cada uno cargue predicciones, aparecen acá</p>
          <p><strong>4.</strong> El ranking se arma solo cuando empiezan a jugarse los partidos</p>
        </div>
      ) : (
        <table className="ranking-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Jugador</th>
              <th>Pts</th>
              <th>✓</th>
              <th>½</th>
              <th>✗</th>
              <th>Pend</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((player, i) => (
              <tr key={player.name} className={player.isLocal ? "local" : ""}>
                <td>{i + 1}</td>
                <td>
                  {player.name}
                  {player.isLocal && <span className="ranking-name-you">(vos)</span>}
                </td>
                <td className="ranking-total">{player.total}</td>
                <td>{player.exact}</td>
                <td>{player.winner}</td>
                <td>{player.wrong}</td>
                <td>{player.pending}</td>
                <td>
                  {!player.isLocal && (
                    <button
                      className="ranking-remove"
                      onClick={() => dispatch({ type: "REMOVE_RIVAL", name: player.name })}
                      title={`Quitar a ${player.name}`}
                    >×</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
