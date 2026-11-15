// Cached coaching reports so the demo survives bad Wi-Fi / rate limits.
// Lookup key = clip file name without extension (e.g. ".../prospect-great-clip.mp4").
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CoachingReportSchema, type CoachingReport } from '../coachingSchema.js';

const raw = JSON.parse(
  readFileSync(fileURLToPath(new URL('./reports.json', import.meta.url)), 'utf8'),
) as Record<string, unknown>;

const cache: Record<string, CoachingReport> = Object.fromEntries(
  Object.entries(raw).map(([k, v]) => [k, CoachingReportSchema.parse(v)]),
);

export function cacheKeyFor(clipUrl: string): string {
  const name = clipUrl.split(/[\\/]/).pop() ?? clipUrl;
  return name.replace(/\?.*$/, '').replace(/\.[a-z0-9]+$/i, '');
}

/** Exact cached report for a demo clip, or null. */
export function getCachedReport(clipUrl: string): CoachingReport | null {
  return cache[cacheKeyFor(clipUrl)] ?? null;
}

/** Generic report used when the live call fails and there's no exact match. */
export function getFallbackReport(): CoachingReport {
  return cache._fallback;
}

export function listCachedKeys(): string[] {
  return Object.keys(cache).filter((k) => !k.startsWith('_'));
}
