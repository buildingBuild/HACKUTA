import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createCommunityApi } from './api';
import type { Clip, Comment, Community, Sort, Thread, User } from './types';
import './community.css';
import { WatchTogether } from './WatchTogether';
import { PulseView, PulsePreview } from './PulseView';
import { ClipFeed } from './ClipFeed';
import { ClipPlayer } from './ClipPlayer';
import { TOPICS, TOPIC_BOARD, threadTopic, sortThreads, discussionText, type Topic } from './discussions';
import { SECTIONS, EventsSection, AroundSection, type Section } from './CommunitySections';

export interface CommunityPageProps {
  currentUser?: User;
  uploadUrl?: string;
  /** Pass Joe's existing clip records; no upload or alternative identity picker is created. */
  clips?: Clip[];
  apiBase?: string;
  initialBoard?: string;
  initialClipId?: string;
}
function time(value: string) { return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function Video({ clip }: { clip?: Clip | null }) { return clip ? <ClipPlayer clip={clip}/> : null; }
function Avatar({ user }: { user: User }) {
  return <span className="cq-avatar" aria-hidden="true">{(user.display_name || user.handle).slice(0, 2).toUpperCase()}</span>;
}
function Votes({ score, value, disabled, onVote }: { score: number; value: number; disabled: boolean; onVote: (v: number) => void }) {
  return <div className="cq-votes" aria-label="Voting"><button type="button" disabled={disabled} aria-label="Upvote" aria-pressed={value === 1} onClick={() => onVote(value === 1 ? 0 : 1)}>▲</button><strong aria-live="polite">{score}</strong><button type="button" disabled={disabled} aria-label="Downvote" aria-pressed={value === -1} onClick={() => onVote(value === -1 ? 0 : -1)}>▼</button></div>;
}
export default function CommunityPage({ currentUser, clips = [], apiBase = '/api', initialBoard = 'faze-cs2', initialClipId = '', uploadUrl }: CommunityPageProps) {
  const api = useMemo(() => createCommunityApi(currentUser?.id, apiBase), [currentUser?.id, apiBase]);
  const [boards, setBoards] = useState<Community[]>([]);
  const [section, setSection] = useState<Section>(new URLSearchParams(location.search).has('watch') || new URLSearchParams(location.search).get('view') === 'watch' ? 'Watch Together' : new URLSearchParams(location.search).get('view') === 'clips' ? 'Clips' : 'Discussions');
  const [filter, setFilter] = useState<Topic | 'All'>(new URLSearchParams(location.search).get('topic') === 'Challenges' ? 'Challenges' : 'All');
  const [topic, setTopic] = useState<Topic>(TOPICS.find(t => TOPIC_BOARD[t] === initialBoard) ?? 'General');
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
  const [composer, setComposer] = useState(Boolean(initialClipId) && new URLSearchParams(location.search).get('view') !== 'clips');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [clipId, setClipId] = useState(initialClipId);
  const [kind, setKind] = useState<'post' | 'challenge'>('post');
  const [reply, setReply] = useState('');
  const [replyClip, setReplyClip] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [parent, setParent] = useState<string | null>(null);
  const [report, setReport] = useState<{ type: 'thread' | 'comment'; id: string } | null>(null);
  const [reason, setReason] = useState('');
  const initialThread = new URLSearchParams(location.search).get('thread');
  const roomId = new URLSearchParams(location.search).get('watch') || undefined;
  const [pulseOpen,setPulseOpen] = useState(new URLSearchParams(location.search).has('pulse'));
  useEffect(()=>{if(!initialThread)return;let live=true;api.thread(initialThread).then(r=>{if(live)setActive(r.data);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[api,initialThread]);
  const availableClips = clips.filter(c => c.user_id === currentUser?.id && c.game === 'cs2');
  // Thread state holds the last explicitly sorted snapshot. Votes update rows in place.
  const visibleThreads = threads.filter(t => filter === 'All' || (filter === 'Challenges' ? t.type === 'challenge' : threadTopic(t, boards) === filter));
  useEffect(() => {
    let live = true; setLoading(true); setError('');
    api.boards().then(async result => {
      const feeds = await Promise.all(result.data.map(b => api.threads(b.slug, sort)));
      if (live) { setBoards(result.data); setThreads(sortThreads(feeds.flatMap(f => f.data), sort)); setMode(result.mode); }
    }).catch(e => { if (live) setError(String(e.message)); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [api, sort, revision]);
  useEffect(() => {
    setEditorOpen(false); setParent(null); setReply(''); setReplyClip('');
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
  function openEditor(parentId: string | null) {
    setParent(parentId); setReply(''); setReplyClip(''); setEditorOpen(true);
  }
  function closeEditor() {
    setEditorOpen(false); setParent(null); setReply(''); setReplyClip('');
  }
  function commentEditor(parentId: string | null) {
    if (!active) return null;
    const tid = active.id;
    return <form className="cq-form cq-comment-editor" aria-label={parentId ? 'Reply editor' : 'Comment editor'} onSubmit={e => {
      e.preventDefault();
      void perform(async () => {
        const r = await api.comment(tid, { body: reply, parent_id: parentId, clip_id: replyClip || null });
        setComments(old => [...old, r.data]);
        setThreads(old => old.map(t => t.id === tid ? { ...t, comment_count: t.comment_count + 1 } : t));
        closeEditor();
      });
    }}>
      <label>{parentId ? 'Your reply' : active.type === 'challenge' ? 'Your submission' : 'Your comment'}<textarea autoFocus required disabled={busy} maxLength={4000} rows={3} value={reply} onChange={e => setReply(e.target.value)} /></label>
      <fieldset disabled={busy}>{clipSelect(replyClip, setReplyClip, 'Existing CS2 clip')}</fieldset>
      <div className="cq-actions"><button className="cq-primary" disabled={busy || commentsLoading || !currentUser}>{busy ? 'Posting…' : 'Submit'}</button><button type="button" disabled={busy} onClick={closeEditor}>Cancel</button></div>
    </form>;
  }
  function renderComment(comment: Comment, depth = 0): ReactNode {
    return <div className="cq-comment" key={comment.id}>
      <div className="cq-meta"><Avatar user={comment.author} /><strong>{comment.author.display_name}</strong><time dateTime={comment.created_at}>{time(comment.created_at)}</time></div>
      <p className="cq-body">{comment.body}</p><Video clip={comment.clip} />
      <div className="cq-actions"><Votes score={comment.score} value={comment.viewer_vote} disabled={busy || !currentUser} onVote={v => { void vote('comment', comment.id, v); }} /><button disabled={!currentUser || busy} aria-expanded={editorOpen && parent === comment.id} onClick={() => openEditor(comment.id)}>Reply</button><button disabled={!currentUser || busy} onClick={() => setReport({ type: 'comment', id: comment.id })}>Report</button></div>
      {editorOpen && parent === comment.id && commentEditor(comment.id)}
      {depth < 20 && comments.filter(c => c.parent_id === comment.id).map(c => renderComment(c, depth + 1))}
      {depth === 20 && comments.some(c => c.parent_id === comment.id) && <small>Further replies are hidden at this depth.</small>}
    </div>;
  }
  return <section className="cq" aria-label="FaZe HQ community">
    <header className="cq-header"><h1>Find your people.</h1>{mode === 'demo' && <details className="cq-demo-info"><summary>Demo Mode ⓘ</summary><p>Seeded discussions. Changes live in server memory and reset on restart; they are not saved to TigerData.</p></details>}</header>
    {!currentUser && <div className="cq-banner">Choose an account in the shared login to post, reply, or vote.</div>}
    <nav className="cq-section-tabs" aria-label="Community sections">{SECTIONS.map(name => <button key={name} disabled={busy} aria-current={section === name ? 'page' : undefined} onClick={() => { setSection(name); setPulseOpen(false); window.history.replaceState(null,'','/community'); setActive(null); setComposer(false); }}>{name}</button>)}</nav>
    <div className="cq-layout">
    <main className="cq-main">
      {error && <div role="alert" className="cq-error">{error} <button onClick={() => setRevision(v => v + 1)}>Reload feed</button></div>}
      {notice && <div role="status" className="cq-banner">{notice}</div>}
      {section === 'Watch Together' ? <WatchTogether api={api} user={currentUser} roomId={roomId} /> : pulseOpen ? <PulseView api={api}/> : section === 'Clips' ? <ClipFeed clips={clips} user={currentUser} api={api} uploadUrl={uploadUrl} onThreadChanged={thread => { setThreads(old => old.some(t => t.id === thread.id) ? old.map(t => t.id === thread.id ? thread : t) : [thread,...old]); }} /> : section === 'Events & Drops' ? <EventsSection discuss={challenge => { setSection('Discussions'); setPulseOpen(false); window.history.replaceState(null,'','/community'); setFilter(challenge ? 'Challenges' : 'All'); setActive(null); }} /> : !active ? <>
        <PulsePreview api={api} open={()=>{setPulseOpen(true);window.history.replaceState(null,'','/community?pulse=1');}}/>
        <div className="cq-filter-bar"><div className="cq-filter-heading"><div className="cq-topic-filters" aria-label="Filter discussions by topic">{(['All', ...TOPICS] as const).map(t => <button key={t} aria-pressed={filter === t} onClick={() => setFilter(t)}>{t === 'All' ? 'All topics' : `#${t}`}</button>)}</div><button className="cq-primary cq-create-thread" disabled={!currentUser || busy} aria-expanded={composer} onClick={() => setComposer(!composer)}>+ Create thread</button></div><div className="cq-tabs" aria-label="Sort discussions">{(['hot','new','top'] as Sort[]).map(s => <button key={s} aria-pressed={sort === s} onClick={() => setSort(s)}>{s === 'hot' ? '↗ ' : ''}{s[0].toUpperCase() + s.slice(1)}</button>)}<span>{visibleThreads.length} discussions</span></div></div>
        {composer && <form className="cq-panel cq-form" onSubmit={e => { e.preventDefault(); void perform(async () => { const r = await api.create(TOPIC_BOARD[topic], { title, body: `#${topic}\n\n${body}`, type: topic === 'Challenges' ? 'challenge' : kind, clip_id: clipId || null }); setThreads(old => [r.data, ...old]); setFilter(threadTopic(r.data, boards)); setComposer(false); setTitle(''); setBody(''); setClipId(''); setActive(r.data); }); }}>
          <h3>Start a conversation</h3><label>Topic<select disabled={busy} value={topic} onChange={e => { const next = e.target.value as Topic; setTopic(next); setKind(next === 'Challenges' ? 'challenge' : 'post'); }}>{TOPICS.map(t => <option key={t}>{t}</option>)}</select></label><label>Title<input required maxLength={180} value={title} onChange={e => setTitle(e.target.value)} placeholder="What’s on your mind?" /></label><label>Body<textarea required maxLength={10000} rows={5} value={body} onChange={e => setBody(e.target.value)} placeholder="Give the community something to talk about." /></label>
          <label>Thread type<select disabled={busy} value={kind} onChange={e => { const next = e.target.value as typeof kind; setKind(next); if (next === 'challenge') setTopic('Challenges'); else if (topic === 'Challenges') setTopic('General'); }}><option value="post">Discussion</option><option value="challenge">Challenge · include instructions in your post</option></select></label>{clipSelect(clipId, setClipId, 'Existing CS2 clip')}
          <div className="cq-actions"><button className="cq-primary" disabled={busy}> {busy ? 'Publishing…' : 'Publish thread'}</button><button type="button" onClick={() => setComposer(false)}>Cancel</button></div>
        </form>}
        {loading ? <div className="cq-panel" role="status">Loading the conversation…</div> : visibleThreads.length === 0 ? <div className="cq-panel">No threads yet. Start the first conversation.</div> : visibleThreads.map(t => <article className="cq-post cq-clickable" key={t.id} onClick={event => { if (!(event.target as HTMLElement).closest('button,a,input,select,textarea,video,.cq-votes,.cq-clip,.cq-social-player')) setActive(t); }}><Votes score={t.score} value={t.viewer_vote} disabled={busy || !currentUser} onVote={v => { void vote('thread', t.id, v); }} /><div className="cq-post-content"><div className="cq-meta"><Avatar user={t.author} /><strong>{t.author.display_name}</strong><time dateTime={t.created_at}>{time(t.created_at)}</time><button className="cq-topic" onClick={() => setFilter(threadTopic(t, boards))}>#{threadTopic(t, boards)}</button>{t.body.startsWith('DEMO ') && <span className="cq-badge">Sample</span>}</div><h3><button className="cq-title" onClick={() => setActive(t)}>{t.title}</button></h3><p className="cq-excerpt">{discussionText(t.body)}</p><Video clip={t.clip} /><div className="cq-actions"><button onClick={() => setActive(t)}>◯ {t.comment_count} comments</button><button disabled={!currentUser || busy} onClick={() => setReport({ type: 'thread', id: t.id })}>Report</button></div></div></article>)}
      </> : <>
        <button className="cq-back" disabled={busy} onClick={() => setActive(null)}>← Back to Discussions</button>
        <article className="cq-detail"><h2>{active.title}</h2><div className="cq-meta"><Avatar user={active.author} /><strong>{active.author.display_name}</strong><time dateTime={active.created_at}>{time(active.created_at)}</time><button className="cq-topic" onClick={() => { setFilter(threadTopic(active, boards)); setActive(null); }}>#{threadTopic(active, boards)}</button></div>{active.id.startsWith('faae0001-') && <a className="cq-room-backlink" href={`/community?watch=${['sydney-replay','question-time','legacy-club','community-screening'][Number(active.id.slice(-1))-1]}`}>Open Watch Together room →</a>}<p className="cq-body">{discussionText(active.body)}</p><Video clip={active.clip} /><div className="cq-actions"><Votes score={active.score} value={active.viewer_vote} disabled={busy || !currentUser} onVote={v => { void vote('thread', active.id, v); }} /><button disabled={!currentUser || busy} onClick={() => setReport({ type: 'thread', id: active.id })}>Report</button></div></article>
        <div className="cq-comment-entry">{editorOpen && parent === null ? commentEditor(null) : <button className="cq-add-comment" disabled={!currentUser || busy || commentsLoading} onClick={() => openEditor(null)}>{active.type === 'challenge' ? 'Add a submission…' : 'Add a comment…'}</button>}</div>
        {active.type === 'challenge' && <aside className="cq-feature"><h3>Challenge standings</h3><ol>{comments.filter(c => !c.parent_id && c.clip_id).sort((a,b) => b.score-a.score || Date.parse(a.created_at)-Date.parse(b.created_at)).map(c => <li key={c.id}>{c.author.display_name} — {c.score} points · {c.clip?.title ?? 'CS2 submission'}</li>)}</ol>{!comments.some(c => !c.parent_id && c.clip_id) && <p>No submissions yet. Set the first score.</p>}</aside>}
        <h3 className="cq-comments-heading">{comments.length} comments</h3>{commentsLoading ? <p role="status">Loading replies…</p> : comments.filter(c => !c.parent_id).map(c => renderComment(c))}

      </>}
    </main><aside className="cq-sidebar"><AroundSection /><section className="cq-feature cq-featured-challenge"><span className="cq-eyebrow">FEATURED CHALLENGE</span><h3>Recreate the Classic</h3><button onClick={() => { setSection('Discussions'); setPulseOpen(false); window.history.replaceState(null,'','/community'); setFilter('Challenges'); setActive(null); }}>View challenge →</button></section></aside></div>
    {report && <div className="cq-modal"><form role="dialog" aria-modal="true" aria-labelledby="cq-report-title" className="cq-panel cq-form" onSubmit={e => { e.preventDefault(); void perform(async () => { const r = await api.report(report.type, report.id, reason); setNotice(r.data.message); setReport(null); setReason(''); }); }}><h3 id="cq-report-title">Report content</h3><label>Reason<textarea autoFocus required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label><div className="cq-actions"><button className="cq-primary" disabled={busy}>Submit report</button><button type="button" onClick={() => { setReport(null); setReason(''); }}>Cancel</button></div></form></div>}
  </section>;
}
