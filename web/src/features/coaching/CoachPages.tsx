// Coaching pages wired into the app shell:
//   /coach       player hub: scout progress, stats, add a clip, link FACEIT, clip list
//   /clips/:id   clip + video + AI coach report (?analyze=1 starts analysis on load).
//                Joe can swap in his clip page later and embed <CoachingReportPanel clipId onSeek />.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { fetchProfile, ScoutProgressBar, type ScoutProgress } from '../profile';
import '../profile/profile.css';
import {
  createClip,
  getAccount,
  getClip,
  getPlayerStats,
  isYouTube,
  linkFaceit,
  listClips,
  syncFaceit,
  youTubeEmbed,
  type ClipRow,
  type GameAccount,
  type PlayerStats,
} from './api';
import { CoachingReportPanel } from './CoachingReportPanel';
import type { SessionUser } from '../../components/session';
import './coaching.css';

const MAPS = ['Mirage', 'Inferno', 'Nuke', 'Ancient', 'Anubis', 'Dust2', 'Train', 'Overpass'];

function useScout(handle: string | undefined) {
  const [scout, setScout] = useState<ScoutProgress | null>(null);
  const refresh = useCallback(() => {
    if (!handle) return;
    fetchProfile(handle).then((p) => setScout(p.scout), () => setScout(null));
  }, [handle]);
  useEffect(refresh, [refresh]);
  return { scout, refresh };
}

// ====================================================================== /coach

