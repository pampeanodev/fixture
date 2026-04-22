export function InviteQr() {
  const size = 9;
  const pattern: number[][] = [];
  for (let r = 0; r < size; r++) {
    const row: number[] = [];
    for (let c = 0; c < size; c++) {
      row.push(((r * 31 + c * 17 + r * c) % 3 === 0) ? 1 : 0);
    }
    pattern.push(row);
  }
  for (const [sr, sc] of [[0, 0], [0, size - 3], [size - 3, 0]] as const) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        pattern[sr + r][sc + c] = (r === 0 || r === 2 || c === 0 || c === 2) ? 1 : 0;
      }
    }
  }

  const cell = 10;
  const pad = 14;
  const qrSide = size * cell;

  return (
    <svg viewBox="0 0 240 160" role="img" aria-hidden="true">
      <rect x={pad} y={(160 - qrSide - 2 * pad) / 2} width={qrSide + 2 * pad} height={qrSide + 2 * pad} rx={8}
        fill="#fff" />
      {pattern.map((row, r) =>
        row.map((v, c) =>
          v === 1 ? (
            <rect
              key={`${r}-${c}`}
              x={pad + pad / 2 + c * cell}
              y={(160 - qrSide - 2 * pad) / 2 + pad / 2 + r * cell}
              width={cell} height={cell}
              fill="#1a1a38"
            />
          ) : null,
        ),
      )}
      <g transform="translate(132 56)">
        <rect width="90" height="10" rx="4" fill="rgba(255,255,255,0.08)" />
        <text x="8" y="7" fontSize="7" fill="rgba(255,255,255,0.7)" fontFamily="monospace">prode.app/r/a1b2c3d4</text>
      </g>
      <g transform="translate(132 74)">
        <rect width="60" height="18" rx="4" fill="rgba(76,175,80,0.2)" stroke="rgba(76,175,80,0.5)" />
        <text x="30" y="12" fontSize="8" fill="#fff" textAnchor="middle" fontWeight="600">Compartir</text>
      </g>
    </svg>
  );
}
