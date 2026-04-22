export function HeroRoom() {
  const nodes = [
    { cx: 60, cy: 40 },
    { cx: 180, cy: 40 },
    { cx: 40, cy: 120 },
    { cx: 200, cy: 120 },
    { cx: 120, cy: 80 },
  ];
  const edges: Array<[number, number]> = [
    [0, 1], [0, 2], [0, 4], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4],
  ];
  return (
    <svg viewBox="0 0 240 160" role="img" aria-hidden="true">
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].cx} y1={nodes[a].cy}
          x2={nodes[b].cx} y2={nodes[b].cy}
          stroke="rgba(253,216,53,0.35)" strokeWidth={1.5}
          strokeDasharray="3 4"
        />
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.cx} cy={n.cy} r={14} fill="#2a2a55" stroke="rgba(253,216,53,0.7)" strokeWidth={1.5} />
          <circle cx={n.cx} cy={n.cy - 3} r={5} fill="rgba(255,255,255,0.8)" />
          <path d={`M${n.cx - 8} ${n.cy + 10} Q${n.cx} ${n.cy + 2} ${n.cx + 8} ${n.cy + 10}`} fill="rgba(255,255,255,0.8)" />
        </g>
      ))}
    </svg>
  );
}
