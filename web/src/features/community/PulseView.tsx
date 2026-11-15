import { useEffect, useState } from 'react';
import type { CommunityApi } from './api';
import type { Pulse } from './types';
export function PulseView({ api }: { api: CommunityApi }) {
  const [pulse,setPulse]=useState<Pulse>();
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{let live=true;setError('');api.pulse().then(r=>{if(live)setPulse(r.data);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[api,retry]);
  return <section className="cq-pulse"><a href="/community" className="cq-back">← Discussions</a><div className="cq-heading"><h2>FaZe Pulse</h2>{pulse && <span className="cq-eyebrow">{pulse.provider==='gemini'?'AI-assisted curation':'Data recap · no AI'}</span>}</div>{error && <p role="alert">{error} <button onClick={()=>setRetry(n=>n+1)}>Retry</button></p>}{!pulse&&!error ? <p role="status">Reading the conversation…</p> : pulse && <>
    <header className="cq-pulse-lead"><span className="cq-eyebrow">LAST {pulse.window_days} DAYS</span><h3>{pulse.title}</h3><p>{pulse.overview}</p><div className="cq-topic-filters">{pulse.topics.map(topic=><span className="cq-badge" key={topic}>{topic}</span>)}</div><small>Updated {new Date(pulse.generated_at).toLocaleString()}</small></header>
    <h3>Trending Discussions</h3><p className="cq-fine">Ranked from retrieved activity; not an external trend chart.</p><ol className="cq-pulse-links">{pulse.highlights.map(item=><li key={item.thread_id}><span className="cq-eyebrow">{item.topic}</span><a href={`/community?thread=${item.thread_id}`}>{item.title} ↗</a><p>{item.description}</p><small>{item.comment_count} comments · {item.score} score</small></li>)}</ol>{!pulse.highlights.length&&<p>No recent discussions yet.</p>}
    <h3>What Fans Are Saying</h3>{pulse.perspectives.length ? pulse.perspectives.map(item=><blockquote key={item.comment_id}><p>{item.excerpt}</p><footer>@{item.author} · Individual comment · <a href={`/community?thread=${item.thread_id}`}>Source discussion</a></footer></blockquote>) : <p>No comments to recap yet. Join a discussion to add your perspective.</p>}
    {pulse.question&&<aside className="cq-feature"><span className="cq-eyebrow">COMMUNITY QUESTION</span><h3>{pulse.question.text}</h3><a className="cq-primary" href={`/community?thread=${pulse.question.thread_id}`}>Join the discussion →</a></aside>}
  </>}</section>;
}
