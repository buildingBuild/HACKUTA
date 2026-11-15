import { useEffect, useState } from 'react';
import type { CommunityApi } from './api';
import type { Pulse } from './types';
import './pulse.css';
const excerpt=(text:string)=>text.replace(/^#[^\n]+\n\n/,'').replace(/^DEMO (?:DISCUSSION|EVENT|CHALLENGE) · /,'Sample · ');
function usePulse(api:CommunityApi,retry=0){
  const [pulse,setPulse]=useState<Pulse>(),[error,setError]=useState('');
  useEffect(()=>{let live=true;setError('');setPulse(undefined);api.pulse().then(r=>{if(live)setPulse(r.data);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[api,retry]);
  return {pulse,error};
}
export function PulsePreview({api,open}:{api:CommunityApi;open:()=>void}){
  const {pulse,error}=usePulse(api);
  return <section className="cq-pulse-preview" aria-label="FaZe Pulse preview"><div className="cq-pulse-preview-heading"><div><span className="cq-pulse-mark">FZ / PULSE</span><h2>This week in the HQ.</h2></div><button onClick={open}>Full recap ↗</button></div>
    {pulse?<><div className="cq-pulse-preview-links">{pulse.highlights.slice(0,2).map((h,i)=><a key={h.thread_id} href={`/community?thread=${encodeURIComponent(h.thread_id)}`}><span>0{i+1}</span><div><strong>{h.title}</strong><small>{h.topic} · {h.comment_count} comments</small></div></a>)}</div>{!pulse.highlights.length&&<p>No recent conversations yet.</p>}<small className="cq-pulse-attribution">{pulse.provider==='curated'?'Curated selection':'Community activity recap'} · Last {pulse.window_days} days</small></>:<p className="cq-pulse-preview-status">{error?'Recap unavailable. Open to retry.':'Reading the latest conversations…'}</p>}
  </section>;
}
export function PulseView({ api }: { api: CommunityApi }) {
  const [retry,setRetry]=useState(0);
  const {pulse,error}=usePulse(api,retry);
  const lead=pulse?.highlights[0];
  return <section className="cq-pulse cq-pulse-editorial"><a href="/community" className="cq-back">← Discussions</a><header className="cq-pulse-masthead"><span className="cq-pulse-mark">FZ / PULSE</span><h2>This Week in FaZe</h2>{pulse&&<div><span>{pulse.provider==='curated'?'Curated recap':'Community activity recap'}</span><time dateTime={pulse.generated_at}>{new Date(pulse.generated_at).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</time></div>}</header>
    {error&&<p role="alert">{error} <button onClick={()=>setRetry(n=>n+1)}>Retry</button></p>}
    {!pulse&&!error&&<p role="status">Loading recap…</p>}
    {pulse&&<>{lead?<article className="cq-pulse-main-story"><span className="cq-eyebrow">In focus / {lead.topic}</span><h3><a href={`/community?thread=${encodeURIComponent(lead.thread_id)}`}>{lead.title} ↗</a></h3><p>{excerpt(lead.description)}</p><small>{lead.comment_count} comments · {lead.score} score</small></article>:<p>No recent discussions yet.</p>}
      {pulse.highlights.length>1&&<section className="cq-pulse-conversations"><h3>Trending conversations</h3><ol>{pulse.highlights.slice(1).map(h=><li key={h.thread_id}><span>{h.topic}</span><a href={`/community?thread=${encodeURIComponent(h.thread_id)}`}>{h.title} ↗</a><small>{h.comment_count} comments · {h.score} score</small></li>)}</ol></section>}
      <section className="cq-pulse-debate"><h3>From the conversation</h3>{pulse.perspectives.length?pulse.perspectives.map(p=><blockquote key={p.comment_id}><p>“{p.excerpt}”</p><footer><span>@{p.author}</span><a href={`/community?thread=${encodeURIComponent(p.thread_id)}`}>Original discussion ↗</a></footer></blockquote>):<p>No comments to recap yet.</p>}</section>
      {pulse.question&&<aside className="cq-pulse-question"><span className="cq-eyebrow">Your take</span><h3>{pulse.question.text}</h3><a href={`/community?thread=${encodeURIComponent(pulse.question.thread_id)}`}>Join the discussion →</a></aside>}
      <details className="cq-pulse-method"><summary>About this recap</summary><p>{pulse.overview} Highlights are ranked from retrieved activity; excerpts represent individual fans.</p></details>
    </>}
  </section>;
}
