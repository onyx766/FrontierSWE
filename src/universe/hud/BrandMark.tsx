/** The glowing O on its shield, drawn from the composition's top-left badge. */

const SHIELD =
  'M32 6.2 Q42 8.6 50.4 13.2 Q55 21 55.2 29.6 Q55 37.6 50 44.4 Q41.6 50.4 32 53.4 Q22.4 50.4 14 44.4 Q9 37.6 8.8 29.6 Q9 21 13.6 13.2 Q22 8.6 32 6.2 Z';

/* An O: the outer ring, then the counter, cut out by the even-odd rule. */
const LETTER =
  'M19 30.3a13 12.5 0 1 0 26 0a13 12.5 0 1 0-26 0ZM25.4 30.3a6.6 6.2 0 1 0 13.2 0a6.6 6.2 0 1 0-13.2 0Z';

export function BrandMark() {
  return (
    <svg viewBox="0 0 64 60" className="uh-brand-mark" aria-hidden>
      <defs>
        <radialGradient id="uh-mark-halo">
          <stop offset="0" stopColor="#3b86ff" stopOpacity="0.85" />
          <stop offset="0.55" stopColor="#2a58e0" stopOpacity="0.5" />
          <stop offset="0.8" stopColor="#1a3aa8" stopOpacity="0.22" />
          <stop offset="1" stopColor="#0a1640" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="uh-mark-letter" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#f6fbff" />
          <stop offset="0.55" stopColor="#dcecff" />
          <stop offset="1" stopColor="#b6d4ff" />
        </linearGradient>
        <filter id="uh-mark-blur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
      </defs>

      <ellipse cx="32" cy="30" rx="32" ry="30" fill="url(#uh-mark-halo)" />
      <path d={SHIELD} fill="#16224a" fillOpacity="0.5" stroke="#9db2ee" strokeOpacity="0.16" strokeWidth="0.7" />

      <path d="M14.2 13.2 11.8 11.4M49.8 13.2l2-2" stroke="#8fa6e6" strokeOpacity="0.32" strokeWidth="0.8" />
      <path d="M13.8 44.6 11 46.8M50.2 44.6 53 46.8" stroke="#a58aff" strokeOpacity="0.85" strokeWidth="1.1" />

      <path d={LETTER} fillRule="evenodd" fill="#4b93ff" filter="url(#uh-mark-blur)" />
      <path d={LETTER} fillRule="evenodd" fill="url(#uh-mark-letter)" />
    </svg>
  );
}
