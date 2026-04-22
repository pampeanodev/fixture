export function Ranking() {
  return (
    <div className="htp-ranking-wrap">
      <div className="htp-ranking-header"><span>Ranking</span></div>
      <table className="htp-table" aria-hidden="true">
        <thead>
          <tr><th>#</th><th>Jugador</th><th>Pts</th></tr>
        </thead>
        <tbody>
          <tr><td>1</td><td>Ana</td><td>42</td></tr>
          <tr className="htp-row-highlight"><td>2</td><td className="htp-you">Vos</td><td>38</td></tr>
          <tr><td>3</td><td>Lucas</td><td>35</td></tr>
        </tbody>
      </table>
    </div>
  );
}
