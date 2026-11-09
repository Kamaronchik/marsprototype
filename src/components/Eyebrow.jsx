// The small label above a title: it names the part of the mission ("Crew deck", "Mission Control").
const Eyebrow = ({ children, className = '' }) => (
  <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] text-mars ${className}`}>{children}</p>
);

export default Eyebrow;
