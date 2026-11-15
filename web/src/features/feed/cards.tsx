import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { SessionUser } from '../../components/session';
import { useLive } from '../../components/live/useLive';
import { FazeLogo } from '../../components/FazeLogo';
import { createCommunityApi } from '../community/api';
import { ClipFrame } from '../onboarding/ClipFrame';
import { FACEIT_SOURCE, MAPS, type DemoClip } from '../onboarding/clips';
import type { ExternalItem, FeedClip, FeedItem, Trivia, Versus } from './api';

const threadHref = (id: string) => `/community?thread=${encodeURIComponent(id)}`;
const ago = (iso: string) => {
  const m = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
};
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const ytId = (url: string) => url.match(/(?:v=|shorts\/|youtu\.be\/|embed\/)([\w-]{11})/)?.[1] ?? null;

type SrcKind = 'hq' | 'youtube' | 'reddit' | 'faceit' | 'upload';
const SRC_ICON: Record<SrcKind, string | null> = {
  hq: null,
  upload: null,
  youtube: '/brand/social/youtube.svg',
  reddit: '/brand/social/reddit.svg',
  faceit: '/brand/social/faceit.svg',
};

/** "Where this came from" pill shown on every sourced card. */
function Src({ kind, label, className = '' }: { kind: SrcKind; label: string; className?: string }) {
  const icon = SRC_ICON[kind];
  return (
    <span className={`fd-src fd-src--${kind} ${className}`}>
      {icon ? <img src={icon} alt="" /> : <FazeLogo className="fd-src__f" />}
      {label}
    </span>
  );
}

const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));

function Avatar({ name, url }: { name: string; url?: string | null }) {
  if (url) return <img className="fd-av fd-av--img" src={url} alt="" loading="lazy" />;
  return <span className="fd-av">{(name[0] ?? '?').toUpperCase()}</span>;
}

/* ---------- live match ---------- */
const HYPE_KEY = 'fd-hype';

function LiveCard() {
  const { snapshot, fresh } = useLive();
  const s = snapshot?.status;
  const won = fresh?.type === 'round_win';
  const [hype, setHype] = useState(() => Number(localStorage.getItem(HYPE_KEY) ?? 0));
  const [bursts, setBursts] = useState<number[]>([]);

  const faze = () => {
    const n = hype + 1;
    setHype(n);
    localStorage.setItem(HYPE_KEY, String(n));
    const id = Date.now();
    setBursts((b) => [...b.slice(-3), id]);
    window.setTimeout(() => setBursts((b) => b.filter((x) => x !== id)), 1300);
  };

  if (!s) return <div className="fd-live fd-live--idle"><FazeLogo className="fd-live__logo" /><p>Checking the match feed…</p></div>;
  return (
    <article key={fresh?.id ?? 'live'} className={`fd-live ${won ? 'fd-live--flash' : ''}`}>
      <a className="fd-cover" href="/community?watch=sydney-replay" aria-label="Watch with the fam" />
      <span className="fd-live__tag"><i /> {s.live ? 'Live now' : 'Next up'}</span>
      <FazeLogo className="fd-live__logo" />
      <div className="fd-live__score">
        <span>FaZe</span>
        <b>{s.score?.faze ?? 0}</b>
        <em>:</em>
        <b>{s.score?.opp ?? 0}</b>
        <span>{s.opponent ?? 'TBD'}</span>
      </div>
      <p className="fd-live__event">{won ? 'FaZe take the round' : s.event ?? 'FaZe CS2'}</p>
      <div className="fd-live__row">
        <span className="fd-live__cta">Watch with the fam →</span>
        <button type="button" className="fd-hype" onClick={faze}>
          FaZe up <b>{hype}</b>
          {bursts.map((id) => (
            <span key={id} className="fd-burst" aria-hidden="true">
              {Array.from({ length: 8 }, (_, k) => (
                <span key={k} className="fd-burst__f" style={{ ['--a' as string]: `${k * 45 + 10}deg`, ['--d' as string]: `${50 + (k % 3) * 22}px` } as CSSProperties}>
                  <FazeLogo />
                </span>
              ))}
            </span>
          ))}
        </button>
      </div>
      <small className="fd-live__src">demo feed</small>
    </article>
  );
}

