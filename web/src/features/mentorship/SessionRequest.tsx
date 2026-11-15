import { useRef, useState } from 'react';
import type { SessionUser } from '../../components/session';
import { Button } from '../../components/ui';
import { submitRequest, type ClipChoice } from './api';
import { money, type PriceQuote } from './pricing';
import { validateRequest, type DemoRequest, type Session } from './catalog';

export function SessionRequest({user,session,quote,clips,clipsError,onSaved,onCancel}:{
  user:SessionUser|null;session:Session;quote:PriceQuote;clips:ClipChoice[];clipsError:boolean;
  onSaved:(request:DemoRequest)=>void;onCancel:()=>void;
}) {
  const [goals,setGoals]=useState(''),[link,setLink]=useState('');
  const [clipId,setClipId]=useState(''),[notes,setNotes]=useState(''),[error,setError]=useState('');
  const submitting=useRef(false);
  const [busy,setBusy]=useState(false),[requestId]=useState(()=>crypto.randomUUID());
  if(!user)return <section className="mentor-request" aria-label="Session request"><h2>Sign in to request coaching</h2><p>Choose an account in the shared login selector or join FaZe HQ.</p><Button href="/join">Join FaZe HQ</Button><Button onClick={onCancel}>Cancel</Button></section>;
  return <section className="mentor-request" aria-label="Session request"><h2>Request {session.title}</h2><p>{quote.hours} {quote.hours===1?'hour':'hours'} · {money(quote.totalCents)} illustrative · {quote.mentorId==='workshop'?'Workshop mentor':'Review mentor'} (sample)</p><p className="mentor-muted">Pending request · No payment or appointment.</p>
    <form onSubmit={async e=>{
      e.preventDefault();if(submitting.current)return;const problem=validateRequest(goals,link,notes);
      if(problem){setError(problem);return;}
      if(clipId&&!clips.some(c=>c.id===clipId)){setError('Select an available clip from your account.');return;}
      submitting.current=true;setBusy(true);
      try{onSaved(await submitRequest({requestId,sessionId:session.id,mentorId:quote.mentorId!,hours:quote.hours,expectedTotalCents:quote.totalCents,goals:goals.trim(),link:link.trim(),clipId:clipId||null,notes:notes.trim()}));}
      catch(error){setError(error instanceof Error?error.message:'Your request could not be recorded. Try again.');submitting.current=false;setBusy(false);}
    }}>
      <p>Requesting as <a href={`/u/${encodeURIComponent(user.handle)}`}>@{user.handle}</a></p>
      <label>Your goals<textarea autoFocus required minLength={10} maxLength={2000} rows={3} value={goals} onChange={e=>setGoals(e.target.value)} placeholder="What would you like feedback on?"/></label>
      {session.path==='gaming'&&<label>Existing CS2 clip<select value={clipId} onChange={e=>setClipId(e.target.value)}><option value="">No clip selected</option>{clips.map(c=><option key={c.id} value={c.id}>{c.title||'Untitled clip'}</option>)}</select>{!clips.length&&<small>{clipsError?'Clip service unavailable. Include a public link below.':'No existing clips. You can include a public link below.'}</small>}</label>}
      <label>{session.path==='gaming'?'Public VOD or clip URL (optional)':'Public channel or content URL (optional)'}<input type="url" maxLength={2000} value={link} onChange={e=>setLink(e.target.value)} placeholder="https://"/></label>
      <label>Additional notes (optional)<textarea rows={2} maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
      {error&&<p role="alert">{error}</p>}
      <div className="mentor-actions"><Button type="submit" variant="primary" disabled={busy}>{busy?'Saving…':'Submit request'}</Button><Button disabled={busy} onClick={onCancel}>Cancel</Button></div>
    </form>
  </section>;
}
