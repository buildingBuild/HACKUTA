// Home live counters. SHARED. Numbers tween up as they change.
import { useEffect, useRef, useState } from 'react';
import type { LiveCounters as Counters } from '../../../../shared/types';
import './live.css';

function useTween(target: number, ms = 900): number {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      setV(Math.round(a + (target - a) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function Counter({ label, value }: { label: string; value: number }) {
  const v = useTween(value);
  return (
    <div className="live-count">
      <strong className="live-count__n">{v.toLocaleString()}</strong>
      <span className="live-count__label">{label}</span>
    </div>
  );
}

export function LiveCounters({ counters }: { counters: Counters | null }) {
  const c = counters ?? { pixelsToday: 0, setupsSynced: 0, guessersToday: 0, fansOnline: 0 };
  return (
    <div className="live-counts" aria-label="Live counters">
      <Counter label="Pixels placed today" value={c.pixelsToday} />
      <Counter label="Setups synced" value={c.setupsSynced} />
      <Counter label="Guessers today" value={c.guessersToday} />
      <Counter label="Fans online" value={c.fansOnline} />
    </div>
  );
}