export function MyClipsPage({ user }: { user: SessionUser | null }) {
  const [clips, setClips] = useState<ClipRow[] | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const { scout, refresh: refreshScout } = useScout(user?.handle);

  const loadStats = useCallback(() => {
    if (user) getPlayerStats(user.id).then(setStats, () => setStats(null));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    listClips(user.id).then((r) => setClips(r.clips), () => setClips([]));
    loadStats();
  }, [user, loadStats]);

  if (!user)
    return (
      <div className="yao-page">
        <p className="yao-kicker">AI Coach</p>
        <h1 className="yao-heading">Sign in to get <em>coached.</em></h1>
        <p className="yao-lede">Pick a player in the Demo login menu above. Try <b>Vyper</b>: one great clip away from the FaZe scouting bar.</p>
      </div>
    );

  const toAnalyze = clips?.filter((c) => c.overall_score == null).length ?? 0;
  return (
    <div className="yao-page">
      <header className="yao-page__head">
        <div>
          <p className="yao-kicker">AI Coach · CS2 · {user.display_name ?? user.handle}</p>
          <h1 className="yao-heading">
            Your <em>clips.</em>
          </h1>
          <p className="yao-lede">Every clip gets scored like a pro coach would. Average 80+ on your last five with the stats to match and FaZe scouts see you.</p>
        </div>
        <a className="yao-btn yao-btn--sm" href={`/u/${user.handle}`}>
          Public profile <span className="yao-btn__arrow">→</span>
        </a>
      </header>

      {scout && (
        <div className="pf-root yao-scout">
          <ScoutProgressBar scout={scout} />
        </div>
      )}

      {stats && <StatStrip stats={stats} />}

      <div className="yao-coach-grid">
        <section className="yao-card">
          <div className="yao-card__head">
            <h2 className="yao-h">Clips</h2>
            <span className="yao-label">
              {clips?.length ?? 0} total{toAnalyze ? ` · ${toAnalyze} waiting for coaching` : ''}
            </span>
          </div>
          {clips === null ? (
            <p className="yao-label">Loading…</p>
          ) : clips.length === 0 ? (
            <p className="yao-muted">No clips yet. Add one to get coached.</p>
          ) : (
            <ul className="yao-cliplist">
              {clips.map((c) => (
                <li key={c.id}>
                  <a className="yao-cliprow" href={`/clips/${c.id}${c.overall_score == null ? '?analyze=1' : ''}`}>
                    <span className="yao-cliprow__map">{(c.map ?? 'cs2').slice(0, 4)}</span>
                    <span className="yao-cliprow__title">
                      <strong>{c.title ?? 'Untitled clip'}</strong>
                      <span className="yao-label">
                        {c.map ?? '—'} · {c.side ?? '—'} · {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </span>
                    {c.overall_score != null ? (
                      <span className="yao-cliprow__score">{c.overall_score}</span>
                    ) : (
                      <span className="yao-cliprow__cta">Get coached →</span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div style={{ display: 'grid', gap: 20 }}>
          <AddClipCard />
          <FaceitCard
            user={user}
            onSynced={() => {
              loadStats();
              refreshScout();
            }}
          />
        </div>
      </div>
    </div>
  );
}

function StatStrip({ stats }: { stats: PlayerStats }) {
  const items: { key: string; label: string; digits: number; suffix?: string }[] = [
    { key: 'elo', label: 'FACEIT ELO', digits: 0 },
    { key: 'kd', label: 'K/D · last 20', digits: 2 },
    { key: 'hs_pct', label: 'HS% · last 20', digits: 0, suffix: '%' },
    { key: 'adr', label: 'ADR · last 20', digits: 1 },
  ];
  return (
    <div className="yao-stats">
      {items.map((it) => {
        const series = stats.trend.map((d) => d[it.key]).filter((v): v is number => typeof v === 'number');
        const now = stats.latest[it.key];
        const delta = series.length > 1 && now != null ? now - series[0] : null;
        return (
          <div key={it.key} className="yao-stat">
            <span className="yao-label">{it.label}</span>
            <span className="yao-stat__value">
              {now == null ? '—' : now.toFixed(it.digits)}
              {now != null && it.suffix}
            </span>
            <span className={`yao-stat__delta ${delta == null ? '' : delta >= 0 ? 'yao-stat__delta--up' : 'yao-stat__delta--down'}`}>
              {delta == null ? 'no history' : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(it.digits)} · 30d`}
            </span>
            <Sparkline values={series} />
          </div>
        );
      })}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const W = 120, H = 28;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 3 - ((v - min) / span) * (H - 6)] as const);
  return (
    <svg className="yao-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} vectorEffect="non-scaling-stroke" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" />
    </svg>
  );
}

function AddClipCard() {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [map, setMap] = useState('Mirage');
  const [side, setSide] = useState<'T' | 'CT'>('T');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const clip = await createClip({ blob_url: url.trim(), title: title.trim() || undefined, map, side });
      window.location.href = `/clips/${clip.id}?analyze=1`;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <section className="yao-card">
      <div className="yao-card__head">
        <h2 className="yao-h">Add a clip</h2>
        <span className="yao-chip">10–60s</span>
      </div>
      <form className="yao-form" onSubmit={submit}>
        <label className="yao-field">
          <span className="yao-label">Clip URL · YouTube or .mp4</span>
          <input className="yao-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtu.be/…" required type="url" />
        </label>
        <label className="yao-field">
          <span className="yao-label">Title</span>
          <input className="yao-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="1v2 retake on B" maxLength={80} />
        </label>
        <div className="yao-form__row">
          <label className="yao-field">
            <span className="yao-label">Map</span>
            <select className="yao-select" value={map} onChange={(e) => setMap(e.target.value)}>
              {MAPS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <div className="yao-field">
            <span className="yao-label">Side</span>
            <div className="yao-seg" role="group" aria-label="Side">
              {(['T', 'CT'] as const).map((s) => (
                <button key={s} type="button" aria-pressed={side === s} onClick={() => setSide(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        {url && isYouTube(url) && <p className="yao-label">YouTube links go straight to Gemini, no upload needed.</p>}
        {error && <p className="yao-error">{error}</p>}
        <div className="yao-form__foot">
          <button className="yao-btn yao-btn--primary" disabled={busy || !url.trim()}>
            {busy ? 'Adding…' : 'Coach this clip'} <span className="yao-btn__arrow">→</span>
          </button>
        </div>
      </form>
    </section>
  );
}

function FaceitCard({ user, onSynced }: { user: SessionUser; onSynced: () => void }) {
  const [account, setAccount] = useState<GameAccount | null>(null);
  const [nick, setNick] = useState('');
  const [busy, setBusy] = useState<'link' | 'sync' | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);

  useEffect(() => {
    getAccount(user.id).then((r) => {
      setAccount(r.account);
      setNick(r.account?.faceit_nickname ?? '');
    }, () => {});
  }, [user.id]);

  async function link(e: FormEvent) {
    e.preventDefault();
    setBusy('link');
    setMsg(null);
    try {
      const r = await linkFaceit(user.id, nick.trim());
      setAccount(r.account);
      setMsg({ tone: 'ok', text: `Linked ${r.account.faceit_nickname}. Sync to pull stats.` });
    } catch (err) {
      setMsg({ tone: 'warn', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function sync() {
    setBusy('sync');
    setMsg(null);
    try {
      const r = await syncFaceit(user.id);
      setMsg(
        r.source === 'faceit'
          ? { tone: 'ok', text: `Pulled fresh FACEIT stats for ${r.nickname}.` }
          : r.source === 'mock'
            ? { tone: 'ok', text: `Synced ${r.new_matches ?? 'new'} matches for ${r.nickname} · demo FACEIT data` }
            : { tone: 'warn', text: `Couldn't sync (${r.error ?? 'offline'}). Showing saved stats.` },
      );
      if (r.scouting?.created.length) setMsg({ tone: 'ok', text: 'New stats crossed the scouting bar. Report sent to FaZe.' });
      getAccount(user.id).then((a) => setAccount(a.account), () => {});
      onSynced();
    } catch (err) {
      setMsg({ tone: 'warn', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const linked = account?.faceit_nickname;
  return (
    <section className="yao-card">
      <div className="yao-card__head">
        <h2 className="yao-h">FACEIT</h2>
        {linked ? <span className="yao-chip yao-chip--ink">Linked</span> : <span className="yao-chip">Not linked</span>}
      </div>
      <form className="yao-form" onSubmit={link}>
        <label className="yao-field">
          <span className="yao-label">FACEIT nickname</span>
          <input className="yao-input" value={nick} onChange={(e) => setNick(e.target.value)} placeholder="your_faceit_name" />
        </label>
        {account?.faceit_level != null && (
          <p className="yao-label">
            Level {account.faceit_level} · {account.faceit_elo ?? '—'} ELO · {account.region ?? '—'}
          </p>
        )}
        {msg && <p className={msg.tone === 'warn' ? 'yao-error' : 'yao-label'}>{msg.text}</p>}
        <div className="yao-form__foot">
          <button className="yao-btn yao-btn--sm" disabled={!!busy || !nick.trim() || nick.trim() === linked}>
            {busy === 'link' ? 'Linking…' : linked ? 'Update' : 'Link'}
          </button>
          <button type="button" className="yao-btn yao-btn--sm" onClick={sync} disabled={!!busy || !linked}>
            {busy === 'sync' ? 'Syncing…' : 'Sync stats'}
          </button>
        </div>
      </form>
    </section>
  );
}

// ================================================================= /clips/:id

export function ClipCoachPage({ clipId }: { clipId: string }) {
  const [clip, setClip] = useState<ClipRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const { scout, refresh } = useScout(clip?.handle);
  const autoAnalyze = new URLSearchParams(window.location.search).has('analyze');

  useEffect(() => {
    getClip(clipId).then(setClip, (e: Error) => setError(e.message));
  }, [clipId]);

  if (error)
    return (
      <div className="yao-page">
        <p className="yao-kicker">Clip</p>
        <h1 className="yao-heading">Clip not found.</h1>
        <p className="yao-lede">{error}. <a href="/coach">Back to your clips</a></p>
      </div>
    );
  if (!clip) return <div className="yao-page"><p className="yao-label">Loading clip…</p></div>;

  const embed = isYouTube(clip.blob_url) ? youTubeEmbed(clip.blob_url) : null;
  const seek = (s: number) => {
    if (embed && frame.current?.contentWindow) {
      frame.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [s, true] }), '*');
      frame.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
    } else if (video.current) {
      video.current.currentTime = s;
      void video.current.play().catch(() => {});
    }
  };

  return (
    <div className="yao-page">
      <header className="yao-page__head">
        <div>
          <p className="yao-kicker">
            <a href={`/u/${clip.handle}`}>@{clip.handle}</a> · {clip.map ?? 'CS2'} · {clip.side ?? '—'} side
          </p>
          <h1 className="yao-heading">{clip.title ?? 'Untitled clip'}</h1>
        </div>
        <a className="yao-link" href="/coach">← All clips</a>
      </header>

      {scout && (
        <div className="pf-root yao-scout">
          <ScoutProgressBar scout={scout} />
        </div>
      )}

      <div className="yao-clip-grid">
        <div className="yao-video">
          {embed ? (
            <iframe ref={frame} src={embed} title={clip.title ?? 'Clip'} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
          ) : videoError ? (
            <div className="yao-video__missing">
              <strong>Video not found</strong>
              <span>
                Drop <code>{clip.blob_url.split('/').pop()}</code> into <code>server/demo-clips/</code> to play it here.
              </span>
              <span>Coaching still works without it.</span>
            </div>
          ) : (
            <video ref={video} src={clip.blob_url} controls playsInline onError={() => setVideoError(true)} />
          )}
        </div>
        <CoachingReportPanel clipId={clip.id} autoAnalyze={autoAnalyze} onSeek={seek} onAnalyzed={refresh} />
      </div>
    </div>
  );
}
