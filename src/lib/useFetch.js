import { useEffect, useState } from 'react';
import { api } from './api';

// Loads a URL when the component opens (and again when the URL changes).
// A null URL waits. reload() asks the server again.
export const useFetch = (url) => {
  const [state, setState] = useState({ data: null, loading: !!url, error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!url) return undefined;
    let cancelled = false;
    api(url)
      .then((data) => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch((error) => { if (!cancelled) setState({ data: null, loading: false, error }); });
    return () => { cancelled = true; };
  }, [url, version]);

  return { ...state, reload: () => setVersion((v) => v + 1) };
};
