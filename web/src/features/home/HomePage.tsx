// Home showcase (owner: Joe, drafted by Yao for Phase 1). Lionsgate Club style: hero, live banner,
// one card per feature with a CTA, live counters, community + roster strips.
import { useEffect, useState } from 'react';
import { LiveBanner } from '../../components/live/LiveBanner';
import { LiveCounters } from '../../components/live/LiveCounters';
import { useLive } from '../../components/live/useLive';
import { FEATURES } from '../../components/features';
import { FazeLogo } from '../../components/FazeLogo';
import type { SessionUser } from '../../components/session';
import { Badge, Button, Kicker } from '../../components/ui';
import './home.css';

interface ThreadRow {
  id: string;
  title: string;
  score: number;
  comment_count?: number;
  handle?: string;
  author_handle?: string;
  created_at: string;
}

const ROSTER = [
  { name: 'Twistzz', img: '/games/cs2/roster/twistzz.webp' },
  { name: 'frozen', img: '/games/cs2/roster/frozen.webp' },
  { name: 'jcobbb', img: '/games/cs2/roster/jcobbb.webp' },
  { name: 'NEITYU', img: '/games/cs2/roster/neityu.webp' },
  { name: 'JBOEN', img: '/games/cs2/roster/jboen.webp' },
];

function ago(iso: string): string {
  const h = Math.max(0, (Date.now() - Date.parse(iso)) / 3600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${Math.floor(h)}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function useHotThreads(): ThreadRow[] | null {
  const [rows, setRows] = useState<ThreadRow[] | null>(null);
  useEffect(() => {
    fetch('/api/communities/faze-cs2/threads?sort=hot', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((b: { data?: ThreadRow[] }) => setRows((b.data ?? []).slice(0, 4)))
      .catch(() => setRows([]));
  }, []);
  return rows;
}

export function HomePage({ user }: { user: SessionUser | null }) {
  const { snapshot, fresh } = useLive();
  const threads = useHotThreads();

  return (
    <div className="home">
      <LiveBanner status={snapshot?.status ?? null} fresh={fresh} />

      <section className="home-hero">
        <div className="home-hero__text">
          <Kicker>FaZe HQ · The fan hub</Kicker>
          <h1 className="ui-display home-hero__title">
            Bring FaZe into <span className="ui-accent">every game</span> you play.
          </h1>
          <p className="ui-lede">
            A pro HUD on your stream. Lights that flash red when FaZe wins a round. A daily Guessr through sixteen years of plays. One wall the
            whole fanbase paints together, faster when FaZe is winning.
          </p>
          <div className="home-hero__cta">
            {user ? (
              <Button href={`/u/${encodeURIComponent(user.handle)}`} variant="primary" arrow>My profile</Button>
            ) : (
              <Button href="/join" variant="primary" arrow>Join FaZe HQ</Button>
            )}
            <Button href="#features">Explore features</Button>
          </div>
        </div>
        <div className="home-hero__mark" aria-hidden>
          <FazeLogo className="home-hero__logo" />
          <span className="home-hero__ring" />
        </div>
      </section>

      <LiveCounters counters={snapshot?.counters ?? null} />

      <section className="home-section" id="features" aria-labelledby="home-features-h">
        <div className="home-section__head">
          <Kicker>Create · Play · Engage</Kicker>
          <h2 id="home-features-h" className="ui-display ui-h2">Four ways to FaZe up</h2>
        </div>
        <div className="home-features">
          {FEATURES.map((f, i) => (
            <a key={f.slug} href={f.path} className="home-feature">
              <span className="home-feature__idx">0{i + 1}</span>
              <span className="home-feature__mark" aria-hidden>{f.mark}</span>
              <span className="home-feature__body">
                <span className="home-feature__top">
                  <strong className="ui-display">{f.name}</strong>
                  {f.status === 'soon' && <Badge>Soon</Badge>}
                </span>
                <span className="home-feature__tag">{f.tagline}</span>
                <span className="home-feature__cta">{f.cta} <span aria-hidden>→</span></span>
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="home-section home-community" aria-labelledby="home-community-h">
        <div className="home-community__intro">
          <Badge tone="red" live>Live now</Badge>
          <h2 id="home-community-h" className="ui-display ui-h2">Community</h2>
          <p className="ui-lede">Match threads, FaZe history, clips and watch-alongs. Old heads and new fans in the same room.</p>
          <Button href="/community" variant="primary" arrow>Join the conversation</Button>
        </div>
        <ol className="home-threads">
          {threads === null && <li className="home-thread home-thread--skeleton" />}
          {threads?.length === 0 && <li className="home-thread ui-muted">No threads yet. Start the first one.</li>}
          {threads?.map((t) => (
            <li key={t.id}>
              <a className="home-thread" href={`/community?thread=${encodeURIComponent(t.id)}`}>
                <span className="home-thread__score">{t.score}</span>
                <span className="home-thread__body">
                  <strong>{t.title}</strong>
                  <span className="ui-muted">
                    {t.handle || t.author_handle ? `@${t.handle ?? t.author_handle} · ` : ''}
                    {ago(t.created_at)}
                    {t.comment_count ? ` · ${t.comment_count} comments` : ''}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-section" aria-labelledby="home-roster-h">
        <div className="home-section__head">
          <Kicker>Counter-Strike 2</Kicker>
          <h2 id="home-roster-h" className="ui-display ui-h2">The squad you're cheering for</h2>
        </div>
        <ul className="home-roster">
          {ROSTER.map((p) => (
            <li key={p.name} className="home-roster__card">
              <img src={p.img} alt="" loading="lazy" />
              <span className="ui-display">{p.name}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="home-foot">
        <span>FaZe HQ · HackUTA 2026 fan project. Not affiliated with or endorsed by FaZe Clan, Valve or FACEIT.</span>
        <a href="/leaderboards">Leaderboards</a>
      </footer>
    </div>
  );
}
