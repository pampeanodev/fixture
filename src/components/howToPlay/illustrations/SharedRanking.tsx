export function SharedRanking() {
  return (
    <div className="htp-ranking-wrap">
      <div className="htp-ranking-header">
        <span>Sala · Los Amigos</span>
        <span><i className="htp-live-dot" />live</span>
      </div>
      <table className="htp-table" aria-hidden="true">
        <thead>
          <tr><th>#</th><th>Jugador</th><th>Pts</th></tr>
        </thead>
        <tbody>
          <tr><td>1</td><td>Sofía</td><td>48</td></tr>
          <tr><td>2</td><td>Mateo</td><td>45</td></tr>
          <tr className="htp-row-highlight"><td>3</td><td className="htp-you">Vos</td><td>42</td></tr>
          <tr><td>4</td><td>Ana</td><td>40</td></tr>
          <tr><td>5</td><td>Valentina</td><td>37</td></tr>
        </tbody>
      </table>
    </div>
  );
}
