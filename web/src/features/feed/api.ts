// FaZe Feed data (Joe, experimental). Reads existing endpoints only, never writes or recomputes:
//   community threads + pulse + watch rooms (Dahiya), clips (shared), leaderboards (Omar), live (shared).
// Every source is optional: if a call fails the feed still fills with local cards (roster, quotes).
import { api } from '../../components/api';
import { authHeaders } from '../../components/session';
import type { Pulse, Thread, WatchRoom } from '../community/types';

export interface FeedClip {
  id: string;
  title: string;
  blob_url: string;
  thumbnail_url: string | null;
  map: string | null;
  handle: string;
  display_name: string;
  created_at: string;
}

export interface LeaderEntry {
  rank: number;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  faceit_level: number | null;
  value: number;
}

export interface ExternalItem {
  id: string;
  source: 'youtube' | 'reddit';
  channel: string;
  title: string;
  url: string;
  published: string;
  thumbnail: string | null;
  views: number | null;
  author: string | null;
  excerpt: string | null;
  short: boolean;
}

export type Shape = 'wide' | 'square' | 'tall';

export type FeedItem = { wide?: boolean } & (
  | { kind: 'live'; id: string }
  | { kind: 'thread'; id: string; thread: Thread; topic: string; tone: 'plain' | 'ink' | 'red' }
  | { kind: 'challenge'; id: string; thread: Thread }
  | { kind: 'clip'; id: string; clip: FeedClip; shape: Shape }
  | { kind: 'watch'; id: string; room: WatchRoom }
  | { kind: 'player'; id: string; name: string; img: string; team: string }
  | { kind: 'board'; id: string; label: string; unit: string; entries: LeaderEntry[] }
  | { kind: 'quote'; id: string; text: string; by: string }
  | { kind: 'voice'; id: string; excerpt: string; author: string; threadId: string }
  | { kind: 'join'; id: string }
  | { kind: 'versus'; id: string; vs: Versus }
  | { kind: 'trivia'; id: string; trivia: Trivia }
  | { kind: 'yt'; id: string; item: ExternalItem }
  | { kind: 'reddit'; id: string; item: ExternalItem }
);

export interface Versus {
  key: string;
  question: string;
  sides: [{ label: string; sub: string; img?: string }, { label: string; sub: string; img?: string }];
  /** seeded starting split so the bar isn't empty; the viewer's pick is stored locally */
  base: [number, number];
}

export interface Trivia {
  key: string;
  question: string;
  options: string[];
  answer: number;
  fact: string;
}


export type FeedKind = FeedItem['kind'];

const BOARDS: Record<string, string> = {
  clips: 'Clips',
  events: 'Events',
  'faze-cs2': 'CS2',
  'faze-history': 'FaZe History',
  'talent-watch': 'Talent Watch',
};

const ROSTER = [
  { name: 'Twistzz', img: '/games/cs2/roster/twistzz.webp', team: 'CS2' },
  { name: 'frozen', img: '/games/cs2/roster/frozen.webp', team: 'CS2' },
  { name: 'jcobbb', img: '/games/cs2/roster/jcobbb.webp', team: 'CS2' },
  { name: 'Neityu', img: '/games/cs2/roster/neityu.webp', team: 'CS2' },
  { name: 'JBOEN', img: '/games/cs2/roster/jboen.webp', team: 'CS2' },
  { name: 'Cyber', img: '/games/r6/roster/cyber.png', team: 'Rainbow Six' },
  { name: 'Soulz1', img: '/games/r6/roster/soulz1.png', team: 'Rainbow Six' },
  { name: 'babybay', img: '/games/valorant/roster/babybay.png', team: 'Valorant · former' },
  { name: 'Rossy', img: '/games/valorant/roster/rossy.png', team: 'Valorant · former' },
];

const QUOTES = [
  { text: 'FaZe up.', by: 'Day one' },
  { text: 'FaZe the f*ck up.', by: 'Every round win' },
  { text: '211,000+ applied to #FaZe5. The door never closed.', by: 'FaZe history' },
  { text: 'From montage kids to Major champions.', by: 'Antwerp 2022' },
  { text: 'Crosshair at head level. Always.', by: 'Fundamentals' },
  { text: 'Day one or day zero. Welcome home.', by: 'FaZe HQ' },
];

// Old fans vs new fans, head to head. Votes are local for now (no endpoint yet).
const VERSUS: Versus[] = [
  {
    key: 'era',
    question: 'Best FaZe era?',
    sides: [
      { label: 'Trickshot era', sub: '2010 · YouTube montages' },
      { label: 'Major champs', sub: '2022 · Antwerp' },
    ],
    base: [48, 52],
  },
  {
    key: 'mvp',
    question: 'Who carries tonight?',
    sides: [
      { label: 'Twistzz', sub: 'Rifler', img: '/games/cs2/roster/twistzz.webp' },
      { label: 'frozen', sub: 'Rifler', img: '/games/cs2/roster/frozen.webp' },
    ],
    base: [55, 45],
  },
  {
    key: 'style',
    question: 'Pick your playstyle',
    sides: [
      { label: 'Entry frag', sub: 'First in, loud' },
      { label: 'Lurk', sub: 'Last alive, cold' },
    ],
    base: [61, 39],
  },
];

