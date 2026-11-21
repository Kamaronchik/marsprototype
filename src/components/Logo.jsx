// The mark: a rust-red planet with a mountain "M" cut into it, an orbit ring around it and a small moon.
// The ring passes behind the planet on top and in front of it at the bottom (two drawings of the same ellipse).
// The wordmark is set in a serif: "Mars" in ink, "Space" in the planet's colour.
const Mark = ({ size, inverted }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <g transform="translate(32 32) rotate(-24)">
      <ellipse rx="30" ry="9" strokeWidth="2.2" className={inverted ? 'stroke-on-accent' : 'stroke-ink'} />
    </g>
    <circle cx="32" cy="32" r="21" className={inverted ? 'fill-on-accent' : 'fill-mars'} />
    <path
      d="M20 43 V25 L32 37 L44 25 V43"
      strokeWidth="4.6" strokeLinejoin="miter" strokeLinecap="butt"
      className={inverted ? 'stroke-mars' : 'stroke-on-accent'}
    />
    <g transform="translate(32 32) rotate(-24)">
      <path d="M-30 0 A30 9 0 0 0 30 0" strokeWidth="2.2" className={inverted ? 'stroke-on-accent' : 'stroke-ink'} />
      <circle cx="21" cy="6.4" r="3.6" className="fill-ochre" />
    </g>
  </svg>
);

const Logo = ({ className = '', inverted = false, compact = false }) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <Mark size={32} inverted={inverted} />
    {!compact && (
      <span className={`font-display text-[1.35rem] font-semibold leading-none tracking-tight ${inverted ? 'text-on-accent' : 'text-ink'}`}>
        Mars <span className={inverted ? '' : 'text-mars'}>Space</span>
      </span>
    )}
  </span>
);

export default Logo;
