import { useMemo } from 'react';

// A small deterministic random generator, so the stars stay where they are on every render.
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

// The night sky: stars that twinkle at their own pace and a few shooting stars.
//   count: how many stars. shape: 'round' or 'square' (pixels, for the console).
//   color: any CSS colour. shooting: how many shooting stars cross the sky.
const Starfield = ({ count = 100, shape = 'round', color = '#ffffff', shooting = 2, className = '' }) => {
  const stars = useMemo(() => {
    const random = seeded(42);
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: random() * 100,
      top: random() * 100,
      size: random() < 0.12 ? 3 : random() < 0.5 ? 2 : 1,
      delay: random() * 6,
      duration: 2.5 + random() * 4,
      opacity: 0.35 + random() * 0.6,
    }));
  }, [count]);

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {stars.map((s) => (
        <span
          key={s.id}
          className={`${s.id % 4 === 0 ? 'star ' : ''}absolute`}
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            background: color,
            opacity: s.opacity,
            borderRadius: shape === 'round' ? '9999px' : 0,
            boxShadow: s.size === 3 ? `0 0 6px ${color}` : undefined,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
      {Array.from({ length: shooting }, (_, i) => (
        <span
          key={`shoot-${i}`}
          className="shooting-star absolute"
          style={{ left: `${20 + i * 35}%`, top: `${6 + i * 14}%`, animationDelay: `${2 + i * 5.5}s`, color }}
        />
      ))}
    </div>
  );
};

export default Starfield;
