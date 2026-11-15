import { useEffect,useRef,useState } from 'react';
import type {SessionUser} from '../../components/session';
import {Button,Page} from '../../components/ui';
import {sessions,type DemoRequest,type Path} from './catalog';
import {loadContext,loadRequests,fetchQuote,fetchRequests} from './api';
import {GuestCoaching} from './MentorDiscovery';
import {MentorCards} from './MentorCards';
import {SessionRequest} from './SessionRequest';
import {PricingSummary} from './PricingSummary';
import {mentorFor,firstMentor,supports,type Mentor} from './mentors';
import {money,quotePrice,type PriceQuote} from './pricing';
import {readSelection,selectionSearch,type Selection} from './selection';
import './mentorship.css';
const emptyContext:Awaited<ReturnType<typeof loadContext>>={karma:null,mock:false,clips:[],profileError:false,clipsError:false};
export function MentorshipPage({user}:{user:SessionUser|null}){
 const [selection,setSelection]=useState<Selection>(()=>{try{return {...readSelection(location.search||sessionStorage.getItem('faze-mentorship-selection')||''),detail:null};}catch{return {...readSelection(location.search),detail:null};}});
 const [context,setContext]=useState(emptyContext),[history,setHistory]=useState<DemoRequest[]>([]);
 const [serverQuote,setServerQuote]=useState<PriceQuote|null>(null),[quoteStatus,setQuoteStatus]=useState('Validating quote…');
 const [request,setRequest]=useState<PriceQuote|null>(null),[saved,setSaved]=useState<DemoRequest|null>(null);
 const configRef=useRef<HTMLElement>(null),requestRef=useRef<HTMLDivElement>(null);
 const mentor=mentorFor(selection.mentorId)||firstMentor(selection.path,selection.focus);
 const session=sessions.find(s=>s.id===selection.focus)!;
 const quote=serverQuote||quotePrice(selection.hours,context.karma,!!user&&!context.mock&&!context.profileError,mentor.id);
 function update(next:Selection){setSelection({...next,detail:null});setServerQuote(null);setRequest(null);setSaved(null);window.history.replaceState(null,'',location.pathname+selectionSearch({...next,detail:null}));}
 function choosePath(path:Path){const focus=sessions.find(s=>s.path===path)!.id;update({...selection,path,focus,mentorId:firstMentor(path,focus).id});}
 function chooseFocus(id:string){const compatible=supports(mentor,id,selection.path)?mentor:firstMentor(selection.path,id);update({...selection,focus:id,mentorId:compatible.id,hours:compatible.id==='workshop'?2:selection.hours});}
 function chooseMentor(next:Mentor){const focus=supports(next,session.id,selection.path)?session.id:next.sessions[selection.path][0];update({...selection,focus,mentorId:next.id,hours:(next.hours as readonly number[]).includes(selection.hours)?selection.hours:2});}
 useEffect(()=>{if(new URLSearchParams(location.search).has('session'))window.history.replaceState(null,'',location.pathname+selectionSearch({...selection,detail:null}));},[]);
 useEffect(()=>{try{sessionStorage.setItem('faze-mentorship-selection',selectionSearch(selection));}catch{}},[selection]);
 useEffect(()=>{const pop=()=>{setSelection({...readSelection(location.search),detail:null});setRequest(null);setSaved(null);setServerQuote(null);};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
 useEffect(()=>{
  setRequest(null);setSaved(null);setContext(emptyContext);setHistory(user?loadRequests(user.id):[]);if(!user)return;const controller=new AbortController();
  void loadContext(user,controller.signal).then(value=>{if(!controller.signal.aborted)setContext(value);});
  void fetchRequests().then(items=>{if(!controller.signal.aborted)setHistory(old=>[...items,...old.filter(v=>!items.some(i=>i.id===v.id))]);}).catch(()=>{});
  return()=>controller.abort();
 },[user?.id,user?.handle]);
 useEffect(()=>{const controller=new AbortController();setServerQuote(null);setQuoteStatus('Validating quote…');void fetchQuote(session.id,mentor.id,selection.hours,controller.signal).then(value=>{if(!controller.signal.aborted){setServerQuote(value);setQuoteStatus('');}}).catch(()=>{if(!controller.signal.aborted)setQuoteStatus('Request service unavailable. Nothing can be submitted yet.');});return()=>controller.abort();},[session.id,mentor.id,selection.hours,user?.id]);
 useEffect(()=>{if(request)requestRef.current?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});},[request]);
 return <Page><div className="mentor">
 <header className="mentor-hero"><div><span className="mentor-muted">Human mentorship</span><h1 className="ui-display">Learn. Improve. <span>Create.</span></h1><p>Choose your focus, mentor and session length.</p></div><Button variant="primary" arrow onClick={()=>configRef.current?.scrollIntoView({behavior:'smooth'})}>Configure session</Button></header>
 <div className="mentor-category-tabs mentor-segments" role="group" aria-label="Coaching path">{(['gaming','creator'] as const).map(path=><button type="button" key={path} aria-pressed={selection.path===path} onClick={()=>choosePath(path)}>{path==='gaming'?'Gaming':'Creator'}</button>)}</div>
 <section className="mentor-inline-session" aria-label="Coaching sessions"><div className="mentor-session-options" role="group" aria-label="Coaching focus">{sessions.filter(s=>s.path===selection.path).map(s=><button key={s.id} aria-pressed={session.id===s.id} onClick={()=>chooseFocus(s.id)}>{s.title}</button>)}</div><div className="mentor-inline-inclusions" key={session.id}><div><h2>Covers</h2><ul>{session.topics.map(t=><li key={t}>{t}</li>)}</ul></div><div><h2>Includes</h2><ul>{session.deliverables.map(t=><li key={t}>{t}</li>)}</ul></div><p><strong>Bring:</strong> {session.prepare}</p></div></section>
 <MentorCards path={selection.path} focus={session.id} selected={mentor.id} onSelect={chooseMentor}/>
 <section ref={configRef} className="mentor-configurator" aria-label="Session configuration"><PricingSummary quote={quote} title={session.title} mentor={mentor} onHours={hours=>update({...selection,hours})} ready={!!serverQuote} status={quoteStatus} onRequest={()=>{setSaved(null);setRequest(serverQuote);}}/>
 <div ref={requestRef} className="mentor-request-slot">{request&&<SessionRequest key={`${session.id}:${mentor.id}:${request.hours}:${user?.id||'guest'}`} user={user} session={session} quote={request} clips={context.clips} clipsError={context.clipsError} onCancel={()=>setRequest(null)} onSaved={item=>{setHistory(old=>[item,...old.filter(v=>v.id!==item.id)]);setSaved(item);setRequest(null);}}/>}{saved&&<p role="status" className="mentor-notice"><strong>Request recorded — pending.</strong> {sessions.find(s=>s.id===saved.sessionId)?.title}, {saved.mentor}, {saved.quote?.hours}h, {money(saved.quote!.totalCents)}. {saved.persistence==='memory'?'Memory-only preview; resets on server restart.':'Saved to the request database.'} No payment, appointment or mentor acceptance.</p>}</div>
 </section>
 <GuestCoaching path={selection.path}/>
 <footer className="mentor-community-links"><a href="/community">Community discussions ↗</a>{user&&<a href={`/u/${encodeURIComponent(user.handle)}`}>@{user.handle} · {context.karma===null?'View profile':`${context.karma} karma${context.mock?' (mock)':''}`} ↗</a>}</footer>
 {history.length>0&&<details className="mentor-history"><summary>Your requests ({history.length})</summary>{history.map(r=><div key={r.id}><strong>{sessions.find(s=>s.id===r.sessionId)?.title||'Session request'}</strong><small>{r.mentor||'Unassigned'} · {r.status==='pending'?`Pending · ${r.persistence==='memory'?'Memory preview':'Database'}`:'Legacy local draft'}{r.quote?` · ${r.quote.hours}h · ${money(r.quote.totalCents)}`:''}</small></div>)}</details>}
 </div></Page>;
}
