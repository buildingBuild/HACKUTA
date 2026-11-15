import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CommunityApi } from './api';
import type { Clip, Comment, Thread, User } from './types';
import { ClipPlayer } from './ClipPlayer';
import './social-clips.css';

export function ClipFeed({clips,user,api,uploadUrl,onThreadChanged}:{clips:Clip[];user?:User;api:CommunityApi;uploadUrl?:string;onThreadChanged:(thread:Thread)=>void}) {
  const [threads,setThreads]=useState<Record<string,Thread>>({}),[error,setError]=useState('');
  const ids=[...new Set(clips.filter(c=>c.game==='cs2').map(c=>c.id))];
  const key=ids.join(',');
  const sharedClipScrolled=useRef(false);
  useEffect(()=>{const target=new URLSearchParams(location.search).get('clip');if(sharedClipScrolled.current||!target||!ids.includes(target))return;document.getElementById(`clip-${target}`)?.scrollIntoView({block:'start'});sharedClipScrolled.current=true;},[key]);
  useEffect(()=>setThreads({}),[api]);
  useEffect(()=>{let live=true;setError('');api.clipThreads(key?key.split(','):[]).then(r=>{if(live)setThreads(Object.fromEntries(r.data.map(t=>[t.clip_id!,t])));}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[api,key]);
  const update=(thread:Thread)=>{setThreads(old=>({...old,[thread.clip_id!]:thread}));onThreadChanged(thread);};
  return <div className="cq-social-feed"><div className="cq-heading"><h2>Clips</h2><>{uploadUrl?<a className="cq-primary" href={uploadUrl}>Upload clip →</a>:<button className="cq-primary" disabled title="The shared clip uploader is not connected in V3">Upload clip →</button>}</></div>
    {!uploadUrl&&<small className="cq-upload-note">The shared clip uploader is not connected yet.</small>}
    {error&&<p role="alert" className="cq-error">{error}</p>}
    {!ids.length?<p className="cq-social-empty">No CS2 clips yet. Share your first play.</p>:ids.map(id=>{const clip=clips.find(c=>c.id===id)!;return <ClipPost key={`${id}:${user?.id||'guest'}`} clip={clip} thread={threads[id]} user={user} api={api} update={update}/>;})}
  </div>;
}
function ClipPost({clip,thread,user,api,update}:{clip:Clip;thread?:Thread;user?:User;api:CommunityApi;update:(thread:Thread)=>void}) {
  const [open,setOpen]=useState(new URLSearchParams(location.search).get('clip')===clip.id),[comments,setComments]=useState<Comment[]>([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [editor,setEditor]=useState<string|null|undefined>(),[body,setBody]=useState('');
  useEffect(()=>{if(!open||!thread)return;let live=true;setLoading(true);api.comments(thread.id).then(r=>{if(live)setComments(old=>[...r.data,...old.filter(c=>!r.data.some(v=>v.id===c.id))]);}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[open,thread?.id,api]);
  const run=async(action:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Please retry');}finally{setBusy(false);}};
  const ensure=async()=>{if(thread)return thread;const r=await api.clipDiscussion(clip.id);update(r.data);return r.data;};
  const vote=(value:number)=>void run(async()=>{const t=await ensure(),r=await api.vote('thread',t.id,value);update({...t,...r.data});});
  const canParticipate=!!user&&(!!thread||clip.user_id===user.id);
  const name=clip.handle||thread?.author?.handle;
  const begin=(parent:string|null)=>{setBody('');setEditor(parent);};
  const composer=(parent:string|null)=><form className="cq-form cq-social-composer" aria-label={parent?'Clip reply editor':'Clip comment editor'} onSubmit={event=>{event.preventDefault();void run(async()=>{const t=await ensure(),r=await api.comment(t.id,{body,parent_id:parent,clip_id:null});setComments(old=>[...old,r.data]);update({...t,comment_count:t.comment_count+1});setEditor(undefined);setBody('');});}}><textarea aria-label={parent?'Your clip reply':'Your clip comment'} autoFocus required maxLength={4000} rows={2} value={body} onChange={e=>setBody(e.target.value)} disabled={busy}/><div className="cq-actions"><button className="cq-primary" disabled={busy||!body.trim()}>Submit</button><button type="button" disabled={busy} onClick={()=>{setEditor(undefined);setBody('');}}>Cancel</button></div></form>;
  const render=(c:Comment,depth=0):ReactNode=><div className="cq-social-comment" key={c.id}><div className="cq-meta"><a href={`/u/${encodeURIComponent(c.author.handle)}`}>@{c.author.handle}</a><time dateTime={c.created_at}>{new Date(c.created_at).toLocaleDateString()}</time></div><p>{c.body}</p>{c.clip&&<ClipPlayer clip={c.clip}/>}<div className="cq-actions"><button aria-label={`Upvote comment by ${c.author.handle}`} aria-pressed={c.viewer_vote===1} disabled={!user||busy} onClick={()=>void run(async()=>{const r=await api.vote('comment',c.id,c.viewer_vote===1?0:1);setComments(old=>old.map(v=>v.id===c.id?{...v,...r.data}:v));})}>▲ {c.score}</button><button aria-label={`Downvote comment by ${c.author.handle}`} aria-pressed={c.viewer_vote===-1} disabled={!user||busy} onClick={()=>void run(async()=>{const r=await api.vote('comment',c.id,c.viewer_vote===-1?0:-1);setComments(old=>old.map(v=>v.id===c.id?{...v,...r.data}:v));})}>▼</button><button disabled={!user||busy} onClick={()=>begin(c.id)}>Reply</button></div>{editor===c.id&&composer(c.id)}{depth<20&&comments.filter(v=>v.parent_id===c.id).map(v=>render(v,depth+1))}</div>;
  return <article className="cq-social-post" id={`clip-${clip.id}`}>
    <header><h3>{clip.title||'Untitled CS2 clip'}</h3><div className="cq-meta">{name?<a href={`/u/${encodeURIComponent(name)}`}>@{name}</a>:<span>Creator unavailable</span>}<span>#CS2</span>{clip.map&&<span>#{clip.map}</span>}{clip.side&&<span>{clip.side}</span>}</div></header>
    <ClipPlayer clip={clip}/>
    <div className="cq-social-toolbar"><div className="cq-votes" aria-label="Clip voting"><button aria-label="Upvote clip" aria-pressed={thread?.viewer_vote===1} disabled={!canParticipate||busy} onClick={()=>vote(thread?.viewer_vote===1?0:1)}>▲</button>{thread&&<strong aria-live="polite">{thread.score}</strong>}<button aria-label="Downvote clip" aria-pressed={thread?.viewer_vote===-1} disabled={!canParticipate||busy} onClick={()=>vote(thread?.viewer_vote===-1?0:-1)}>▼</button></div><button onClick={()=>setOpen(v=>!v)} aria-expanded={open}>{thread?`${thread.comment_count} comments`:'Comments'}</button><button onClick={()=>void run(async()=>{const url=new URL('/community',location.origin);url.searchParams.set('view','clips');url.searchParams.set('clip',clip.id);try{await navigator.clipboard.writeText(url.href);setNotice('Clip link copied');}catch{setNotice(url.href);}})}>Share ↗</button>{name&&<a href={`/u/${encodeURIComponent(name)}`}>Creator profile ↗</a>}</div>
    {error&&<p role="alert" className="cq-error">{error}</p>}{notice&&<p role="status" className="cq-social-notice">{notice}</p>}
    {open&&<section className="cq-social-comments" aria-label={`Comments on ${clip.title}`}>
      {!thread&&<div className="cq-social-start">{clip.user_id===user?.id?<button className="cq-primary" disabled={busy} onClick={()=>void run(async()=>{await ensure();})}>Start discussion →</button>:<p>The creator hasn’t opened a discussion yet.</p>}</div>}
      {canParticipate&&(editor===null?composer(null):<button className="cq-add-comment" disabled={busy||loading} onClick={()=>begin(null)}>Add a comment…</button>)}
      {loading?<p role="status">Loading comments…</p>:comments.filter(c=>!c.parent_id).map(c=>render(c))}
      {thread&&<a className="cq-social-thread" href={`/community?thread=${encodeURIComponent(thread.id)}`}>Full discussion ↗</a>}
    </section>}
  </article>;
}
