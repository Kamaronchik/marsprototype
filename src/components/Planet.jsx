// Mars, drawn with CSS only: a rusty sphere, a surface that slowly turns, a dark side and a thin glow
// of atmosphere. size is any CSS length; position it with className.
const Planet = ({ size = '34rem', className = '' }) => (
  <div className={`planet ${className}`} style={{ width: size, height: size }} aria-hidden="true">
    <div className="planet-surface" />
    <div className="planet-shade" />
  </div>
);

export default Planet;
