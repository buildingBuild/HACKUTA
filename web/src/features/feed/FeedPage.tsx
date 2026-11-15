import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SessionUser } from '../../components/session';
import { activity, buildPage, loadSources, type FeedItem, type FeedKind, type FeedSources } from './api';
import { FeedCard } from './cards';
import './feed.css';

/**
 * FaZe Feed (/feed), experimental, Joe.
 * One endless masonry wall that mixes everything social on HQ: clips, threads, challenges,
 * watch parties, fan quotes, the roster, leaderboards and the live match.
 */

const FILTERS: { id: string; label: string; kinds: FeedKind[] | null }[] = [
  { id: 'all', label: 'Everything', kinds: null },
  { id: 'clips', label: 'Clips', kinds: ['clip', 'live'] },
  { id: 'talk', label: 'Talk', kinds: ['thread', 'voice', 'quote', 'reddit'] },
  { id: 'play', label: 'Play', kinds: ['versus', 'trivia', 'challenge', 'board', 'live'] },
  { id: 'watch', label: 'Watch', kinds: ['yt', 'watch', 'live'] },
  { id: 'web', label: 'Around the web', kinds: ['yt', 'reddit'] },
  { id: 'squad', label: 'The squad', kinds: ['player'] },
];

const MAX_PAGES = 6;
const ROW = 2; // px, grid-auto-rows; tiles span ceil(height / ROW)
const GAP = 6;

/** Measures its content and spans enough grid rows to fit: true masonry on a CSS grid. */
function Tile({ children, index, wide }: { children: ReactNode; index: number; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [span, setSpan] = useState(40);
  const [seen, setSeen] = useState(false);

  useLayoutEffect(() => {
    // measure the wrapper (not the card) so swapped children are still tracked; offsetHeight ignores transforms
    const el = ref.current;
    if (!el) return;
    const measure = () => setSpan(Math.ceil((el.offsetHeight + GAP) / ROW));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setSeen(true), io.disconnect()), { rootMargin: '0px 0px -40px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`fd-tile ${wide ? 'fd-tile--wide' : ''} ${seen ? 'is-in' : ''}`} style={{ gridRowEnd: `span ${span}`, ['--i' as string]: index % 6 }}>
      {children}
    </div>
  );
}

function Ticker({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  const row = lines.map((l, i) => (
    <span key={i}>
      <i /> {l}
    </span>
  ));
  return (
    <div className="fd-ticker" aria-label="Recent activity">
      <div className="fd-ticker__track" style={{ ['--dur' as string]: `${lines.length * 4}s` }}>
        {row}
        <span aria-hidden="true" className="fd-ticker__dup">{row}</span>
      </div>
    </div>
  );
}

export function FeedPage({ user }: { user: SessionUser | null }) {
  const [src, setSrc] = useState<FeedSources | null>(null);
  const [pages, setPages] = useState(1);
  const [filter, setFilter] = useState('all');
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    loadSources().then((s) => live && setSrc(s));
    return () => {
      live = false;
    };
  }, []);

  const items = useMemo<FeedItem[]>(() => {
    if (!src) return [];
    const all = Array.from({ length: pages }, (_, p) => buildPage(src, p)).flat();
    const kinds = FILTERS.find((f) => f.id === filter)?.kinds;
    return kinds ? all.filter((i) => kinds.includes(i.kind)) : all;
  }, [src, pages, filter]);

  // endless scroll: load the next page when the sentinel nears the viewport
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !src) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setPages((p) => Math.min(MAX_PAGES, p + 1)), { rootMargin: '900px' });
    io.observe(el);
    return () => io.disconnect();
  }, [src, pages]);

  const counts = src && {
    clips: src.clips.length,
    threads: src.threads.length,
    rooms: src.rooms.length,
    videos: src.external.filter((x) => x.source === 'youtube').length,
    reddit: src.external.filter((x) => x.source === 'reddit').length,
  };

  return (
    <main className="fd">
      <header className="fd-head">
        <div>
          <p className="fd-kicker"><span /> FaZe Feed · experimental</p>
          <h1>Everything the fam is <em>doing.</em></h1>
          {counts && (
            <p className="fd-sub">
              {counts.clips} fan clips · {counts.threads} HQ threads · {counts.videos} FaZe videos
              {counts.reddit ? ` · ${counts.reddit} Reddit posts` : ''}, all in one scroll.
            </p>
          )}
        </div>
        <nav className="fd-filters" aria-label="Filter the feed">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className={filter === f.id ? 'is-on' : ''} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </nav>
      </header>
      {src && <Ticker lines={activity(src)} />}

      {!src ? (
        <div className="fd-grid fd-grid--loading" aria-busy="true">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="fd-skel" style={{ height: 160 + ((i * 97) % 220) }} />
          ))}
        </div>
      ) : (
        <div key={filter} className="fd-grid">
          {items.map((item, i) => (
            <Tile key={item.id} index={i} wide={item.wide}>
              <FeedCard item={item} user={user} index={i} />
            </Tile>
          ))}
        </div>
      )}

      <div ref={sentinel} className="fd-end">
        {src && pages >= MAX_PAGES ? <span>You're caught up. <b>FaZe up.</b></span> : <span className="fd-dots"><i /><i /><i /></span>}
      </div>
    </main>
  );
}
