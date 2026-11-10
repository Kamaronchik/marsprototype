import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

// The last answer for every URL. Opening a page again shows it at once (no skeleton) while the
// fresh answer is fetched in the background. Emptied when someone signs in or out (src/app/store.js).
const cache = new Map();
const MAX_AGE_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 60;

export const clearFetchCache = () => cache.clear();

const fromCache = (url) => {
  const hit = url && cache.get(url);
  return hit && Date.now() - hit.time < MAX_AGE_MS ? hit.data : null;
};

const remember = (url, data) => {
  cache.delete(url);
  cache.set(url, { data, time: Date.now() });
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
};

// Loads a URL when the component opens (and again when the URL changes).
// A null URL waits. reload() asks the server again.
export const useFetch = (url) => {
  // The answer is stored together with its URL; for another URL the cache (or "loading") is shown.
  const [state, setState] = useState({ url, data: null, loading: true, error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!url) return undefined;
    let cancelled = false;
    api(url)
      .then((data) => {
        remember(url, data);
        if (!cancelled) setState({ url, data, loading: false, error: null });
      })
      .catch((error) => { if (!cancelled) setState({ url, data: null, loading: false, error }); });
    return () => { cancelled = true; };
  }, [url, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  let current = state;
  if (state.url !== url) {
    const cached = fromCache(url);
    current = { url, data: cached, loading: !!url && !cached, error: null };
  } else if (!state.data && state.loading) {
    const cached = fromCache(url);
    if (cached) current = { url, data: cached, loading: false, error: null };
  }
  return { data: current.data, loading: current.loading, error: current.error, reload };
};
