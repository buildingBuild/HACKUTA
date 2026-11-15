// FaZe Live state for any component. SHARED.
// Phase 1: polls GET /api/live every 5s. Phase 2: same return shape, fed by socket.io
// (`live:status`, `live:event`), so LiveBanner / LiveCounters / RGB / Wall don't change.
import { useEffect, useRef, useState } from 'react';
import type { LiveEvent, LiveSnapshot } from '../../../../shared/types';

export interface LiveState {
  snapshot: LiveSnapshot | null;
  /** The newest event, set only when it changes (use it to trigger animations). */
  fresh: LiveEvent | null;
  error: boolean;
}

export function useLive(intervalMs = 5000): LiveState {
  const [state, setState] = useState<LiveState>({ snapshot: null, fresh: null, error: false });
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    let timer: number | undefined;
    const tick = async () => {
      try {
        const res = await fetch('/api/live', { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const snapshot = (await res.json()) as LiveSnapshot;
        if (!live) return;
        const ev = snapshot.status.lastEvent;
        const isNew = !!ev && lastId.current !== null && ev.id !== lastId.current;
        lastId.current = ev?.id ?? lastId.current ?? '';
        setState((s) => ({ snapshot, fresh: isNew ? ev : s.fresh, error: false }));
      } catch {
        if (live) setState((s) => ({ ...s, error: true }));
      } finally {
        if (live) timer = window.setTimeout(tick, document.hidden ? intervalMs * 3 : intervalMs);
      }
    };
    void tick();
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [intervalMs]);

  return state;
}
