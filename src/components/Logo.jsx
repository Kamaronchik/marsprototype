// Wordmark: a small planet (circle with an orbit ring) + the name set in a serif.
const Logo = ({ className = '', inverted = false }) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <circle cx="13" cy="13" r="8" className={inverted ? 'fill-on-accent' : 'fill-mars'} />
      <ellipse
        cx="13" cy="13" rx="12" ry="4.5"
        transform="rotate(-24 13 13)"
        className={inverted ? 'stroke-on-accent' : 'stroke-ink'}
        strokeWidth="1.4"
      />
    </svg>
    <span className={`font-display text-[1.35rem] font-semibold leading-none tracking-tight ${inverted ? 'text-on-accent' : 'text-ink'}`}>
      Mars Space
    </span>
  </span>
);

export default Logo;
