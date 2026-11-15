// FaZe recruiter dashboard (recruiter/admin only; the API enforces the role).
// Polls every 5s so a live threshold crossing pops up during the demo.
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { listProspects, STATUSES, type Prospect, type ProspectFilters, type ProspectStatus } from './api';
import { ProspectDetail } from './ProspectDetail';
import { RulesEditor } from './RulesEditor';
import type { SessionUser } from '../../components/session';
import '../coaching/coaching.css';
import './recruiter.css';

const POLL_MS = 5000;

export function RecruiterDashboard({ user }: { user?: SessionUser | null }) {
  const [filters, setFilters] = useState<ProspectFilters>({ track: 'player' });
  const [status, setStatus] = useState<ProspectStatus | 'all'>('all');
  const [prospects, setProspects] = useState<Prospect[] | null>(null);
  const [error, setError] = useState<{ status?: number; message: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('p'));
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [showRules, setShowRules] = useState(false);
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
        if (!cancelled) setError({ status: (e as { status?: number }).status, message: (e as Error).message });
      }
    };
    known.current = null;
    void load();
    const t = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [filters]);

  // Keep ?p=<id> in the URL so a prospect can be linked and survives a reload.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (openId) url.searchParams.set('p', openId);
    else url.searchParams.delete('p');
    window.history.replaceState(null, '', url);
  }, [openId]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: prospects?.length ?? 0 };
    for (const s of STATUSES) c[s] = prospects?.filter((p) => p.status === s).length ?? 0;
    return c;
  }, [prospects]);
  const shown = prospects?.filter((p) => status === 'all' || p.status === status) ?? null;

  if (error?.status === 401 || error?.status === 403)
    return (
      <div className="yao-page">
        <p className="yao-kicker">FaZe staff only</p>
        <h1 className="yao-heading">
          Recruiter <em>access.</em>
        </h1>
        <p className="yao-lede">
          Switch the Demo login to <b>FaZe Recruiter</b> or <b>FaZe Admin</b> to see the talent pipeline.
        </p>
      </div>
    );

  if (openId)
    return (
      <div className="yao-page">
        <ProspectDetail id={openId} onBack={() => setOpenId(null)} />
      </div>
    );

  const set = (k: keyof ProspectFilters) => (e: ChangeEvent<HTMLSelectElement>) =>
    setFilters((f) => ({ ...f, [k]: e.target.value || undefined }));
  const isAdmin = user?.role === 'admin';

  return (
    <div className="yao-page">
      <header className="yao-page__head">
        <div>
          <p className="yao-kicker">
            FaZe Up Next · talent pipeline <span className="yao-dot yao-dot--pulse" /> live
          </p>
          <h1 className="yao-heading">
            Prospects<em>.</em>
          </h1>
          <p className="yao-lede">Players who cleared the scouting bar, ranked by prospect score. New ones land here the moment they cross.</p>
        </div>
        <button className="yao-btn yao-btn--sm" onClick={() => setShowRules((s) => !s)}>
          {showRules ? 'Hide' : isAdmin ? 'Tune' : 'View'} scouting bar
        </button>
      </header>

      {showRules && <RulesEditor canEdit={isAdmin} />}

      <div className="yao-counters">
        {(['all', ...STATUSES] as const).map((s) => (
          <button
            key={s}
            className={`yao-counter ${status === s ? 'is-on' : ''} ${s === 'new' && counts.new ? 'yao-counter--new' : ''}`}
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
          >
            <span className="yao-counter__n">{counts[s]}</span>
            <span className="yao-label">{s === 'all' ? 'All prospects' : s}</span>
          </button>
        ))}
      </div>

      <div className="yao-filters">
        <label className="yao-field">
          <span className="yao-label">Track</span>
          <select className="yao-select" value={filters.track ?? ''} onChange={set('track')}>
            <option value="">All</option>
            <option value="player">Player</option>
            <option value="creator">Creator</option>
          </select>
        </label>
        <label className="yao-field">
          <span className="yao-label">Region</span>
          <select className="yao-select" value={filters.region ?? ''} onChange={set('region')}>
            <option value="">All</option>
            {['NA', 'EU', 'SA', 'OCE', 'SEA'].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="yao-field">
          <span className="yao-label">Min level</span>
          <select className="yao-select" value={filters.minLevel ?? ''} onChange={set('minLevel')}>
            <option value="">Any</option>
            {[10, 9, 8, 7, 6, 5].map((l) => (
              <option key={l} value={l}>
                {l}+
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="yao-error">{error.message}</p>}
      {!shown && !error && <p className="yao-label">Loading prospects…</p>}
      {shown?.length === 0 && <p className="yao-muted">No prospects match these filters yet.</p>}

      {shown && shown.length > 0 && (
        <div className="yao-table">
          <div className="yao-trow yao-trow--head">
            <span>#</span>
            <span>Player</span>
            <span>Level · ELO</span>
            <span>K/D</span>
            <span>HS%</span>
            <span>ADR</span>
            <span>Score</span>
            <span>Status</span>
          </div>
          {shown.map((p, i) => (
            <button key={p.id} className={`yao-trow ${fresh.has(p.id) ? 'yao-trow--fresh' : ''}`} onClick={() => setOpenId(p.id)}>
              <span className="yao-trow__rank">{String(i + 1).padStart(2, '0')}</span>
              <span className="yao-trow__who">
                {p.avatar_url ? <img className="yao-avatar" src={p.avatar_url} alt="" /> : <span className="yao-avatar" />}
                <span>
                  <strong>{p.display_name || p.handle}</strong>
                  <span className="yao-label">
                    @{p.handle} · {p.region ?? '—'} {fresh.has(p.id) && <span className="yao-chip yao-chip--solid">Just in</span>}
                  </span>
                </span>
              </span>
              <span>
                <span className="yao-lvl">L{p.faceit_level ?? '?'}</span> {p.faceit_elo ?? '—'}
              </span>
              <span data-label="K/D">{fmt(p.metrics?.kd)}</span>
              <span data-label="HS%">{fmt(p.metrics?.hs_pct, 0)}</span>
              <span data-label="ADR">{fmt(p.metrics?.adr, 0)}</span>
              <span className="yao-trow__score">{p.score ?? '—'}</span>
              <span>
                <span className={`yao-status yao-status--${p.status}`}>{p.status}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const fmt = (v: number | null | undefined, d = 2) => (v == null ? '—' : v.toFixed(d));
