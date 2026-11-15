// TEMPORARY sandbox shell: demo login picker + two tabs (Player clip report, Recruiter).
// Joe's real shell replaces all of this; only web/src/features/* is kept.
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CoachingReportPanel } from '@features/coaching/CoachingReportPanel';
import { getScoutProgress } from '@features/coaching/api';
import type { ScoutProgress } from '@features/coaching/types';
import { RecruiterDashboard } from '@features/recruiter/RecruiterDashboard';

interface DemoUser { id: string; handle: string; display_name: string; role: string; faceit_level: number | null; faceit_elo: number | null }
interface DemoClip { id: string; title: string; map: string; side: string; blob_url: string; status: string; handle: string }

const css: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 1100, margin: '0 auto', padding: '16px' },
  bar: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #2a2a2a' },
  logo: { fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 22, color: '#e4002b', letterSpacing: '.04em' },
  tab: { font: 'inherit', background: 'none', color: '#9a9a9a', border: 'none', borderBottom: '2px solid transparent', padding: '6px 4px', cursor: 'pointer', fontWeight: 700, textTransform: 'uppercase' },
  tabOn: { color: '#fff', borderBottomColor: '#e4002b' },
  select: { font: 'inherit', background: '#1b1b1b', color: '#fff', border: '1px solid #2a2a2a', borderRadius: 6, padding: '6px 8px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' },
};

function App() {
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [userId, setUserId] = useState<string>(() => localStorage.getItem('demo_user_id') ?? '');
  const [tab, setTab] = useState<'player' | 'recruiter'>('player');
  const [health, setHealth] = useState<string>('…');

  useEffect(() => {
    fetch('/api/health').then((r) => r.json()).then((h) => setHealth(`db ok · mode ${h.coaching_mode}`), () => setHealth('API down'));
    fetch('/api/sandbox/users').then((r) => r.json()).then(setUsers, () => {});
  }, []);

  const pick = (id: string) => {
    localStorage.setItem('demo_user_id', id);
    setUserId(id);
    const u = users.find((x) => x.id === id);
    setTab(u && u.role !== 'user' ? 'recruiter' : 'player');
  };
  const me = users.find((u) => u.id === userId);

  return (
    <div style={css.wrap}>
      <div style={css.bar}>
        <span style={css.logo}>YAO SANDBOX</span>
        <button style={{ ...css.tab, ...(tab === 'player' ? css.tabOn : {}) }} onClick={() => setTab('player')}>Clip report</button>
        <button style={{ ...css.tab, ...(tab === 'recruiter' ? css.tabOn : {}) }} onClick={() => setTab('recruiter')}>Recruiter</button>
        <span style={{ flex: 1 }} />
        <select style={css.select} value={userId} onChange={(e) => pick(e.target.value)}>
          <option value="">Demo login…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.display_name} ({u.role}{u.faceit_level ? ` · L${u.faceit_level}` : ''})</option>
          ))}
        </select>
        <small style={{ color: '#9a9a9a' }}>{health}</small>
      </div>
      {tab === 'player' ? <PlayerTab user={me} /> : <RecruiterDashboard key={userId} />}
    </div>
  );
}

function PlayerTab({ user }: { user?: DemoUser }) {
  const [clips, setClips] = useState<DemoClip[]>([]);
  const [clipId, setClipId] = useState<string>('');
  const [progress, setProgress] = useState<ScoutProgress | null>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!user || user.role !== 'user') return;
    fetch(`/api/sandbox/clips?userId=${user.id}`).then((r) => r.json()).then((c: DemoClip[]) => {
      setClips(c);
      setClipId(c[0]?.id ?? '');
    });
    getScoutProgress(user.id).then(setProgress, () => setProgress(null));
  }, [user]);

  if (!user) return <p>Pick a demo login (try <b>Vyper</b> for the live threshold demo).</p>;
  if (user.role !== 'user') return <p>Staff account: open the Recruiter tab.</p>;
  const clip = clips.find((c) => c.id === clipId);
  const p = progress?.primary;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {p && (
        <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 10, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#9a9a9a' }}>
            <span>SCOUT PROGRESS (Omar's profile bar reads this endpoint)</span>
            <span>{p.pass ? 'THRESHOLD CROSSED' : `${Math.round(p.progress * 100)}%`}</span>
          </div>
          <div style={{ height: 8, background: '#1b1b1b', borderRadius: 4, marginTop: 6 }}>
            <div style={{ height: '100%', width: `${p.progress * 100}%`, background: '#e4002b', borderRadius: 4, transition: 'width .6s' }} />
          </div>
          <div style={{ fontSize: 12, color: '#9a9a9a', marginTop: 6 }}>
            {p.criteria.filter((c) => !c.pass).map((c) => `${c.label}: ${c.actual ?? '—'} / ${c.value}`).join(' · ') || 'All criteria met'}
          </div>
        </div>
      )}
      <select style={css.select} value={clipId} onChange={(e) => setClipId(e.target.value)}>
        {clips.map((c) => <option key={c.id} value={c.id}>{c.title} · {c.map} · {c.status}</option>)}
      </select>
      {clip && (
        <div style={css.grid}>
          <video ref={video} src={clip.blob_url.replace(/^https?:\/\/localhost:\d+/, '')} controls style={{ width: '100%', background: '#000', borderRadius: 10, aspectRatio: '16/9' }} />
          <CoachingReportPanel
            clipId={clip.id}
            onSeek={(s) => { if (video.current) { video.current.currentTime = s; video.current.play().catch(() => {}); } }}
            onAnalyzed={() => getScoutProgress(user.id).then(setProgress)}
          />
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