/* ---------- clips ---------- */
function toFrame(c: FeedClip, i: number): DemoClip {
  const map = MAPS.find((m) => m[0].toLowerCase() === (c.map ?? '').toLowerCase()) ?? MAPS[i % MAPS.length];
  const t = c.title.toLowerCase();
  const kills = /ace|quad/.test(t) ? 3 : /triple|1v3/.test(t) ? 3 : /1v2|double|spray/.test(t) ? 2 : 1;
  return { id: i, title: c.title, category: 'highlights', map, source: FACEIT_SOURCE, time: '00:' + String(10 + (i * 7) % 49).padStart(2, '0'), score: 0, rot: 0, progress: 30 + (i * 13) % 60, kills };
}

function ClipCard({ clip, shape, index }: { clip: FeedClip; shape: string; index: number }) {
  const [videoOk, setVideoOk] = useState(true);
  const [mediaRef, inView] = useInView<HTMLDivElement>(0.3);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (inView) void v.play().catch(() => {});
    else v.pause();
  }, [inView, videoOk]);
  return (
    <a className={`fd-clip fd-clip--${shape}`} href={`/u/${encodeURIComponent(clip.handle)}`}>
      <div ref={mediaRef} className="fd-clip__media">
        <ClipFrame clip={toFrame(clip, index)} gamertag={clip.handle} className="fd-clip__frame" />
        {videoOk && (
          <video
            className="fd-clip__video"
            src={clip.blob_url}
            poster={clip.thumbnail_url ?? undefined}
            ref={video}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
            onError={() => setVideoOk(false)}
          />
        )}
        <span className="fd-clip__play" aria-hidden="true">▶</span>
        <Src kind="upload" label="Fan upload" className="fd-src--over" />
      </div>
      <div className="fd-clip__meta">
        <Avatar name={clip.display_name} />
        <span>
          <b>{clip.title}</b>
          <small>@{clip.handle}{clip.map ? ` · ${clip.map}` : ''} · {ago(clip.created_at)}</small>
        </span>
      </div>
    </a>
  );
}

/* ---------- discussion ---------- */
function ThreadCard({ item, user }: { item: Extract<FeedItem, { kind: 'thread' }>; user: SessionUser | null }) {
  const { thread, topic, tone } = item;
  const [vote, setVote] = useState(thread.viewer_vote);
  const [score, setScore] = useState(thread.score);
  const up = async () => {
    if (!user) return void (window.location.href = '/join');
    const value = vote === 1 ? 0 : 1;
    setScore((s) => s + value - vote);
    setVote(value);
    try {
      const r = await createCommunityApi(user.id).vote('thread', thread.id, value);
      setScore(r.data.score);
      setVote(r.data.viewer_vote);
    } catch {
      setScore(thread.score);
      setVote(thread.viewer_vote);
    }
  };
  return (
    <article className={`fd-post fd-post--${tone}`}>
      <a className="fd-cover" href={threadHref(thread.id)} aria-label={thread.title} />
      <div className="fd-srcrow">
        <Src kind="hq" label="FaZe HQ" />
        <span className="fd-tag">#{topic}</span>
      </div>
      <h3>{thread.title}</h3>
      {thread.body && <p>{thread.body.length > 180 ? thread.body.slice(0, 180).trimEnd() + '…' : thread.body}</p>}
      <footer>
        <Avatar name={thread.author.display_name} url={thread.author.avatar_url} />
        <span className="fd-post__who">{thread.author.display_name}<small>{ago(thread.created_at)}</small></span>
        <button type="button" className={`fd-up ${vote === 1 ? 'is-on' : ''}`} onClick={up} aria-label="Upvote">▲ {score}</button>
        <span className="fd-com">{plural(thread.comment_count, 'reply')}</span>
      </footer>
    </article>
  );
}

function ChallengeCard({ thread }: { thread: Extract<FeedItem, { kind: 'challenge' }>['thread'] }) {
  return (
    <a className="fd-chal" href={threadHref(thread.id)}>
      <span className="fd-chal__kicker">Challenge</span>
      <h3>{thread.title}</h3>
      {thread.body && <p>{thread.body.slice(0, 140)}</p>}
      <div className="fd-chal__stats">
        <span><b>{thread.comment_count}</b> entries</span>
        <span><b>{thread.score}</b> votes</span>
      </div>
      <div className="fd-srcrow fd-srcrow--end">
        <span className="fd-chal__cta">Enter →</span>
        <Src kind="hq" label="FaZe HQ challenge" />
      </div>
    </a>
  );
}

