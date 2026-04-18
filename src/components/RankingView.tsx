import { useMemo, useState } from "react";
import { useFixture } from "../context/FixtureContext";
import { computeRanking } from "../utils/scoring";
import "./RankingView.css";

export function RankingView() {
  const { state, dispatch } = useFixture();

  const ranking = useMemo(() => computeRanking(state), [state]);

  const hasRivals = state.rivals.length > 0;
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

      {!hasRivals ? (
        <div className="ranking-empty">
          <p>Todavía no hay rivales.</p>
          <p><strong>1.</strong> Cada amigo carga sus predicciones en su app</p>
          <p><strong>2.</strong> Exporta su prode con "Exportar Prode"</p>
          <p><strong>3.</strong> Importá los prodes de tus amigos con "Importar Prode"</p>
          <p><strong>4.</strong> El ranking se arma solo comparando contra los resultados reales</p>
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
