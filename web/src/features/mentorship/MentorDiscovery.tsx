import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui';
import { FeaturedMentors } from './FeaturedMentors';
import { sessions, type Path } from './catalog';

export function MentorDiscovery({onSession}:{onSession:(id:string,path:Path)=>void}) {
  const [filter,setFilter]=useState<'all'|Path>('all'),[selected,setSelected]=useState<string|null>(null);
  const details=useRef<HTMLElement>(null),mentor=sessions.find(s=>s.id===selected);
  useEffect(()=>{if(selected){details.current?.scrollIntoView({behavior:'smooth',block:'start'});details.current?.focus({preventScroll:true});}},[selected]);
  return <section className="mentor-people" aria-labelledby="meet-mentors">
    <div className="mentor-section-head"><h2 id="meet-mentors" className="ui-display">Meet our mentors</h2><span>Sample profiles</span></div>
    <div className="mentor-people-filters" role="group" aria-label="Filter mentors">{(['all','gaming','creator'] as const).map(value=><button key={value} aria-pressed={filter===value} onClick={()=>{setFilter(value);setSelected(null);}}>{value==='all'?'All':value==='gaming'?'Gaming':'Content Creation'}</button>)}</div>
    <div className="mentor-people-grid">{sessions.filter(s=>filter==='all'||s.path===filter).map(s=><article className="mentor-person" key={s.id}>
      <div className={`mentor-portrait mentor-portrait--${s.path}`} aria-label="Illustrated sample mentor placeholder" role="img"><svg viewBox="0 0 240 160" aria-hidden="true"><path d="M0 130L240 30M0 160L240 60M0 100L240 0" stroke="currentColor" opacity=".12"/><circle cx="120" cy="63" r="27" fill="currentColor" opacity=".4"/><path d="M63 160v-27a57 57 0 0 1 114 0v27" fill="currentColor" opacity=".3"/></svg><small>Sample</small></div>
      <div className="mentor-person-copy"><h3 className="ui-display">{s.mentor}</h3><p>{s.specialty}</p><small>{s.title} · 1–2 hours</small><Button size="sm" onClick={()=>setSelected(s.id)} aria-expanded={selected===s.id} aria-controls="mentor-background">View profile</Button></div>
    </article>)}</div>
    {mentor&&<section ref={details} tabIndex={-1} id="mentor-background" className="mentor-background" aria-label="Mentor details">
      <div className="mentor-section-head"><h3 className="ui-display">{mentor.mentor}</h3><Button size="sm" onClick={()=>setSelected(null)}>Close profile</Button></div>
      <span className="mentor-muted">Sample profile · Credentials unverified</span><p>{mentor.audience}</p><ul className="mentor-specialties">{mentor.topics.map(t=><li key={t}>{t}</li>)}</ul>
      <footer><div><strong>{mentor.title}</strong><p>1–2 hours · Illustrative pricing</p></div><Button variant="primary" arrow onClick={()=>onSession(mentor.id,mentor.path)}>View session</Button></footer>
    </section>}
  </section>;
}

export function GuestCoaching({path='gaming'}:{path?:Path}) {
  const [open,setOpen]=useState(false);
  const formats=[['Pro Player Sessions','Gameplay breakdowns and practice insights.'],['Creator Masterclasses','Content planning, filming and editing.'],['Community Q&A','Questions for invited guests.'],['Special Mentorship Events','Focused group sessions, if organized.']];
  return <section className="mentor-guest" aria-labelledby="guest-coaching">
    <div className="mentor-guest-mark" aria-hidden="true"><span>FZ</span></div>
    <div className="mentor-guest-copy"><span className="mentor-muted">FaZe Guest Sessions · Concept</span><h2 id="guest-coaching" className="ui-display">Learn from <span>FaZe.</span></h2><p>Explore potential guest sessions with FaZe players, creators, and alumni.</p><small>Participation unconfirmed.</small><Button variant="primary" arrow aria-expanded={open} aria-controls="guest-formats" onClick={()=>setOpen(v=>!v)}>{open?'Close interest preview':'Register interest'}</Button></div>
    <div className="mentor-guest-people"><FeaturedMentors path={path}/></div>
    {open&&<div id="guest-formats" className="mentor-guest-formats"><p className="mentor-guest-status" role="status">Interest registration is not open. Preview proposed formats below.</p>{formats.map(([title,body])=><article key={title}><h3>{title}</h3><p>{body}</p></article>)}<a href="/community?watch=question-time">Join the fan discussion ↗</a></div>}
  </section>;
}
