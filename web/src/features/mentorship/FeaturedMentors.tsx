import { useState } from 'react';
import { Button } from '../../components/ui';
import type { Path } from './catalog';
const concepts=[
 {id:'twistzz',name:'Twistzz',path:'gaming' as Path,image:'/games/cs2/roster/twistzz.webp',role:'CS2 player',focus:'Gameplay review',source:'https://fazeclan.com/pages/team'},
 {id:'frozen',name:'frozen',path:'gaming' as Path,image:'/games/cs2/roster/frozen.webp',role:'CS2 player',focus:'Competitive decisions',source:'https://fazeclan.com/pages/team'},
 {id:'apex',name:'FaZe Apex',path:'creator' as Path,image:null,role:'Co-owner, clan director & content creator',focus:'Creator development',source:'https://fazeclan.com/pages/people'},
];
export function FeaturedMentors({path}:{path:Path}){
 const [selected,setSelected]=useState<string|null>(null);
 const concept=concepts.find(c=>c.id===selected&&c.path===path);
 return <section className="mentor-showcase" aria-label="Featured mentor concepts"><div className="mentor-section-head"><h2 className="ui-display">Featured guest concepts</h2><span>Guest concepts · Participation unconfirmed</span></div><div className="mentor-showcase-grid" key={path}>{concepts.filter(c=>c.path===path).map(c=><article className="mentor-photo-card" key={c.id}><div className="mentor-photo">{c.image?<img src={c.image} alt={c.name} loading="eager" onError={e=>{e.currentTarget.style.display='none';}}/>:<div className="mentor-portrait-placeholder" aria-label="Portrait unavailable">FA</div>}<span>Proposed guest</span></div><div className="mentor-photo-caption"><h3 className="ui-display">{c.name}</h3><p>{c.role}</p><small>Concept focus: {c.focus}</small><Button size="sm" onClick={()=>setSelected(c.id)} aria-expanded={concept?.id===c.id}>View session concept</Button></div></article>)}</div>{concept&&<div className="mentor-concept-detail" role="region" aria-label="Guest session concept"><h3>{concept.name} / {concept.focus}</h3><p>Proposed guest concept only. Participation is unconfirmed; this person cannot be booked or requested here.</p><a href={concept.source} target="_blank" rel="noreferrer">Public role source: FaZe directory ↗</a><Button size="sm" onClick={()=>setSelected(null)}>Close concept</Button></div>}<small className="mentor-photo-credit">Portraits: existing FaZe HQ roster assets. Public identities: FaZe official directories.</small></section>;
}
