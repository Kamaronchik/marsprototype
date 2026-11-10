import { useEffect, useRef } from 'react';

// Runs callback every `ms` milliseconds, but only while the tab is on the screen.
// A hidden tab sends no requests; when it is shown again the callback runs once right away.
export const usePolling = (callback, ms, enabled = true) => {
  const latest = useRef(callback);

  useEffect(() => { latest.current = callback; });

  useEffect(() => {
    if (!enabled) return undefined;
    let timer = null;
    const start = () => { if (!timer) timer = setInterval(() => latest.current(), ms); };
    const stop = () => { clearInterval(timer); timer = null; };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        latest.current();
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [ms, enabled]);
};
