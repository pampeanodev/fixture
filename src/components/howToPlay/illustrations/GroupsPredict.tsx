export function GroupsPredict() {
  return (
    <div className="htp-groups-predict">
      <div className="htp-score-card" aria-hidden="true">
        <span className="htp-flag" style={{ background: "#75aadb" }} />
        <span>ARG</span>
        <span className="htp-score-input">2</span>
        <span className="htp-score-dash">–</span>
        <span className="htp-score-input">1</span>
        <span>BRA</span>
        <span className="htp-flag" style={{ background: "#009c3b" }} />
      </div>
      <table className="htp-table" aria-hidden="true">
        <thead>
          <tr><th>#</th><th>Eq.</th><th>Pts</th></tr>
        </thead>
        <tbody>
          <tr className="htp-row-highlight"><td>1</td><td>ARG</td><td>3</td></tr>
          <tr><td>2</td><td>ESP</td><td>1</td></tr>
          <tr><td>3</td><td>MEX</td><td>1</td></tr>
          <tr><td>4</td><td>BRA</td><td>0</td></tr>
        </tbody>
      </table>
    </div>
  );
}
