export function CtaRooms() {
  const nodes = [
    { x: 120, y: 80 },
    { x: 40, y: 40 },
    { x: 200, y: 40 },
    { x: 40, y: 120 },
    { x: 200, y: 120 },
    { x: 120, y: 20 },
    { x: 120, y: 140 },
  ];
  return (
    <svg viewBox="0 0 240 160" role="img" aria-hidden="true">
      {nodes.slice(1).map((n, i) => (
        <line key={i}
          x1={nodes[0].x} y1={nodes[0].y}
          x2={n.x} y2={n.y}
          stroke="rgba(76,175,80,0.4)" strokeDasharray="2 3" />
      ))}
      {nodes.map((n, i) => (
        <g key={`n-${i}`}>
          <rect x={n.x - 14} y={n.y - 10} width={28} height={20} rx={3}
            fill="#2a2a55" stroke={i === 0 ? "rgba(253,216,53,0.7)" : "rgba(76,175,80,0.6)"} />
          <circle cx={n.x} cy={n.y} r={3} fill={i === 0 ? "rgba(253,216,53,0.9)" : "rgba(76,175,80,0.9)"} />
        </g>
      ))}
    </svg>
  );
}
