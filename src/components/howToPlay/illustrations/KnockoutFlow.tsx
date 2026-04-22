export function KnockoutFlow() {
  const groupCols = 3;
  const groupRows = 4;
  const boxW = 28;
  const boxH = 20;
  const gapX = 10;
  const gapY = 8;
  const originX = 10;
  const originY = 14;
  const knockoutX = originX + groupCols * (boxW + gapX) + 30;

  const groups: Array<{ x: number; y: number; label: string }> = [];
  for (let r = 0; r < groupRows; r++) {
    for (let c = 0; c < groupCols; c++) {
      groups.push({
        x: originX + c * (boxW + gapX),
        y: originY + r * (boxH + gapY),
        label: String.fromCharCode(65 + r * groupCols + c),
      });
    }
  }

  return (
    <svg viewBox="0 0 240 160" role="img" aria-hidden="true">
      {groups.map((g, i) => (
        <g key={i}>
          <rect x={g.x} y={g.y} width={boxW} height={boxH} rx={3}
            fill="#2a2a55" stroke="rgba(255,255,255,0.15)" />
          <text x={g.x + boxW / 2} y={g.y + boxH / 2 + 3} fontSize="8" fill="rgba(255,255,255,0.75)" textAnchor="middle">
            {g.label}
          </text>
          <rect x={g.x + 2} y={g.y + 2} width={5} height={3} fill="rgba(76,175,80,0.8)" />
          <rect x={g.x + 9} y={g.y + 2} width={5} height={3} fill="rgba(253,216,53,0.8)" />
          <rect x={g.x + 16} y={g.y + 2} width={5} height={3} fill="none" stroke="rgba(253,216,53,0.6)" strokeDasharray="1 1" />
        </g>
      ))}

      {groups.map((g, i) => (
        <line key={`arr-${i}`}
          x1={g.x + boxW} y1={g.y + boxH / 2}
          x2={knockoutX} y2={80}
          stroke="rgba(255,255,255,0.12)" strokeWidth={0.6} />
      ))}

      <rect x={knockoutX} y={60} width={54} height={40} rx={4} fill="#1e1e3a" stroke="rgba(253,216,53,0.4)" />
      <text x={knockoutX + 27} y={78} fontSize="9" fill="#fff" textAnchor="middle" fontWeight="600">R32</text>
      <text x={knockoutX + 27} y={92} fontSize="7" fill="rgba(255,255,255,0.5)" textAnchor="middle">32 equipos</text>

      <g transform="translate(10 148)">
        <rect width="5" height="3" fill="rgba(76,175,80,0.8)" />
        <text x={10} y={3} fontSize="6" fill="rgba(255,255,255,0.6)">1°</text>
        <rect x={24} width="5" height="3" fill="rgba(253,216,53,0.8)" />
        <text x={34} y={3} fontSize="6" fill="rgba(255,255,255,0.6)">2°</text>
        <rect x={48} width="5" height="3" fill="none" stroke="rgba(253,216,53,0.6)" strokeDasharray="1 1" />
        <text x={58} y={3} fontSize="6" fill="rgba(255,255,255,0.6)">3° (mejor)</text>
      </g>
    </svg>
  );
}
