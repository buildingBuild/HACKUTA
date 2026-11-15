import type { OnboardingData } from './types';

/**
 * Demo clip library generated from the onboarding answers.
 * Seeded by gamertag so the HQ collage and the profile show the same clips.
 * Replace with real rows from GET /api/clips once ingestion is wired.
 */

export type ClipCategory = 'highlights' | 'clutches' | 'funny' | 'content';

export interface ClipSource {
  key: 'upload' | 'twitch' | 'youtube' | 'psn' | 'xbox';
  label: string;
  icon: string;
}

export interface DemoClip {
  id: number;
  title: string;
  category: ClipCategory;
  map: [name: string, dark: string, light: string];
  source: ClipSource;
  time: string;
  score: number;
  rot: number;
  progress: number;
  kills: number;
}

export const CATEGORIES: { id: ClipCategory; label: string }[] = [
  { id: 'highlights', label: 'Highlights' },
  { id: 'clutches', label: 'Clutches' },
  { id: 'funny', label: 'Funny moments' },
  { id: 'content', label: 'Content' },
];

const PLAYS: Record<ClipCategory, string[]> = {
  highlights: ['Ace', 'Quad kill', 'AWP flick', 'Deagle one-tap', 'Entry frag', 'Spray transfer', 'Jump-spot AWP'],
  clutches: ['1v3 clutch', '1v2 clutch', 'Retake', 'Ninja defuse', '1v4 clutch'],
  funny: ['Zeus fail', 'Team flash', 'Knife chase', 'Chicken kill', 'Molly self-burn', 'Wallbang troll'],
  content: ['Stream highlight', 'Montage', 'Crosshair guide', 'Utility lineups', 'Ranked VOD'],
};

export const MAPS: DemoClip['map'][] = [
  ['Mirage', '#3b3227', '#c8a46a'],
  ['Inferno', '#3a2219', '#d2733a'],
  ['Nuke', '#1d2730', '#7f9db5'],
  ['Ancient', '#1c2a22', '#6f9a6a'],
  ['Dust II', '#3a3020', '#d9b878'],
  ['Anubis', '#182a2c', '#5fa7a3'],
  ['Overpass', '#23262b', '#9aa3ad'],
];

/** Clips uploaded straight to HQ under your gamertag (always available, no account linking) */
export const UPLOAD_SOURCE: ClipSource = { key: 'upload', label: 'your uploads', icon: '/brand/faze-logo.svg' };
export const PLATFORM_SOURCES: ClipSource[] = [
  { key: 'twitch', label: 'Twitch', icon: '/brand/social/twitch.svg' },
  { key: 'youtube', label: 'YouTube', icon: '/brand/social/youtube.svg' },
  { key: 'psn', label: 'PlayStation', icon: '/brand/social/playstation.svg' },
  { key: 'xbox', label: 'Xbox', icon: '/brand/social/xbox.svg' },
];

/** Your HQ uploads (always) + whichever platforms they linked */
export function linkedSources(data: OnboardingData): ClipSource[] {
  return [UPLOAD_SOURCE, ...PLATFORM_SOURCES.filter((s) => data[s.key as 'twitch'].trim())];
}

export function handleFor(source: ClipSource, data: OnboardingData): string {
  if (source.key === 'upload') return data.gamertag;
  if (source.key === 'youtube') return `@${data.youtube}`;
  return data[source.key];
}

// tiny seeded PRNG so results are stable per gamertag
function rng(seed: number) {
  let s = seed || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

export function makeClips(data: OnboardingData, count = 26): DemoClip[] {
  const r = rng([...data.gamertag].reduce((a, c) => a + c.charCodeAt(0), 7));
  const sources = linkedSources(data);
  const video = sources.filter((s) => s.key === 'youtube' || s.key === 'twitch');
  return Array.from({ length: count }, (_, i) => {
    const roll = r();
    const category: ClipCategory = roll < 0.4 ? 'highlights' : roll < 0.65 ? 'clutches' : roll < 0.83 ? 'funny' : 'content';
    const plays = PLAYS[category];
    // long-form "content" comes from YouTube/Twitch when linked
    const pool = category === 'content' && video.length ? video : sources;
    const secs = category === 'content' ? 0 : 8 + Math.floor(r() * 50);
    const mins = category === 'content' ? 4 + Math.floor(r() * 20) : 0;
    return {
      id: i,
      title: plays[Math.floor(r() * plays.length)],
      category,
      map: MAPS[Math.floor(r() * MAPS.length)],
      source: pool[Math.floor(r() * pool.length)],
      time: `${String(mins).padStart(2, '0')}:${String(secs || Math.floor(r() * 59)).padStart(2, '0')}`,
      score: category === 'funny' ? 40 + Math.floor(r() * 30) : 61 + Math.floor(r() * 35),
      rot: (r() - 0.5) * 14,
      progress: 20 + Math.floor(r() * 70),
      kills: category === 'funny' ? 1 : 1 + Math.floor(r() * 3),
    };
  });
}
