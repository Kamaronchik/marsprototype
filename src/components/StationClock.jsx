import { useEffect, useState } from 'react';

const TIMEZONE = 'Asia/Tashkent';

// The school's own time (Tashkent) with a small live dot, like a clock on a control wall.
const StationClock = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15 * 1000);
    return () => clearInterval(timer);
  }, []);

  const time = new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);

  return (
    <span className="hidden items-center gap-2 rounded-md border border-line bg-card/70 px-2.5 py-1 font-mono text-xs font-semibold text-ink-soft lg:flex">
      <span className="live-dot h-1.5 w-1.5 rounded-full bg-moss" />
      {time} <span className="text-ink-faint">UTC+5</span>
    </span>
  );
};

export default StationClock;
