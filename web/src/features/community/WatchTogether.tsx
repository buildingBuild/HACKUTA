import { useEffect, useState, useRef } from 'react';
import type { CommunityApi } from './api';
import type { WatchRoom, Comment, User } from './types';
import { mediaEmbed } from './media';
import arenaImage from './assets/arena.svg';
import './watch-together.css';
const categories=['All','Esports','Podcasts & Commentary','FaZe Legacy','Community'];
const threadLink=(id:string)=>`/community?thread=${encodeURIComponent(id)}`;
function Poster({ room }: { room: WatchRoom }) {
  const media=mediaEmbed(room.media_url,'localhost');
  const id=media?.provider==='YouTube'?new URL(media.original).searchParams.get('v'):null;
  return <img src={id?`https://i.ytimg.com/vi/${id}/hqdefault.jpg`:arenaImage} alt="" loading="lazy" onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src=arenaImage;}} />;
}
export function WatchTogether({api,user,roomId}:{api:CommunityApi;user?:User;roomId?:string}) {
  const [rooms,setRooms]=useState<WatchRoom[]>([]),[category,setCategory]=useState('All'),[error,setError]=useState('');
  useEffect(()=>{let live=true;api.rooms().then(r=>{if(live)setRooms(r.data);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[api]);
  if(roomId) return <WatchRoomView key={`${roomId}:${user?.id}`} api={api} user={user} id={roomId}/>;
  const visible=rooms.filter(r=>category==='All'||r.category===category);
  const [featured, ...more] = visible;
  return <div className="cq-watch-home">
    <div className="cq-topic-filters cq-watch-filters" aria-label="Watch categories">{categories.map(value=><button key={value} aria-pressed={category===value} onClick={()=>setCategory(value)}>{value==='Podcasts & Commentary'?'Podcasts':value}</button>)}</div>
    {error&&<p role="alert">{error}</p>}{!rooms.length&&!error&&<p role="status">Loading rooms…</p>}
    {featured&&<article className="cq-watch-hero"><a href={`/community?watch=${featured.id}`} className="cq-watch-hero-image" aria-label={`Watch ${featured.title}`}><Poster room={featured}/><span className="cq-watch-play" aria-hidden="true">▶</span></a><div className="cq-watch-hero-copy"><span className="cq-watch-status">{featured.status} / {featured.category}</span><h2><a href={`/community?watch=${featured.id}`}>{featured.title}</a></h2><p>{featured.source}</p>{featured.scheduled_at&&<time dateTime={featured.scheduled_at}>{new Date(featured.scheduled_at).toLocaleString()}</time>}<a className="cq-primary" href={`/community?watch=${featured.id}`}>{featured.media_url?'Watch together':'Enter room'} <span aria-hidden="true">→</span></a></div></article>}
    <div className="cq-watch-discovery">{more.map(room=><article key={room.id} className="cq-watch-tile"><a href={`/community?watch=${room.id}`} className="cq-watch-poster" aria-label={`Open ${room.title}`}><Poster room={room}/><span>{room.status}</span><b className="cq-watch-play" aria-hidden="true">▶</b></a><div className="cq-watch-card-meta">{room.category}</div><h3><a href={`/community?watch=${room.id}`}>{room.title}</a></h3><small>{room.source}</small>{room.scheduled_at&&<time dateTime={room.scheduled_at}>{new Date(room.scheduled_at).toLocaleString()}</time>}</article>)}</div>
    {!visible.length&&rooms.length>0&&<p>No rooms in this category yet.</p>}
  </div>;
}
function WatchRoomView({api,user,id}:{api:CommunityApi;user?:User;id:string}) {
  const [room,setRoom]=useState<WatchRoom>(),[comments,setComments]=useState<Comment[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[body,setBody]=useState(''),[question,setQuestion]=useState(''),[notice,setNotice]=useState(''),[playerHidden,setPlayerHidden]=useState(false);
  const mutationEpoch=useRef(0);
  const [selectedTab,setSelectedTab]=useState<string>();
  const historyRef=useRef<HTMLDivElement>(null);
  const followChat=useRef(true);
  useEffect(()=>{const el=historyRef.current;if(el&&followChat.current)el.scrollTop=el.scrollHeight;},[comments]);
  useEffect(()=>{let live=true;let inFlight=false;const update=async()=>{if(inFlight)return;inFlight=true;const version=mutationEpoch.current;try{const r=await api.room(id);const c=await api.comments(r.data.thread_id);if(live&&version===mutationEpoch.current){setRoom(r.data);setComments(c.data);setError('');}}catch(e){if(live)setError(e instanceof Error?e.message:'Room unavailable');}finally{inFlight=false;}};void update();const timer=setInterval(()=>void update(),12000);return()=>{live=false;clearInterval(timer);};},[api,id]);
  const mutate=async(action:()=>Promise<void>)=>{if(busy)return;mutationEpoch.current++;setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Please retry');}finally{mutationEpoch.current++;setBusy(false);}};
  const post=async(text:string,isQuestion:boolean)=>{if(!room)return;if(!text.trim()){setError('Write a message or question first.');return;}await mutate(async()=>{const r=await api.comment(room.thread_id,{body:(isQuestion?'[Question] ':'')+text,parent_id:null,clip_id:null});setComments(old=>old.some(c=>c.id===r.data.id)?old:[...old,r.data]);if(isQuestion)setQuestion('');else {followChat.current=true;setBody('');}});};
  if(!room)return <><a href="/community?view=watch">← Watch Together</a><p role={error?'alert':'status'}>{error||'Opening the room…'}</p></>;
  const embed=mediaEmbed(room.media_url,window.location.hostname);
  const questions=comments.filter(c=>c.body.startsWith('[Question] ')).sort((a,b)=>b.score-a.score||Date.parse(a.created_at)-Date.parse(b.created_at));
  const messages=comments.filter(c=>!c.body.startsWith('[Question] '));
  const podcast=room.category==='Podcasts & Commentary';
  const tabs=[...(podcast?['Fan questions']:[]),...(room.poll_result?['Polls']:[]),'Discussion'];
  const activeTab=selectedTab&&tabs.includes(selectedTab)?selectedTab:tabs[0];
  const tabId=(tab:string)=>`watch-${id}-${tab.replaceAll(' ','-')}`;
  return <div className="cq-room">
    <a className="cq-back" href="/community?view=watch">← All rooms</a>
    <header className="cq-room-heading"><div><div className="cq-room-source"><span className="cq-watch-status">{room.status}</span><span>{room.category}</span><span>{room.source}</span></div><h2>{room.title}</h2></div><button className="cq-room-share" disabled={busy} onClick={()=>void mutate(async()=>{const url=new URL('/community',location.origin);url.searchParams.set('watch',room.id);try{await navigator.clipboard.writeText(url.href);setNotice('Room link copied');}catch{setNotice(url.href);}})}>Share room ↗</button></header>
    {error&&<p role="alert" className="cq-error">{error}</p>}{notice&&<p role="status" className="cq-room-notice">{notice}</p>}
    <div className="cq-room-layout"><div className="cq-room-viewer"><div className="cq-player">{embed&&!playerHidden?<iframe title={`${room.title} — ${embed.provider} player`} src={embed.embed} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onError={()=>setPlayerHidden(true)}/>:<div className="cq-player-fallback"><span aria-hidden="true">▶</span><h3>{embed?'Playback unavailable':'The room is open.'}</h3><p>{embed?'Use the original source below to watch.':'Sample room · video selection pending'}</p></div>}</div></div>
    <div className="cq-chat-slot"><section className="cq-room-conversation" aria-label="Room conversation"><header><h3>Fan chat</h3><span title="Messages update every 12 seconds">Room conversation</span></header><div className="cq-room-messages" ref={historyRef} onScroll={e=>{const el=e.currentTarget;followChat.current=el.scrollHeight-el.scrollTop-el.clientHeight<48;}} role="log" aria-label="Chat messages" aria-live="polite" aria-relevant="additions">{messages.length?messages.map(c=><article key={c.id}><div className="cq-chat-meta"><strong>@{c.author.handle}</strong><time dateTime={c.created_at}>{new Date(c.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</time></div><p>{c.body}</p></article>):<div className="cq-chat-empty"><strong>First in the conversation.</strong><p>Drop a thought. Make yourself at home.</p></div>}</div><form className="cq-room-composer" onSubmit={e=>{e.preventDefault();void post(body,false);}}><textarea aria-label="Room message" placeholder={user?'Say something…':'Choose a demo account to chat'} required maxLength={4000} rows={2} value={body} disabled={!user||busy} onChange={e=>setBody(e.target.value)}/><div><small>{user?`@${user.handle}`:'Sign in above to join'}</small><button className="cq-primary" disabled={!user||busy||!body.trim()}>{busy?'Sending…':'Send message'} <span aria-hidden="true">↑</span></button></div></form></section></div></div>
    <div className="cq-room-secondary"><div className="cq-room-source-actions">{embed&&<a href={embed.original} target="_blank" rel="noopener noreferrer">Open original media ↗</a>}{embed&&<button onClick={()=>setPlayerHidden(v=>!v)}>{playerHidden?'Retry player':'Player not working?'}</button>}<span>Independent playback</span></div>
    <div className="cq-room-tabs" role="tablist" aria-label="Room interactions">{tabs.map(tab=><button key={tab} role="tab" id={tabId(tab)} aria-controls={tabId(tab)+'-panel'} aria-selected={activeTab===tab} tabIndex={activeTab===tab?0:-1} onClick={()=>setSelectedTab(tab)} onKeyDown={e=>{const index=tabs.indexOf(tab);const next=e.key==='ArrowRight'?(index+1)%tabs.length:e.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:-1;if(next<0)return;e.preventDefault();setSelectedTab(tabs[next]);(e.currentTarget.parentElement?.children[next] as HTMLElement)?.focus();}}>{tab}{tab==='Fan questions'&&questions.length>0&&<span>{questions.length}</span>}</button>)}</div>
    <section className="cq-room-tab-content" role="tabpanel" id={tabId(activeTab)+'-panel'} aria-labelledby={tabId(activeTab)} tabIndex={0}>
    {activeTab==='Discussion'&&<div className="cq-room-discussion"><h3>Keep the conversation going.</h3><p>{room.description}</p>{room.category==='FaZe Legacy'&&<a href="/community?topic=Challenges">Related challenge →</a>}<small>Chat is saved in this room’s linked thread.</small></div>}
    {activeTab==='Polls'&&room.poll_result&&<form className="cq-room-poll" onSubmit={e=>e.preventDefault()}><h3>{room.poll_result.question}</h3><div className="cq-poll-options">{room.poll_result.options.map((option,index)=><button type="button" key={option.label} disabled={!user||busy} aria-pressed={room.poll_result?.selection===index} onClick={()=>void mutate(async()=>{const r=await api.poll(room.id,index);setRoom(old=>old?{...old,poll_result:r.data}:old);})}><span>{option.label}</span><strong>{option.votes}</strong></button>)}</div><small>{room.poll_result.total} voters</small></form>}
    {activeTab==='Fan questions'&&<section className="cq-room-questions"><div className="cq-question-intro"><h3>Ask the room.</h3><small>Fan discussion · questions are not sent to the guests.</small></div><form className="cq-form" onSubmit={e=>{e.preventDefault();void post(question,true);}}><textarea aria-label="Your question" placeholder="What would you ask?" required maxLength={3900} disabled={!user||busy} rows={2} value={question} onChange={e=>setQuestion(e.target.value)}/><button className="cq-primary" disabled={!user||busy||!question.trim()}>Submit question →</button></form>{questions.length?questions.map(c=><article key={c.id}><div><p>{c.body.slice(11)}</p><small>@{c.author.handle}</small></div><button disabled={!user||busy} aria-label={`Upvote question by ${c.author.handle}`} aria-pressed={c.viewer_vote===1} onClick={()=>void mutate(async()=>{const r=await api.vote('comment',c.id,c.viewer_vote===1?0:1);setComments(old=>old.map(v=>v.id===c.id?{...v,...r.data}:v));})}>▲ {c.score}</button></article>):<p className="cq-question-empty">Start with a question worth discussing.</p>}</section>}
    </section><a className="cq-room-thread-link" href={threadLink(room.thread_id)}>Full discussion ↗</a></div>
  </div>;
}
