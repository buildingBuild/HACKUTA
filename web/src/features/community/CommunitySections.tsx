import arenaImage from './assets/arena.svg';
import { useEffect, useState } from 'react';
import { fetchCatalog, type Reward } from '../rewards/api';
import { MerchArt } from '../rewards/MerchArt';
export type Section = 'Discussions' | 'Clips' | 'Events & Drops' | 'Watch Together';
export const SECTIONS: Section[] = ['Discussions', 'Clips', 'Events & Drops'];
const events = [
  { title: 'The next round, together.', type: 'CS2 watch party', date: '2026-11-21T19:00:00Z', description: 'Watch the rounds and join the conversation.', challenge: false },
  { title: 'Recreate the Classic.', type: 'Community showcase', date: '2026-11-23T20:00:00Z', description: 'Share your one-tap. Let the community vote.', challenge: true },
  { title: 'Community cup.', type: 'Tournament concept', date: '2026-11-24T18:00:00Z', description: 'A weekend of team play and competitive CS2.', challenge: false },
];
const localDate = (date: string) => new Date(date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export function EventsSection({ discuss }: { discuss: (challenge?: boolean) => void }) {
  const [rewards,setRewards] = useState<Reward[]>([]);
  const [catalogStatus,setCatalogStatus] = useState('Loading merchandise…');
  useEffect(()=>{let live=true;fetchCatalog().then(items=>{if(live){setRewards(items.filter(r=>r.kind==='merch').slice(0,2));setCatalogStatus('');}}).catch(()=>{if(live)setCatalogStatus('Rewards catalog unavailable. Open Rewards to check the store.');});return()=>{live=false;};},[]);
  return <div className="cq-showcase">
    <div className="cq-showcase-heading"><h2>Upcoming Events</h2><a href="/community?view=watch">All watch rooms ↗</a></div>
    <div className="cq-event-grid">{events.map((event,i) => <article className={`cq-event-card cq-event-card--${i}`} key={event.title} style={{ backgroundImage: `linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.92)),url("${arenaImage}")` }}><span className="cq-badge">SAMPLE · {event.type}</span><div className="cq-event-copy"><time dateTime={event.date}>{localDate(event.date)}</time><h3>{event.title}</h3><p>{event.description}</p>{i === 0 ? <a className="cq-primary" href="/community?watch=sydney-replay">Join Watch Party →</a> : event.challenge ? <button className="cq-primary" onClick={() => discuss(true)}>See challenge →</button> : <a className="cq-primary" href="https://fazeclan.com/pages/team" target="_blank" rel="noopener noreferrer">See team details ↗</a>}</div></article>)}</div>
    <div className="cq-showcase-heading"><h3>From the Rewards store</h3><a href="/rewards#rw-store-h">Browse rewards ↗</a></div>
    {catalogStatus ? <p className="cq-store-status" role="status">{catalogStatus}</p> : !rewards.length ? <p>No merchandise listed. <a href="/rewards#rw-store-h">Visit Rewards →</a></p> : <div className="cq-merch-grid">{rewards.map(reward=><article className="cq-merch-card" key={reward.id}><div className="cq-product-image"><MerchArt art={reward.art}/></div><div className="cq-merch-copy"><span className="cq-reward-price">{reward.cost.toLocaleString()} pts{reward.stock===0?' · Sold out':''}</span><h3>{reward.name}</h3>{reward.blurb&&<p>{reward.blurb}</p>}<a className="cq-primary" href="/rewards#rw-store-h">View in Rewards →</a></div></article>)}</div>}

  </div>;
}
