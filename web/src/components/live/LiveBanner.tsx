// "FaZe is live" strip. SHARED. Reads useLive(); flashes on every new event.
import { useEffect, useState } from 'react';
import type { LiveEvent, LiveStatus } from '../../../../shared/types';
import './live.css';

const EVENT_COPY: Record<LiveEvent['type'], string> = {
  match_start: 'Match started',
  round_win: 'FaZe take the round',
  round_loss: 'Round to the opponent',
  ace: 'ACE · FAZE UP',
  clutch: 'CLUTCH',
  match_win: 'FAZE WIN',
  match_loss: 'Match over',
  match_end: 'Match over',
};
const GOOD = new Set<LiveEvent['type']>(['round_win', 'ace', 'clutch', 'match_win']);

function untilText(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function LiveBanner({ status, fresh }: { status: LiveStatus | null; fresh: LiveEvent | null }) {
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!fresh) return;
    setFlash(fresh.id);
    const t = window.setTimeout(() => setFlash(null), 2400);
    return () => window.clearTimeout(t);
  }, [fresh]);

  if (!status) return <div className="live live--loading" aria-hidden />;
  const ev = status.lastEvent;
  const good = !!ev && GOOD.has(ev.type);

  if (!status.live) {
    const finished = !!ev && (ev.type === 'match_win' || ev.type === 'match_loss');
    return (
      <div className="live live--idle" role="status">
        <span className="live__tag">{finished ? 'Final' : 'Up next'}</span>
        <span className="live__text">
          {finished ? (
            <>
              FaZe <strong className="live__score">{status.score.faze} <i>:</i> {status.score.opp}</strong> {status.opponent}
            </>
          ) : (
            <>
              FaZe vs <strong>{status.opponent}</strong>
            </>
          )}
          {status.nextMatchAt && <span className="live__meta"> · next match in {untilText(status.nextMatchAt - Date.now())}</span>}
        </span>
        {status.source === 'mock' && <span className="live__src">demo feed</span>}
      </div>
    );
  }

  return (
    <div className={`live ${flash ? (good ? 'live--flash-good' : 'live--flash-bad') : ''}`} role="status" aria-live="polite">
      <span className="live__tag live__tag--on">Live</span>
      <span className="live__text">
        FaZe is live: <strong className="live__score">{status.score.faze} <i>:</i> {status.score.opp}</strong> vs {status.opponent}
        {ev && ev.type !== 'match_start' && <span className={`live__event ${good ? 'is-good' : ''}`}> · {EVENT_COPY[ev.type]}</span>}
      </span>
      {status.source === 'mock' && <span className="live__src">demo feed</span>}
    </div>
  );
}
