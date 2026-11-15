import arenaImage from './assets/arena.svg';
import jerseyImage from './assets/jersey.svg';
export type Section = 'Discussions' | 'Clips' | 'Events & Drops' | 'Watch Together';
export const SECTIONS: Section[] = ['Discussions', 'Clips', 'Events & Drops', 'Watch Together'];
const events = [
  { title: 'The next round, together.', type: 'CS2 watch party', date: '2026-11-21T19:00:00Z', description: 'Watch the rounds and join the conversation.', challenge: false },
  { title: 'Recreate the Classic.', type: 'Community showcase', date: '2026-11-23T20:00:00Z', description: 'Share your one-tap. Let the community vote.', challenge: true },
  { title: 'Community cup.', type: 'Tournament concept', date: '2026-11-24T18:00:00Z', description: 'A weekend of team play and competitive CS2.', challenge: false },
];
const drops = [
  { title: 'HQ jersey concept', date: '2026-11-25T17:00:00Z', description: 'Black, red, and ready for the next round.' },
  { title: 'After-hours jersey concept', date: '2026-11-28T17:00:00Z', description: 'A quieter take on the HQ jersey.' },
];
const localDate = (date: string) => new Date(date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export function EventsSection({ discuss }: { discuss: (challenge?: boolean) => void }) {
  return <div className="cq-showcase">
    <div className="cq-showcase-heading"><h2>Upcoming Events</h2><span>Local time / 2026</span></div>
    <div className="cq-event-grid">{events.map((event,i) => <article className={`cq-event-card cq-event-card--${i}`} key={event.title} style={{ backgroundImage: `linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.92)),url("${arenaImage}")` }}><span className="cq-badge">SAMPLE · {event.type}</span><div className="cq-event-copy"><time dateTime={event.date}>{localDate(event.date)}</time><h3>{event.title}</h3><p>{event.description}</p>{i === 0 ? <a className="cq-primary" href="/community?watch=sydney-replay">Join Watch Party →</a> : event.challenge ? <button className="cq-primary" onClick={() => discuss(true)}>See challenge →</button> : <a className="cq-primary" href="https://fazeclan.com/pages/team" target="_blank" rel="noopener noreferrer">See team details ↗</a>}</div></article>)}</div>
    <div className="cq-showcase-heading"><h3>Merch drops</h3><span>Sample collection</span></div>
    <div className="cq-merch-grid">{drops.map((drop,i) => <article className="cq-merch-card" key={drop.title}><div className="cq-product-image"><img className={i ? 'cq-product-alternate' : ''} src={jerseyImage} alt={`${drop.title} — black and red sample jersey illustration`} loading="lazy" /><span className="cq-badge">SAMPLE</span></div><div className="cq-merch-copy"><time dateTime={drop.date}>Release · {localDate(drop.date)}</time><h3>{drop.title}</h3><p>{drop.description}</p><a className="cq-primary" href="https://fazeclan.com/collections/all" target="_blank" rel="noopener noreferrer">View official store ↗</a></div></article>)}</div>
  </div>;
}
const curated = [
  { platform:'Reddit · r/GlobalOffensive', title:'Antwerp 2022 grand final — community post-match discussion', description:'An archived fan discussion about FaZe vs NAVI. Historical CS:GO context.', url:'https://www.reddit.com/r/GlobalOffensive/comments/uvjl62/faze_clan_vs_natus_vincere_pgl_major_antwerp_2022/' },
  { platform:'Reddit · r/GlobalOffensive', title:'Cologne 2022 grand final — community post-match discussion', description:'Revisit the fan conversation around the five-map final. Historical CS:GO context.', url:'https://www.reddit.com/r/GlobalOffensive/comments/w1hgsl/faze_clan_vs_natus_vincere_iem_cologne_2022/' },
  { platform:'X / Twitter · FaZe Esports', title:'FaZe Esports announcement and replies', description:'A curated original FaZe Esports post. X may require sign-in to view the post and replies.', url:'https://twitter.com/FaZeEsports/status/1966992912505598338' },
];
export function AroundSection() {
  return <section className="cq-panel cq-around" aria-label="Around the Community"><h3>Around the Community</h3><ul>{curated.map(item => <li key={item.url}><small>{item.platform}</small><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title} ↗</a></li>)}</ul><small>Curated links · sign-in may be required.</small></section>;
}
