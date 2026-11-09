// A Martian landscape at dusk, drawn in SVG: two moons, far mountains, three layers of dunes and a
// small rover that drives slowly across. It is the picture on top of the "Mars Base" home screen.
const STARS = [[80, 30], [210, 70], [340, 24], [470, 56], [600, 18], [730, 64], [880, 28], [1010, 52], [1120, 22], [1170, 80], [160, 110], [540, 96]];

const Horizon = ({ className = '' }) => (
  <svg viewBox="0 0 1200 280" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="horizon-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2a1838" />
        <stop offset="0.5" stopColor="#7e3a3a" />
        <stop offset="1" stopColor="#e9a35e" />
      </linearGradient>
      <radialGradient id="horizon-glow" cx="0.78" cy="0.92" r="0.5">
        <stop offset="0" stopColor="#ffd9a0" stopOpacity="0.9" />
        <stop offset="1" stopColor="#ffd9a0" stopOpacity="0" />
      </radialGradient>
    </defs>

    <rect width="1200" height="280" fill="url(#horizon-sky)" />
    <rect width="1200" height="280" fill="url(#horizon-glow)" />

    {STARS.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill="#fff" opacity="0.7" />)}

    {/* Two moons: Phobos is small and close, Deimos is a pale disc */}
    <circle cx="930" cy="70" r="26" fill="#f4e3d0" opacity="0.95" />
    <circle cx="920" cy="62" r="6" fill="#d9c0a8" opacity="0.7" />
    <circle cx="1050" cy="48" r="11" fill="#cfa98f" opacity="0.9" />

    {/* Far mountains and three dune layers, each a little darker and closer */}
    <path d="M0 190 L90 150 L170 178 L270 128 L380 176 L470 146 L590 186 L700 140 L810 182 L930 152 L1060 188 L1200 160 V280 H0Z" fill="#6b2e2e" opacity="0.75" />
    <path d="M0 214 C140 184 290 226 470 204 S800 182 990 212 S1140 204 1200 198 V280 H0Z" fill="#a8472a" />
    <path d="M0 236 C170 212 330 250 540 230 S850 208 1040 236 S1160 232 1200 226 V280 H0Z" fill="#c1602f" />
    <path d="M0 258 C200 240 380 270 620 254 S960 240 1200 260 V280 H0Z" fill="#dc8340" />

    {/* The rover: body, solar panel, mast and six wheels */}
    <g className="horizon-rover" transform="translate(860 214)">
      <rect x="0" y="-18" width="46" height="14" rx="3" fill="#f1e6d8" />
      <rect x="6" y="-30" width="30" height="8" rx="2" fill="#2d4f7c" />
      <line x1="38" y1="-18" x2="38" y2="-34" stroke="#f1e6d8" strokeWidth="2" />
      <circle cx="38" cy="-36" r="3" fill="#ffd166" />
      {[6, 23, 40].map((x) => <circle key={x} cx={x} cy="-1" r="6" fill="#3a2a26" stroke="#f1e6d8" strokeWidth="1.5" />)}
    </g>
  </svg>
);

export default Horizon;