// History that new fans learn and old heads flex. Facts kept to well-documented ones.
const TRIVIA: Trivia[] = [
  {
    key: 'founded',
    question: 'FaZe started in 2010 as a…',
    options: ['CS:GO team', 'Call of Duty trickshot crew', 'Twitch stream team'],
    answer: 1,
    fact: 'FaZe began as a trickshot montage channel on YouTube. Clips came first.',
  },
  {
    key: 'major',
    question: 'Who did FaZe beat in the Antwerp 2022 Major final?',
    options: ['NAVI', 'G2', 'Vitality'],
    answer: 0,
    fact: 'FaZe beat NAVI 2-0 in Antwerp for their first CS Major.',
  },
  {
    key: 'faze5',
    question: 'How many applied to #FaZe5 in 2020?',
    options: ['20,000+', '80,000+', '211,000+'],
    answer: 2,
    fact: 'Over 211,000 fans applied for a spot in FaZe. The door never closed.',
  },
];

const get = <T,>(path: string) => api<T>(path, { headers: authHeaders() });

export interface FeedSources {
  threads: { thread: Thread; topic: string }[];
  clips: FeedClip[];
  rooms: WatchRoom[];
  pulse: Pulse | null;
  board: { label: string; unit: string; entries: LeaderEntry[] } | null;
  external: ExternalItem[];
}

export async function loadSources(): Promise<FeedSources> {
  const threadCalls = Object.entries(BOARDS).map(([slug, topic]) =>
    get<{ data: Thread[] }>(`/api/communities/${slug}/threads?sort=hot`).then((r) => r.data.map((thread) => ({ thread, topic }))),
  );
  const [threads, clips, rooms, pulse, board, external] = await Promise.allSettled([
    Promise.allSettled(threadCalls).then((rs) => rs.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))),
    get<{ clips: FeedClip[] }>('/api/clips').then((r) => r.clips),
    get<{ data: WatchRoom[] }>('/api/community/watch/rooms').then((r) => r.data),
    get<{ data: Pulse }>('/api/community/pulse').then((r) => r.data),
    get<{ label: string; unit: string; entries: LeaderEntry[] }>('/api/leaderboards/elo'),
    get<{ items: ExternalItem[] }>('/api/clips/external').then((r) => r.items),
  ]);
  const ok = <T,>(r: PromiseSettledResult<T>, fallback: T) => (r.status === 'fulfilled' ? r.value : fallback);
  return {
    threads: ok(threads, []),
    clips: ok(clips, []),
    rooms: ok(rooms, []),
    pulse: ok(pulse, null),
    board: ok(board, null),
    external: ok(external, []),
  };
}