/* ---------- autoplaying YouTube preview (muted, only while on screen) ---------- */
/** true while at least `threshold` of the element is visible; flips back when scrolled away */
function useInView<T extends Element>(threshold = 0.5, rootMargin = '0px') {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting && e.intersectionRatio >= threshold), {
      threshold: [0, threshold, 1],
      rootMargin,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin]);
  return [ref, inView] as const;
}

function YtPreview({ id, thumb, title, short, interactive = true }: { id: string | null; thumb: string | null; title: string; short?: boolean; interactive?: boolean }) {
  // Start the player about a screen BEFORE the card scrolls in, so it's already rolling when you get there.
  // Cards far off screen unmount their player to keep the page light.
  const [ref, near] = useInView<HTMLDivElement>(0, '100% 0px 100% 0px');
  const [sound, setSound] = useState(false);
  const [ready, setReady] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  // autoplay is the point of the feed, so it runs even with reduced motion (thumbnail fade is the only animation)
  const play = !!id && (sound || near);

  // Fade the thumbnail out the moment YouTube reports "playing" (state 1), not on a fixed timer.
  useEffect(() => {
    if (!play) return;
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || typeof e.data !== 'string') return;
      try {
        const d = JSON.parse(e.data) as { event?: string; info?: { playerState?: number } | number };
        const state = typeof d.info === 'number' ? d.info : d.info?.playerState;
        if ((d.event === 'onStateChange' || d.event === 'infoDelivery') && state === 1) setReady(true);
      } catch {
        /* not a player message */
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [play]);

  // Some browsers (Safari, strict Chrome profiles) ignore the autoplay URL flag in cross-origin iframes.
  // Nudge the player through the IFrame API once it's loaded: mute, then play.
  const kick = () => {
    const w = frame.current?.contentWindow;
    if (!w) return;
    w.postMessage(JSON.stringify({ event: 'listening', id: title, channel: 'widget' }), '*'); // subscribe to state events
    const cmd = (func: string) => w.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*');
    if (!sound) cmd('mute');
    cmd('playVideo');
  };
  useEffect(() => {
    if (!play) return;
    const ts = [400, 1200, 2500].map((ms) => window.setTimeout(kick, ms));
    return () => ts.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, sound]);

  // the player shows a black frame + spinner first; keep the thumbnail up until it's really playing
  useEffect(() => {
    if (!play) return setReady(false);
    const t = window.setTimeout(() => setReady(true), 3500); // fallback if state events never arrive
    return () => window.clearTimeout(t);
  }, [play, sound]);

  const params = sound
    ? 'autoplay=1&mute=0&controls=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1'
    : `autoplay=1&mute=1&enablejsapi=1&controls=0&loop=1&playlist=${id}&playsinline=1&rel=0&modestbranding=1&disablekb=1&iv_load_policy=3&cc_load_policy=0${short ? '' : '&start=20'}`;

  return (
    <div ref={ref} className={`fd-pv ${ready ? 'is-ready' : ''} ${sound ? 'is-sound' : ''}`}>
      {thumb && <img className="fd-pv__thumb" src={thumb} alt="" loading="lazy" />}
      {play && (
        <iframe
          key={sound ? 'sound' : 'muted'}
          ref={frame}
          onLoad={kick}
          className="fd-pv__frame"
          src={`https://www.youtube-nocookie.com/embed/${id}?${params}`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          tabIndex={sound ? 0 : -1}
        />
      )}
      {interactive && !sound && (
        <button type="button" className="fd-pv__sound" onClick={() => setSound(true)} aria-label={`Play ${title} with sound`}>
          <span className="fd-pv__chip">🔈 Tap for sound</span>
        </button>
      )}
      {!ready && !sound && <span className="fd-yt__play" aria-hidden="true">▶</span>}
    </div>
  );
}

/* ---------- watch party ---------- */
function WatchCard({ room }: { room: Extract<FeedItem, { kind: 'watch' }>['room'] }) {
  const id = ytId(room.media_url);
  const img = id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  return (
    <a className="fd-watch" href={`/community?watch=${encodeURIComponent(room.id)}`}>
      <div className="fd-watch__media">
        {img && id ? (
          <YtPreview id={id} thumb={img} title={room.title} interactive={false} />
        ) : (
          <div className="fd-watch__blank"><FazeLogo /></div>
        )}
        <span className="fd-watch__badge">{room.status} · Watch party</span>
      </div>
      <div className="fd-watch__body">
        <Src kind="youtube" label="YouTube · HQ watch party" />
        <h3>{room.title}</h3>
        <p className="fd-watch__poll">{room.poll.question}</p>
        <div className="fd-watch__opts">
          {room.poll.options.slice(0, 3).map((o) => <span key={o}>{o}</span>)}
        </div>
      </div>
    </a>
  );
}

/* ---------- people, voices, numbers ---------- */
function PlayerCard({ item }: { item: Extract<FeedItem, { kind: 'player' }> }) {
  return (
    <div className="fd-player">
      <img src={item.img} alt={item.name} loading="lazy" />
      <span className="fd-player__team">FaZe {item.team}</span>
      <b className="fd-player__name">{item.name}</b>
    </div>
  );
}

function QuoteCard({ text, by }: { text: string; by: string }) {
  return (
    <div className="fd-quote">
      <FazeLogo className="fd-quote__mark" />
      <p>{text}</p>
      <small>{by}</small>
    </div>
  );
}

function VoiceCard({ item }: { item: Extract<FeedItem, { kind: 'voice' }> }) {
  return (
    <a className="fd-voice" href={threadHref(item.threadId)}>
      <span className="fd-voice__mark">“</span>
      <p>{item.excerpt}</p>
      <footer><Avatar name={item.author} /> @{item.author}<Src kind="hq" label="HQ replies" /></footer>
    </a>
  );
}

function BoardCard({ item }: { item: Extract<FeedItem, { kind: 'board' }> }) {
  return (
    <a className="fd-board" href="/leaderboards">
      <div className="fd-srcrow">
        <span className="fd-tag">Leaderboard</span>
        <Src kind="faceit" label="FACEIT stats" />
      </div>
      <h3>{item.label}</h3>
      <ol>
        {item.entries.map((e) => (
          <li key={e.handle}>
            <span className="fd-board__rank">{String(e.rank).padStart(2, '0')}</span>
            <Avatar name={e.display_name} url={e.avatar_url} />
            <span className="fd-board__name">{e.display_name}</span>
            <b>{e.value.toLocaleString()}</b>
          </li>
        ))}
      </ol>
    </a>
  );
}

function JoinCard({ user }: { user: SessionUser | null }) {
  return (
    <a className="fd-join" href={user ? '/community' : '/join'}>
      <FazeLogo className="fd-join__logo" />
      <h3>{user ? 'Got a take?' : 'FaZe up*'}</h3>
      <p>{user ? 'Start a thread. The fam is listening.' : 'Join the fam. Old heads and new blood.'}</p>
      <span className="fd-join__cta">{user ? 'Post →' : 'Join FaZe HQ →'}</span>
    </a>
  );
}

/* ---------- around the web: YouTube + Reddit (server: lib/social, cached) ---------- */
function YouTubeCard({ item }: { item: ExternalItem }) {
  const id = ytId(item.url);
  const title = item.title.replace(/\s*#\S+/g, '').trim() || item.title;
  return (
    <article className={`fd-yt ${item.short ? 'fd-yt--short' : ''}`}>
      <div className="fd-yt__media">
        <YtPreview id={id} thumb={item.thumbnail} title={title} short={item.short} />
        {item.short && <span className="fd-yt__kind">Short</span>}
      </div>
      <div className="fd-yt__body">
        <Src kind="youtube" label={`YouTube · ${item.channel}`} />
        <h3>{title}</h3>
        <small>
          {item.views ? `${compact(item.views)} views · ` : ''}
          {ago(item.published)} ago ·{' '}
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            Open ↗
          </a>
        </small>
      </div>
    </article>
  );
}

function RedditCard({ item }: { item: ExternalItem }) {
  return (
    <a className="fd-rd" href={item.url} target="_blank" rel="noopener noreferrer">
      <div className="fd-srcrow">
        <Src kind="reddit" label={`Reddit · ${item.channel}`} />
        <small className="fd-rd__time">{ago(item.published)}</small>
      </div>
      <h3>{item.title}</h3>
      {item.thumbnail && <img className="fd-rd__img" src={item.thumbnail} alt="" loading="lazy" />}
      {item.excerpt && <p>{item.excerpt}</p>}
      <footer>
        {item.author && <span>{item.author}</span>}
        <span className="fd-rd__cta">Join the thread on Reddit ↗</span>
      </footer>
    </a>
  );
}

/* ---------- play-in-feed: versus + trivia (local-only until there's an endpoint) ---------- */
function VersusCard({ vs }: { vs: Versus }) {
  const storeKey = `fd-vs:${vs.key}`;
  const [pick, setPick] = useState<number | null>(() => {
    const v = localStorage.getItem(storeKey);
    return v === null ? null : Number(v);
  });
  const choose = (i: number) => {
    setPick(i);
    localStorage.setItem(storeKey, String(i));
  };
  const votes = vs.base.map((b, i) => b * 37 + (pick === i ? 1 : 0));
  const total = votes[0] + votes[1];
  const pct = votes.map((v) => Math.round((v / total) * 100));
  return (
    <div className={`fd-vs ${pick !== null ? 'is-picked' : ''}`}>
      <p className="fd-vs__q"><span className="fd-tag">Versus</span>{vs.question}</p>
      <div className="fd-vs__sides">
        {vs.sides.map((side, i) => (
          <button
            key={side.label}
            type="button"
            className={`fd-vs__side ${pick === i ? 'is-mine' : ''} ${side.img ? 'has-img' : ''}`}
            onClick={() => choose(i)}
            aria-pressed={pick === i}
            style={{ ['--pct' as string]: `${pct[i]}%` } as CSSProperties}
          >
            {side.img && <img src={side.img} alt="" loading="lazy" />}
            <span className="fd-vs__label">{side.label}</span>
            <small>{side.sub}</small>
            {pick !== null && <b className="fd-vs__pct">{pct[i]}%</b>}
            <span className="fd-vs__fill" />
          </button>
        ))}
        <span className="fd-vs__x">VS</span>
      </div>
      <small className="fd-vs__foot">{pick === null ? 'Tap a side' : `${total.toLocaleString()} fans picked · old heads vs new blood`}</small>
    </div>
  );
}

function TriviaCard({ trivia }: { trivia: Trivia }) {
  const [pick, setPick] = useState<number | null>(null);
  const done = pick !== null;
  return (
    <div className={`fd-trivia ${done ? (pick === trivia.answer ? 'is-right' : 'is-wrong') : ''}`}>
      <span className="fd-tag">FaZe history · quick one</span>
      <h3>{trivia.question}</h3>
      <div className="fd-trivia__opts">
        {trivia.options.map((o, i) => (
          <button
            key={o}
            type="button"
            disabled={done}
            className={done && i === trivia.answer ? 'is-answer' : done && i === pick ? 'is-miss' : ''}
            onClick={() => setPick(i)}
          >
            <span>{String.fromCharCode(65 + i)}</span> {o}
          </button>
        ))}
      </div>
      {done && (
        <p className="fd-trivia__fact">
          <b>{pick === trivia.answer ? 'Day one energy.' : 'New blood, welcome.'}</b> {trivia.fact}
        </p>
      )}
    </div>
  );
}

export function FeedCard({ item, user, index }: { item: FeedItem; user: SessionUser | null; index: number }) {
  switch (item.kind) {
    case 'live': return <LiveCard />;
    case 'clip': return <ClipCard clip={item.clip} shape={item.shape} index={index} />;
    case 'thread': return <ThreadCard item={item} user={user} />;
    case 'challenge': return <ChallengeCard thread={item.thread} />;
    case 'watch': return <WatchCard room={item.room} />;
    case 'player': return <PlayerCard item={item} />;
    case 'quote': return <QuoteCard text={item.text} by={item.by} />;
    case 'voice': return <VoiceCard item={item} />;
    case 'board': return <BoardCard item={item} />;
    case 'join': return <JoinCard user={user} />;
    case 'versus': return <VersusCard vs={item.vs} />;
    case 'trivia': return <TriviaCard trivia={item.trivia} />;
    case 'yt': return <YouTubeCard item={item.item} />;
    case 'reddit': return <RedditCard item={item.item} />;
  }
}
