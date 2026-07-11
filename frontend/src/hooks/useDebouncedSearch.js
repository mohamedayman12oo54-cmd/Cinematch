import { useEffect, useState } from 'react';
import * as searchApi from '../api/search';
import { getErrorMessage } from '../utils/errors';

export function useDebouncedSearch(query, { limit = 6, minLength = 2, delay = 300 } = {}) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < minLength) {
      setResults([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const res = await searchApi.search(trimmed, limit);
        if (!cancelled) setResults(res.data ?? []);
      } catch (err) {
        if (!cancelled) {
          setResults([]);
          setError(getErrorMessage(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, limit, minLength, delay]);

  return { results, loading, error };
}
