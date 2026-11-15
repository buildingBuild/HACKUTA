// FaZe recruiter dashboard (recruiter/admin only; the API enforces the role).
// Polls every 5s so a live threshold crossing pops up during the demo.
import { useEffect, useRef, useState } from 'react';
import { listProspects, STATUSES, type Prospect, type ProspectFilters } from './api';
import { ProspectDetail } from './ProspectDetail';
import '../coaching/coaching.css';
import './recruiter.css';

const POLL_MS = 5000;

export function RecruiterDashboard() {
  const [filters, setFilters] = useState<ProspectFilters>({ track: 'player' });
  const [prospects, setProspects] = useState<Prospect[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { prospects } = await listProspects(filters);
        if (cancelled) return;
        if (known.current) {
          const arrived = prospects.filter((p) => !known.current!.has(p.id)).map((p) => p.id);
          if (arrived.length) setFresh((s) => new Set([...s, ...arrived]));
        }
        known.current = new Set(prospects.map((p) => p.id));
        setProspects(prospects);
        setError(null);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    };
    known.current = null;
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [filters]);

  if (openId) return <ProspectDetail id={openId} onBack={() => setOpenId(null)} />;

  const set = (k: keyof ProspectFilters) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setFilters((f) => ({ ...f, [k]: e.target.value || undefined }));
  const newCount = prospects?.filter((p) => p.status === 'new').length ?? 0;

  return (
    <section className="yao-panel yao-rec">
      <header className="yao-rec__head">
        <div>
          <h2 className="yao-h">Talent Pipeline</h2>
          <p className="yao-muted">Players who crossed the FaZe scouting bar, ranked by prospect score.</p>
        </div>
        {newCount > 0 && <span className="yao-badge yao-badge--new">{newCount} new</span>}
      </header>

      <div className="yao-filters">
        <label>Track
          <select value={filters.track ?? ''} onChange={set('track')}>
            <option value="">All</option><option value="player">Player</option><option value="creator">Creator</option>
          </select>
        </label>
        <label>Status
          <select value={filters.status ?? ''} onChange={set('status')}>
            <option value="">All</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Region
          <select value={filters.region ?? ''} onChange={set('region')}>
            <option value="">All</option>{['NA', 'EU', 'SA', 'OCE', 'SEA'].map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        <label>Min level
          <select value={filters.minLevel ?? ''} onChange={set('minLevel')}>
            <option value="">Any</option>{[10, 9, 8, 7, 6, 5].map((l) => <option key={l} value={l}>{l}+</option>)}
          </select>
        </label>
      </div>

      {error && <p className="yao-error">{error === 'sign in required' || error === 'forbidden' ? 'Recruiter or admin account required.' : error}</p>}
      {!prospects && !error && <p className="yao-muted">Loading prospects…</p>}
      {prospects?.length === 0 && <p className="yao-muted">No prospects match these filters yet.</p>}

      <ul className="yao-plist">
        {prospects?.map((p, i) => (
          <li key={p.id}>
            <button className={`yao-prow ${fresh.has(p.id) ? 'yao-prow--fresh' : ''}`} onClick={() => setOpenId(p.id)}>
              <span className="yao-prow__rank">#{i + 1}</span>
              {p.avatar_url ? <img className="yao-avatar" src={p.avatar_url} alt="" /> : <span className="yao-avatar" />}
              <span className="yao-prow__who">
                <strong>{p.display_name || p.handle}</strong>
                <span className="yao-muted">@{p.handle} · {p.region ?? '—'} · {p.track}</span>
              </span>
              <span className="yao-prow__stats">
                <span className="yao-lvl">L{p.faceit_level ?? '?'}</span>
                <span>{p.faceit_elo ?? '—'} ELO</span>
                <span>K/D {fmt(p.metrics?.kd)}</span>
                <span>HS {fmt(p.metrics?.hs_pct, 0)}%</span>
                <span>ADR {fmt(p.metrics?.adr, 0)}</span>
              </span>
              <span className="yao-prow__score" title="Prospect score">{p.score ?? '—'}</span>
              <span className={`yao-status yao-status--${p.status}`}>{p.status}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const fmt = (v: number | null | undefined, d = 2) => (v == null ? '—' : v.toFixed(d));