// seeded shuffle so a page is stable but each "page" of the endless scroll is ordered differently
function shuffle<T>(list: T[], seed: number): T[] {
  let s = seed * 9301 + 49297;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const SHAPES: Shape[] = ['tall', 'wide', 'square', 'wide', 'tall', 'square'];
const TONES = ['plain', 'plain', 'ink', 'plain', 'red', 'plain'] as const;

// Visual rhythm: media, words, people, media... so no two text cards sit together.
const PATTERN: FeedKind[] = [
  'yt', 'clip', 'thread', 'player', 'reddit', 'watch', 'quote', 'yt', 'clip', 'voice', 'challenge', 'thread', 'yt',
  'versus', 'reddit', 'board', 'player', 'thread', 'clip', 'yt', 'trivia', 'join', 'voice', 'watch', 'reddit', 'thread', 'clip', 'yt', 'player', 'quote', 'thread',
];

/** Builds one "page" of the feed. Page 0 opens with the live match card. */
export function buildPage(src: FeedSources, page: number): FeedItem[] {
  // watch-party rooms already get their own card; hide their backing threads from the text posts
  const roomThreads = new Set(src.rooms.map((r) => r.thread_id));
  const posts = shuffle(src.threads.filter((t) => t.thread.type !== 'challenge' && !roomThreads.has(t.thread.id)), page + 1);
  const challenges = shuffle(src.threads.filter((t) => t.thread.type === 'challenge'), page + 3);
  const clips = shuffle(src.clips, page + 5);
  const rooms = shuffle(src.rooms.filter((r) => r.media_url), page + 7);
  const roster = shuffle(ROSTER, page + 11);
  const quotes = shuffle(QUOTES, page + 13);
  const voices = shuffle(src.pulse?.perspectives ?? [], page + 17);
  // newest FaZe videos lead page 0; later pages dig further back
  const videos = src.external.filter((x) => x.source === 'youtube');
  const reddit = src.external.filter((x) => x.source === 'reddit');

  const take = <T,>(list: T[], i: number): T | undefined => (list.length ? list[i % list.length] : undefined);
  const n: Partial<Record<FeedKind, number>> = {};
  const next = (k: FeedKind) => (n[k] = (n[k] ?? -1) + 1);
  const key = (k: string, id: string) => `${page}:${k}:${id}`;

  const items: FeedItem[] = page === 0 ? [{ kind: 'live', id: 'live' }] : [];
  for (const kind of PATTERN) {
    const i = next(kind);
    switch (kind) {
      case 'thread': {
        const t = take(posts, i);
        if (t) items.push({ kind, id: key(kind, `${t.thread.id}:${i}`), thread: t.thread, topic: t.topic, tone: TONES[(i + page) % TONES.length] });
        break;
      }
      case 'challenge': {
        const t = page % 2 === 0 ? take(challenges, page / 2) : take(posts, i + 7);
        if (t && t.thread.type === 'challenge') items.push({ kind: 'challenge', id: key(kind, t.thread.id), thread: t.thread });
        else if (t) items.push({ kind: 'thread', id: key('thread', `${t.thread.id}:c`), thread: t.thread, topic: t.topic, tone: 'ink' });
        break;
      }
      case 'clip': {
        const c = take(clips, i);
        if (c) items.push({ kind, id: key(kind, `${c.id}:${i}`), clip: c, shape: SHAPES[(i + page * 2) % SHAPES.length] });
        break;
      }
      case 'watch': {
        const r = take(rooms, i);
        if (r) items.push({ kind, id: key(kind, r.id), room: r });
        break;
      }
      case 'player': {
        const p = take(roster, i);
        if (p) items.push({ kind, id: key(kind, p.name), ...p });
        break;
      }
      case 'quote': {
        const q = take(quotes, i);
        if (q) items.push({ kind, id: key(kind, q.text), ...q });
        break;
      }
      case 'voice': {
        const v = take(voices, i);
        if (v) items.push({ kind, id: key(kind, v.comment_id), excerpt: v.excerpt, author: v.author, threadId: v.thread_id });
        break;
      }
      case 'board':
        if (page % 2 === 0 && src.board?.entries.length) items.push({ kind, id: key(kind, 'elo'), label: src.board.label, unit: src.board.unit, entries: src.board.entries.slice(0, 5) });
        break;
      case 'join':
        items.push({ kind, id: key(kind, 'join') });
        break;
      case 'yt': {
        const v = videos[page * 6 + i];
        if (v) items.push({ kind, id: key(kind, v.id), item: v });
        break;
      }
      case 'reddit': {
        const r = reddit[page * 3 + i];
        if (r) items.push({ kind, id: key(kind, r.id), item: r });
        break;
      }
      case 'versus': {
        const v = VERSUS[(page + i) % VERSUS.length];
        items.push({ kind, id: key(kind, v.key), vs: v });
        break;
      }
      case 'trivia': {
        const t = TRIVIA[(page + i) % TRIVIA.length];
        items.push({ kind, id: key(kind, t.key), trivia: t });
        break;
      }
    }
  }
  // two-column feature cards: the live match, every other watch party, the versus, the first quote
  let watch = 0;
  let quote = 0;
  for (const it of items) {
    if (it.kind === 'live' || it.kind === 'versus') it.wide = true;
    if (it.kind === 'watch' && watch++ % 2 === 0) it.wide = true;
    if (it.kind === 'quote' && quote++ === 0) it.wide = true;
    if (it.kind === 'yt' && !it.item.short && (it.item.views ?? 0) > 100_000) it.wide = true;
  }
  return items;
}

/** One-line activity strings for the ticker. */
export function activity(src: FeedSources): string[] {
  const lines: string[] = [];
  const fmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));
  for (const v of src.external.filter((x) => x.source === 'youtube').slice(0, 3))
    lines.push(`${v.channel} on YouTube: “${v.title.replace(/\s*#\S+/g, '').trim() || v.title}”${v.views ? ` · ${fmt(v.views)} views` : ''}`);
  for (const r of src.external.filter((x) => x.source === 'reddit').slice(0, 2)) lines.push(`${r.channel}: “${r.title}”`);
  const clips = [...src.clips].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 6);
  const threads = [...src.threads].sort((a, b) => Date.parse(b.thread.created_at) - Date.parse(a.thread.created_at)).slice(0, 6);
  for (let i = 0; i < 6; i++) {
    const c = clips[i];
    const t = threads[i];
    if (c) lines.push(`@${c.handle} posted “${c.title}”`);
    if (t) lines.push(`@${t.thread.author.handle} in #${t.topic}: “${t.thread.title}”`);
  }
  if (src.board?.entries[0]) lines.push(`${src.board.entries[0].display_name} leads FACEIT ELO at ${src.board.entries[0].value.toLocaleString()}`);
  return lines;
}
