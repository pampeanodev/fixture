export function HeroIndividual() {
  return (
    <svg viewBox="0 0 240 160" role="img" aria-hidden="true">
      <defs>
        <linearGradient id="htp-hero-ind-bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#2a2a55" />
          <stop offset="100%" stopColor="#1a1a38" />
        </linearGradient>
      </defs>
      <rect x="84" y="20" width="72" height="120" rx="10" fill="url(#htp-hero-ind-bg)" stroke="rgba(255,255,255,0.12)" />
      <rect x="92" y="34" width="56" height="8" rx="2" fill="rgba(255,255,255,0.18)" />
      <rect x="92" y="50" width="56" height="22" rx="4" fill="rgba(76,175,80,0.35)" />
      <rect x="92" y="78" width="56" height="8" rx="2" fill="rgba(255,255,255,0.15)" />
      <rect x="92" y="92" width="36" height="8" rx="2" fill="rgba(255,255,255,0.12)" />
      <rect x="92" y="106" width="48" height="8" rx="2" fill="rgba(255,255,255,0.12)" />
      <circle cx="42" cy="70" r="14" fill="rgba(253,216,53,0.6)" />
      <path d="M22 130 Q42 96 62 130 Z" fill="rgba(253,216,53,0.6)" />
    </svg>
  );
}
