// Simple original product illustrations for the store (no photos needed). Owner: Omar.
const LOGO = '/brand/faze-logo.svg';

function Logo({ x, y, w }: { x: number; y: number; w: number }) {
  return <image href={LOGO} x={x} y={y} width={w} height={w * 0.72} preserveAspectRatio="xMidYMid meet" />;
}

const INK = '#0a0a0a';
const RED = '#e4002b';

export function MerchArt({ art }: { art: string | null }) {
  switch (art) {
    case 'tee':
      return (
        <svg viewBox="0 0 200 160" aria-hidden="true">
          <path d="M70 22 L52 28 L22 50 L36 74 L54 64 L54 142 L146 142 L146 64 L164 74 L178 50 L148 28 L130 22 C126 34 114 40 100 40 C86 40 74 34 70 22 Z" fill={INK} />
          <Logo x={82} y={62} w={36} />
        </svg>
      );
    case 'hoodie':
      return (
        <svg viewBox="0 0 200 160" aria-hidden="true">
          <path d="M72 26 L50 32 L20 70 L18 130 L38 132 L44 82 L54 70 L54 148 L146 148 L146 70 L156 82 L162 132 L182 130 L180 70 L150 32 L128 26 C126 14 114 8 100 8 C86 8 74 14 72 26 Z" fill={INK} />
          <path d="M80 26 C82 40 90 46 100 46 C110 46 118 40 120 26" fill="none" stroke="#2a2a2a" strokeWidth="3" />
          <path d="M72 110 L128 110 L122 134 L78 134 Z" fill="#1c1c1c" />
          <Logo x={84} y={62} w={32} />
          <text x="164" y="104" fill={RED} fontSize="9" textAnchor="middle">★★★★★</text>
        </svg>
      );
    case 'jersey':
      return (
        <svg viewBox="0 0 200 160" aria-hidden="true">
          <path d="M70 20 L50 26 L24 46 L38 70 L56 60 L56 144 L144 144 L144 60 L162 70 L176 46 L150 26 L130 20 L100 50 Z" fill={INK} />
          <path d="M56 60 L56 144 L64 144 L64 64 Z M144 60 L144 144 L136 144 L136 64 Z" fill={RED} />
          <path d="M70 20 L100 50 L130 20" fill="none" stroke={RED} strokeWidth="4" />
          <Logo x={86} y={62} w={28} />
          <text x="100" y="128" fill="#fff" fontSize="26" fontWeight="900" textAnchor="middle" fontFamily="Barlow Condensed, sans-serif">26</text>
        </svg>
      );
    case 'cap':
      return (
        <svg viewBox="0 0 200 160" aria-hidden="true">
          <path d="M40 104 C40 58 68 34 102 34 C136 34 160 58 160 104 Z" fill={INK} />
          <path d="M120 100 C150 98 182 104 190 116 C170 122 140 120 112 112 Z" fill="#1c1c1c" />
          <path d="M40 104 L160 104" stroke="#2a2a2a" strokeWidth="4" />
          <circle cx="102" cy="36" r="4" fill="#2a2a2a" />
          <Logo x={80} y={58} w={40} />
        </svg>
      );
    case 'deskmat':
      return (
        <svg viewBox="0 0 200 160" aria-hidden="true">
          <rect x="10" y="44" width="180" height="76" rx="8" fill={INK} />
          <rect x="15" y="49" width="170" height="66" rx="5" fill="none" stroke="#333" strokeDasharray="3 3" />
          <Logo x={128} y={60} w={48} />
          <text x="26" y="104" fill={RED} fontSize="16" fontWeight="900" fontFamily="Barlow Condensed, sans-serif">FAZE UP</text>
        </svg>
      );
    case 'stickers':
      return (
        <svg viewBox="0 0 200 160" aria-hidden="true">
          <circle cx="72" cy="78" r="40" fill={RED} />
          <rect x="96" y="40" width="74" height="74" rx="10" fill={INK} transform="rotate(8 133 77)" />
          <Logo x={112} y={58} w={44} />
          <text x="72" y="92" fill="#fff" fontSize="40" textAnchor="middle">★</text>
          <rect x="42" y="112" width="96" height="30" rx="15" fill="#fff" stroke={INK} strokeWidth="3" />
          <text x="90" y="133" fill={INK} fontSize="16" fontWeight="900" textAnchor="middle" fontFamily="Barlow Condensed, sans-serif">EST. 2010</text>
        </svg>
      );
    case 'vod':
      return (
        <svg viewBox="0 0 200 160" aria-hidden="true">
          <rect x="24" y="26" width="152" height="94" rx="6" fill={INK} />
          <path d="M88 52 L120 73 L88 94 Z" fill={RED} />
          <rect x="36" y="106" width="128" height="4" fill="#333" />
          <rect x="36" y="106" width="58" height="4" fill={RED} />
          <circle cx="60" cy="108" r="4" fill="#ff4d63" />
          <circle cx="112" cy="108" r="4" fill="#ff4d63" />
          <rect x="88" y="120" width="24" height="16" fill={INK} />
          <rect x="66" y="136" width="68" height="6" rx="3" fill={INK} />
        </svg>
      );
    case 'coach':
      return (
        <svg viewBox="0 0 200 160" aria-hidden="true">
          <path d="M58 96 C58 56 76 34 100 34 C124 34 142 56 142 96" fill="none" stroke={INK} strokeWidth="10" strokeLinecap="round" />
          <rect x="44" y="88" width="28" height="44" rx="10" fill={INK} />
          <rect x="128" y="88" width="28" height="44" rx="10" fill={INK} />
          <path d="M150 124 C150 140 132 146 112 146" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          <circle cx="106" cy="146" r="7" fill={RED} />
          <text x="100" y="98" fill={RED} fontSize="22" fontWeight="900" textAnchor="middle" fontFamily="Barlow Condensed, sans-serif">1:1</text>
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 200 160" aria-hidden="true">
          <rect x="50" y="30" width="100" height="100" rx="8" fill={INK} />
          <Logo x={70} y={58} w={60} />
        </svg>
      );
  }
}
