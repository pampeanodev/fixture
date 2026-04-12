import { useMemo } from "react";
import { useFixture } from "../context/FixtureContext";
import { calculatePlayerScore, extractLocalPredictions, extractRivalPredictions } from "../utils/scoring";
import "./RankingView.css";

interface RankedPlayer {
  name: string;
  isLocal: boolean;
  total: number;
  exact: number;
  winner: number;
  wrong: number;
  pending: number;
}

export function RankingView() {
  const { state, dispatch } = useFixture();

  const ranking = useMemo(() => {
    const players: RankedPlayer[] = [];

    // Local player
    const localName = state.playerName.trim() || "Yo";
    const localPreds = extractLocalPredictions(state.groupMatches, state.knockoutMatches);
    const localScore = calculatePlayerScore(state.groupMatches, state.knockoutMatches, {
      group: localPreds.group, knockout: localPreds.knockout,
    });
    players.push({ name: localName, isLocal: true, ...localScore });

    // Rivals
    for (const rival of state.rivals) {
      const rivalPreds = extractRivalPredictions(rival);
      const rivalScore = calculatePlayerScore(state.groupMatches, state.knockoutMatches, {
        group: rivalPreds.group, knockout: rivalPreds.knockout,
      });
      players.push({ name: rival.name, isLocal: false, ...rivalScore });
    }

    // Sort by total desc, then exact desc, then winner desc
    players.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.exact !== a.exact) return b.exact - a.exact;
      return b.winner - a.winner;
    });

    return players;
  }, [state.groupMatches, state.knockoutMatches, state.playerName, state.rivals]);

  const hasRivals = state.rivals.length > 0;

  return (
    <div className="ranking-view">
      <h2>Ranking del Prode</h2>

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
