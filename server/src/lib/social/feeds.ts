// External FaZe content for the feed (owner: Joe). No API keys needed:
//   YouTube channel RSS  (https://www.youtube.com/feeds/videos.xml?channel_id=...)
//   Reddit RSS           (https://www.reddit.com/r/<sub>/.rss, search.rss)
// Demo safety: 15-minute memory cache, then the last good result, then a bundled snapshot.json
// (real items captured earlier) so the feed never goes empty on hackathon Wi-Fi or a Reddit 429.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type ExternalSource = 'youtube' | 'reddit';

export interface ExternalItem {
  id: string;
  source: ExternalSource;
  /** where it came from, e.g. "FaZe Esports" or "r/FaZeClan" */
  channel: string;
  title: string;
  url: string;
  published: string;
  thumbnail: string | null;
  views: number | null;
  author: string | null;
  excerpt: string | null;
  /** YouTube Shorts (vertical) */
  short: boolean;
}

export const YOUTUBE_CHANNELS = [
  { id: 'UCLtSNxtLXu61XvIa0TpwP2w', name: 'FaZe Esports' },
  { id: 'UCNdpD9V0PIrH1glUJ6RG4-w', name: 'FaZe Clan' },
];

// r/FaZeClan is inactive (last posts 2020), so we search the active CS subs for FaZe instead.
export const REDDIT_FEEDS = [
  { url: 'https://www.reddit.com/r/GlobalOffensive/search.rss?q=faze&restrict_sr=1&sort=top&t=month&limit=15', name: 'r/GlobalOffensive' },
  { url: 'https://www.reddit.com/r/cs2/search.rss?q=faze&restrict_sr=1&sort=top&t=year&limit=10', name: 'r/cs2' },
];

const UA = 'Mozilla/5.0 (compatible; FaZeHQ-hackathon/0.1)';
const TTL = 15 * 60_000;

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/[\u200b\u00a0]/g, ' ');

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]).trim() : null;
};
const attr = (xml: string, name: string, a: string) => xml.match(new RegExp(`<${name}[^>]*\\s${a}="([^"]*)"`))?.[1] ?? null;
const entries = (xml: string) => xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

export async function fetchYouTube(channel: { id: string; name: string }): Promise<ExternalItem[]> {
  const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`);
  return entries(xml).map((e) => {
    const vid = tag(e, 'yt:videoId') ?? '';
    const link = attr(e, 'link', 'href') ?? `https://www.youtube.com/watch?v=${vid}`;
    const title = tag(e, 'title') ?? '';
    return {
      id: `yt:${vid}`,
      source: 'youtube' as const,
      channel: channel.name,
      title,
      url: link,
      published: tag(e, 'published') ?? new Date().toISOString(),
      thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
      views: Number(attr(e, 'media:statistics', 'views')) || null,
      author: channel.name,
      excerpt: null,
      short: link.includes('/shorts/') || /#(cs2|csgo|shorts)\b/i.test(title),
    };
  });
}

export async function fetchReddit(feed: { url: string; name: string }): Promise<ExternalItem[]> {
  const xml = await fetchText(feed.url);
  return entries(xml).map((e) => {
    const html = decode(tag(e, 'content') ?? '');
    const text = html
      .replace(/<[^>]+>/g, ' ')
      .replace(/submitted by[\s\S]*$/i, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const thumb = attr(e, 'media:thumbnail', 'url') ?? html.match(/<img src="([^"]+)"/)?.[1] ?? null;
    return {
      id: `rd:${tag(e, 'id') ?? attr(e, 'link', 'href')}`,
      source: 'reddit' as const,
      channel: feed.name,
      title: tag(e, 'title') ?? '',
      url: attr(e, 'link', 'href') ?? '',
      published: tag(e, 'updated') ?? tag(e, 'published') ?? new Date().toISOString(),
      thumbnail: thumb ? decode(thumb) : null,
      views: null,
      author: tag(e, 'name')?.replace(/^\/u\//, 'u/') ?? null,
      excerpt: text ? text.slice(0, 220) : null,
      short: false,
    };
  });
}

/** Fetch every source in parallel; a failed source just contributes nothing. */
export async function fetchAll(): Promise<ExternalItem[]> {
  const jobs = [...YOUTUBE_CHANNELS.map(fetchYouTube), ...REDDIT_FEEDS.map(fetchReddit)];
  const results = await Promise.allSettled(jobs);
  results.forEach((r) => r.status === 'rejected' && console.warn('[social]', (r.reason as Error).message));
  const seen = new Set<string>();
  return results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .filter((i) => i.title && !seen.has(i.id) && seen.add(i.id))
    .sort((a, b) => Date.parse(b.published) - Date.parse(a.published));
}

// ---- cache + fallbacks ----
const here = path.dirname(fileURLToPath(import.meta.url));
let snapshot: ExternalItem[] | null = null;
const loadSnapshot = (): ExternalItem[] => {
  if (snapshot) return snapshot;
  try {
    snapshot = JSON.parse(readFileSync(path.join(here, 'snapshot.json'), 'utf8')) as ExternalItem[];
  } catch {
    snapshot = [];
  }
  return snapshot;
};

let cache: { at: number; items: ExternalItem[] } | null = null;
let pending: Promise<ExternalItem[]> | null = null;

export type ExternalMode = 'live' | 'cached' | 'snapshot';

export async function getExternal(): Promise<{ items: ExternalItem[]; mode: ExternalMode; fetched_at: string | null }> {
  if (cache && Date.now() - cache.at < TTL) return { items: cache.items, mode: 'live', fetched_at: new Date(cache.at).toISOString() };
  pending ??= fetchAll().finally(() => (pending = null));
  try {
    const items = await pending;
    // keep per-source fallbacks: if Reddit 429s, reuse the last good (or snapshot) Reddit items
    const have = new Set(items.map((i) => i.source));
    const backup = (cache?.items ?? loadSnapshot()).filter((i) => !have.has(i.source));
    const merged = [...items, ...backup].sort((a, b) => Date.parse(b.published) - Date.parse(a.published));
    if (merged.length) {
      cache = { at: Date.now(), items: merged };
      return { items: merged, mode: backup.length ? 'cached' : 'live', fetched_at: new Date().toISOString() };
    }
  } catch (e) {
    console.warn('[social] fetch failed', (e as Error).message);
  }
  if (cache) return { items: cache.items, mode: 'cached', fetched_at: new Date(cache.at).toISOString() };
  return { items: loadSnapshot(), mode: 'snapshot', fetched_at: null };
}
