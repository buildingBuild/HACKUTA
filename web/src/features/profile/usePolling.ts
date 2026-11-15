import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Fetch once, then refetch quietly every `intervalMs` while the tab is visible.
 * Keeps showing the last good data if a refetch fails, so flaky Wi-Fi doesn't blank the page.
 */
export function usePolling<T>(load: () => Promise<T>, deps: unknown[], intervalMs = 10_000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setData(null);
    void refresh();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, intervalMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, refresh };
}
