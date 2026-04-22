export function Seal() {
  return (
    <svg viewBox="0 0 240 160" role="img" aria-hidden="true">
      <g transform="translate(10 30)">
        <rect width="60" height="44" rx="4" fill="#2a2a55" stroke="rgba(255,255,255,0.25)" />
        <path d="M0 0 L30 28 L60 0" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
        <rect x="12" y="52" width="36" height="6" fill="rgba(255,255,255,0.2)" />
        <text x="30" y="76" fontSize="8" fill="rgba(255,255,255,0.7)" textAnchor="middle">Editable</text>
      </g>

      <line x1="76" y1="52" x2="94" y2="52" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
      <polygon points="94,49 98,52 94,55" fill="rgba(255,255,255,0.3)" />

      <g transform="translate(100 30)">
        <rect width="60" height="44" rx="4" fill="#2a2a55" stroke="rgba(253,216,53,0.7)" />
        <path d="M0 0 L30 18 L60 0" fill="none" stroke="rgba(253,216,53,0.5)" strokeWidth="1" />
        <rect x="22" y="20" width="16" height="14" rx="2" fill="rgba(253,216,53,0.85)" />
        <path d="M26 20 V14 a4 4 0 0 1 8 0 V20" fill="none" stroke="rgba(253,216,53,0.85)" strokeWidth="1.5" />
        <text x="30" y="52" fontSize="8" fill="#fdd835" textAnchor="middle">Sellado</text>
        <text x="30" y="62" fontSize="6" fill="rgba(255,255,255,0.5)" textAnchor="middle">-1:00 h</text>
      </g>

      <line x1="166" y1="52" x2="184" y2="52" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
      <polygon points="184,49 188,52 184,55" fill="rgba(255,255,255,0.3)" />

      <g transform="translate(190 30)">
        <rect width="40" height="44" rx="4" fill="#2a2a55" stroke="rgba(76,175,80,0.7)" />
        <rect x="6" y="8" width="28" height="3" fill="rgba(255,255,255,0.7)" />
        <rect x="6" y="16" width="20" height="3" fill="rgba(255,255,255,0.5)" />
        <rect x="6" y="24" width="24" height="3" fill="rgba(255,255,255,0.5)" />
        <text x="20" y="60" fontSize="8" fill="#4caf50" textAnchor="middle">Revelado</text>
      </g>

      <text x="120" y="132" fontSize="9" fill="rgba(255,255,255,0.6)" textAnchor="middle">
        A todos al mismo tiempo
      </text>
    </svg>
  );
}
