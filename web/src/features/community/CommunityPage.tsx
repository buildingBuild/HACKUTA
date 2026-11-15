import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createCommunityApi } from './api';
import type { Clip, Comment, Community, Sort, Thread, User } from './types';
import './community.css';

export interface CommunityPageProps {
  currentUser?: User;
  /** Pass Joe's existing clip records; no upload or alternative identity picker is created. */
  clips?: Clip[];
  apiBase?: string;
  initialBoard?: string;
  initialClipId?: string;
}
function time(value: string) { return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function Video({ clip }: { clip?: Clip | null }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [clip?.blob_url]);
  const safe = clip && /^https?:\/\//i.test(clip.blob_url);
  if (!clip) return null;
  return <div className="cq-clip">{safe && !failed ? <video controls preload="metadata" src={clip.blob_url} aria-label={clip.title} onError={() => setFailed(true)} /> : <p>Clip playback unavailable. Open this clip in the clip feed.</p>}<small>{clip.title}</small></div>;
}
function Avatar({ user }: { user: User }) {
  return <span className="cq-avatar" aria-hidden="true">{(user.display_name || user.handle).slice(0, 2).toUpperCase()}</span>;
}
function Votes({ score, value, disabled, onVote }: { score: number; value: number; disabled: boolean; onVote: (v: number) => void }) {
  return <div className="cq-votes" aria-label="Voting"><button type="button" disabled={disabled} aria-label="Upvote" aria-pressed={value === 1} onClick={() => onVote(value === 1 ? 0 : 1)}>▲</button><strong aria-live="polite">{score}</strong><button type="button" disabled={disabled} aria-label="Downvote" aria-pressed={value === -1} onClick={() => onVote(value === -1 ? 0 : -1)}>▼</button></div>;
}
export default function CommunityPage({ currentUser, clips = [], apiBase = '/api', initialBoard = 'faze-cs2', initialClipId = '' }: CommunityPageProps) {
  const api = useMemo(() => createCommunityApi(currentUser?.id, apiBase), [currentUser?.id, apiBase]);
  const [boards, setBoards] = useState<Community[]>([]);
  const [slug, setSlug] = useState(initialBoard);
  const [sort, setSort] = useState<Sort>('hot');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<Thread | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [mode, setMode] = useState<'demo' | 'database'>();
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [composer, setComposer] = useState(Boolean(initialClipId));
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [clipId, setClipId] = useState(initialClipId);
  const [kind, setKind] = useState<'post' | 'challenge'>('post');
  const [reply, setReply] = useState('');
  const [replyClip, setReplyClip] = useState('');
  const [parent, setParent] = useState<string | null>(null);
  const [report, setReport] = useState<{ type: 'thread' | 'comment'; id: string } | null>(null);
  const [reason, setReason] = useState('');
  const availableClips = clips.filter(c => c.user_id === currentUser?.id && c.game === 'cs2');
  const board = boards.find(b => b.slug === slug);
  useEffect(() => { let live = true; api.boards().then(r => { if (live) { setBoards(r.data); setMode(r.mode); } }).catch(e => { if (live) setError(String(e.message)); }); return () => { live = false; }; }, [api, revision]);
  useEffect(() => {
    let live = true; setLoading(true); setError(''); setActive(null); setComments([]); setParent(null); setReply(''); setReplyClip('');
    api.threads(slug, sort).then(r => { if (live) { setThreads(r.data); setMode(r.mode); } }).catch(e => { if (live) setError(String(e.message)); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [api, slug, sort, revision]);
  useEffect(() => {
    if (!active) return;
    let live = true; setCommentsLoading(true); setComments([]); setParent(null); setReply(''); setReplyClip('');
    api.comments(active.id).then(r => { if (live) { setComments(r.data); setMode(r.mode); } }).catch(e => { if (live) setError(String(e.message)); }).finally(() => { if (live) setCommentsLoading(false); });
    return () => { live = false; };
  }, [active?.id, api]);
  async function perform(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again'); } finally { setBusy(false); }
  }
  async function vote(target: 'thread' | 'comment', id: string, value: number) {
    await perform(async () => {
      const r = await api.vote(target, id, value);
      if (target === 'thread') { setThreads(old => old.map(t => t.id === id ? { ...t, ...r.data } : t)); setActive(old => old?.id === id ? { ...old, ...r.data } : old); }
      else setComments(old => old.map(c => c.id === id ? { ...c, ...r.data } : c));
    });
  }
  function clipSelect(value: string, onChange: (value: string) => void, label: string) {
    return <label>{label}<select value={value} onChange={e => onChange(e.target.value)}><option value="">No clip attached</option>{availableClips.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select>{availableClips.length === 0 && <small>Upload a CS2 clip in the clip module first.</small>}</label>;
  }
  function renderComment(comment: Comment, depth = 0): ReactNode {
    return <div className="cq-comment" key={comment.id}>
      <div className="cq-meta"><Avatar user={comment.author} /><strong>{comment.author.display_name}</strong><time dateTime={comment.created_at}>{time(comment.created_at)}</time></div>
      <p className="cq-body">{comment.body}</p><Video clip={comment.clip} />
      <div className="cq-actions"><Votes score={comment.score} value={comment.viewer_vote} disabled={busy || !currentUser} onVote={v => { void vote('comment', comment.id, v); }} /><button disabled={!currentUser || busy} onClick={() => { setParent(comment.id); setReplyClip(''); }}>Reply</button><button disabled={!currentUser || busy} onClick={() => setReport({ type: 'comment', id: comment.id })}>Report</button></div>
      {depth < 20 && comments.filter(c => c.parent_id === comment.id).map(c => renderComment(c, depth + 1))}
      {depth === 20 && comments.some(c => c.parent_id === comment.id) && <small>Further replies are hidden at this depth.</small>}
    </div>;
  }
  return <section className="cq" aria-label="FaZe HQ community">
    <header className="cq-header"><div><span className="cq-eyebrow">FAZE HQ / COMMUNITY</span><h1>Find your people.</h1><p>Good rounds. Great stories. One global CS2 community.</p></div><span className="cq-badge">FAN-BUILT · CS2</span></header>
    {mode === 'demo' && <div className="cq-banner">DEMO MODE · Seeded discussions. Changes live in server memory and reset on restart. They are not saved to TigerData.</div>}
    {!currentUser && <div className="cq-banner">Choose an account in the shared login to post, reply, or vote.</div>}
    <div className="cq-layout"><nav className="cq-boards" aria-label="Community boards"><span className="cq-eyebrow">YOUR COMMUNITIES</span>{boards.map((b,i) => <button key={b.id} aria-current={slug === b.slug ? 'page' : undefined} onClick={() => { setSlug(b.slug); setComposer(false); }}><span className="cq-board-icon">{['F','▶','↗','↺','◷'][i] ?? '#'}</span><span>{b.name}<small>{b.description}</small></span></button>)}<p className="cq-fine">A community prototype. No official FaZe, Valve, or FACEIT affiliation.</p></nav>
    <main className="cq-main">
      {error && <div role="alert" className="cq-error">{error} <button onClick={() => setRevision(v => v + 1)}>Reload feed</button></div>}
      {notice && <div role="status" className="cq-banner">{notice}</div>}
      {!active ? <>
        <div className="cq-heading"><div><span className="cq-eyebrow">THE CONVERSATION STARTS HERE</span><h2>{board?.name ?? 'Community'}</h2><p>{board?.description}</p></div><button className="cq-primary" disabled={!currentUser || busy} onClick={() => setComposer(!composer)}>+ Create thread</button></div>
        {slug === 'faze-history' && <aside className="cq-feature"><span className="cq-eyebrow">THE REWIND ROOM</span><h3>Every fan has a first memory.</h3><p>Explore the 2010 origins, the 2016 Counter-Strike chapter, and the 2022 Antwerp win. These demo discussions link to FaZe’s published history; older Counter-Strike moments are historical context.</p></aside>}
        {slug === 'events' && <aside className="cq-feature"><span className="cq-eyebrow">WATCH TOGETHER</span><h3>Different time zones. Same round.</h3><p>Practice pre-match predictions and reactions in clearly marked demo event threads.</p></aside>}
        {composer && <form className="cq-panel cq-form" onSubmit={e => { e.preventDefault(); void perform(async () => { const r = await api.create(slug, { title, body, type: kind, clip_id: clipId || null }); setThreads(old => [r.data, ...old]); setComposer(false); setTitle(''); setBody(''); setClipId(''); setActive(r.data); }); }}>
          <h3>Start a conversation</h3><label>Title<input required maxLength={180} value={title} onChange={e => setTitle(e.target.value)} placeholder="What’s on your mind?" /></label><label>Body<textarea required maxLength={10000} rows={5} value={body} onChange={e => setBody(e.target.value)} placeholder="Give the community something to talk about." /></label>
          <label>Thread type<select value={kind} onChange={e => setKind(e.target.value as typeof kind)}><option value="post">Discussion</option><option value="challenge">Challenge · include instructions in your post</option></select></label>{clipSelect(clipId, setClipId, 'Existing CS2 clip')}
          <div className="cq-actions"><button className="cq-primary" disabled={busy}> {busy ? 'Publishing…' : 'Publish thread'}</button><button type="button" onClick={() => setComposer(false)}>Cancel</button></div>
        </form>}
        <div className="cq-tabs" aria-label="Sort discussions">{(['hot','new','top'] as Sort[]).map(s => <button key={s} aria-pressed={sort === s} onClick={() => setSort(s)}>{s === 'hot' ? '↗ ' : ''}{s[0].toUpperCase() + s.slice(1)}</button>)}<span>{threads.length} discussions</span></div>
        {loading ? <div className="cq-panel" role="status">Loading the conversation…</div> : threads.length === 0 ? <div className="cq-panel">No threads yet. Start the first conversation.</div> : threads.map(t => <article className="cq-post" key={t.id}><Votes score={t.score} value={t.viewer_vote} disabled={busy || !currentUser} onVote={v => { void vote('thread', t.id, v); }} /><div className="cq-post-content"><div className="cq-meta"><Avatar user={t.author} /><strong>{t.author.display_name}</strong><time dateTime={t.created_at}>{time(t.created_at)}</time>{t.type === 'challenge' && <span className="cq-badge">CHALLENGE</span>}</div><h3><button className="cq-title" onClick={() => setActive(t)}>{t.title}</button></h3><p className="cq-excerpt">{t.body}</p><Video clip={t.clip} /><div className="cq-actions"><button onClick={() => setActive(t)}>◯ {t.comment_count} comments</button><button disabled={!currentUser || busy} onClick={() => setReport({ type: 'thread', id: t.id })}>Report</button></div></div></article>)}
      </> : <>
        <button className="cq-back" onClick={() => setActive(null)}>← Back to {board?.name}</button>
        <article className="cq-panel"><div className="cq-meta"><Avatar user={active.author} /><strong>{active.author.display_name}</strong><time dateTime={active.created_at}>{time(active.created_at)}</time></div><h2>{active.title}</h2><p className="cq-body">{active.body}</p><Video clip={active.clip} /><div className="cq-actions"><Votes score={active.score} value={active.viewer_vote} disabled={busy || !currentUser} onVote={v => { void vote('thread', active.id, v); }} /><button disabled={!currentUser || busy} onClick={() => setReport({ type: 'thread', id: active.id })}>Report</button></div></article>
        {active.type === 'challenge' && <aside className="cq-feature"><h3>Challenge standings</h3><p>Community votes only · separate from player leaderboards.</p><ol>{comments.filter(c => !c.parent_id && c.clip_id).sort((a,b) => b.score-a.score || Date.parse(a.created_at)-Date.parse(b.created_at)).map(c => <li key={c.id}>{c.author.display_name} — {c.score} points · {c.clip?.title ?? 'CS2 submission'}</li>)}</ol>{!comments.some(c => !c.parent_id && c.clip_id) && <p>No submissions yet. Set the first score.</p>}</aside>}
        <h3>{comments.length} comments</h3>{commentsLoading ? <p role="status">Loading replies…</p> : comments.filter(c => !c.parent_id).map(c => renderComment(c))}
        <form className="cq-panel cq-form" onSubmit={e => { e.preventDefault(); const tid = active.id; void perform(async () => { const r = await api.comment(tid, { body: reply, parent_id: parent, clip_id: replyClip || null }); setComments(old => [...old, r.data]); setThreads(old => old.map(t => t.id === tid ? { ...t, comment_count: t.comment_count + 1 } : t)); setReply(''); setReplyClip(''); setParent(null); }); }}>
          <h3>{parent ? `Reply to ${comments.find(c => c.id === parent)?.author.display_name ?? 'comment'}` : active.type === 'challenge' ? 'Submit your clip' : 'Join the conversation'}</h3>{parent && <button type="button" onClick={() => setParent(null)}>Cancel reply</button>}<label>Your comment<textarea required disabled={!currentUser} maxLength={4000} rows={3} value={reply} onChange={e => setReply(e.target.value)} /></label>{clipSelect(replyClip, setReplyClip, 'Existing CS2 clip')}<button className="cq-primary" disabled={!currentUser || busy || commentsLoading}>{busy ? 'Posting…' : 'Post comment'}</button>
        </form>
      </>}
    </main><aside className="cq-sidebar"><div className="cq-panel"><span className="cq-eyebrow">WELCOME TO THE HQ</span><h3>Make the next round better.</h3><p>Share a clutch. Help a teammate. Discover someone new.</p><hr /><h4>Community playbook</h4><p>01 &nbsp; Respect the person behind the handle.</p><p>02 &nbsp; Keep it CS2. Credit creators.</p><p>03 &nbsp; Give useful feedback, not abuse.</p><p>04 &nbsp; Report harmful content.</p></div><div className="cq-feature"><span className="cq-eyebrow">RECREATE THE CLASSIC</span><h3>Your take. Your clip.</h3><p>Open Clips to find the demo one-tap challenge. Submit a clip from your portfolio and let the community vote.</p><button onClick={() => { setSlug('clips'); setActive(null); }}>Explore challenges →</button></div></aside></div>
    {report && <div className="cq-modal"><form role="dialog" aria-modal="true" aria-labelledby="cq-report-title" className="cq-panel cq-form" onSubmit={e => { e.preventDefault(); void perform(async () => { const r = await api.report(report.type, report.id, reason); setNotice(r.data.message); setReport(null); setReason(''); }); }}><h3 id="cq-report-title">Report content</h3><label>Reason<textarea autoFocus required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label><div className="cq-actions"><button className="cq-primary" disabled={busy}>Submit report</button><button type="button" onClick={() => { setReport(null); setReason(''); }}>Cancel</button></div></form></div>}
  </section>;
}
