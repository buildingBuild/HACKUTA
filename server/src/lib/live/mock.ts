// Mock FaZe Live source (Phase 1). Deterministic from the clock, so every viewer sees the same
// "match" progress without a server-side loop. Phase 2 swaps this for the event bus (director
// console / match feed) behind the same LiveSnapshot shape (shared/types.ts).
import type { LiveCounters, LiveEvent, LiveStatus } from '../../../../shared/types.js';
import type { Db } from '../yao-deps.js';

const CYCLE_S = 50 * 60; // one demo match every 50 minutes
const LIVE_S = 40 * 60; // ...live for 40 of them
const ROUND_S = 95; // a round every ~95s
const OPPONENTS = ['Vitality', 'NAVI', 'MOUZ', 'Team Spirit', 'G2', 'Team Liquid'];

function hash(n: number): number {
  let h = (n ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function mockStatus(now = Date.now()): LiveStatus {
  const t = Math.floor(now / 1000);
  const cycle = Math.floor(t / CYCLE_S);
  const into = t - cycle * CYCLE_S;
  const opponent = OPPONENTS[cycle % OPPONENTS.length]!;
  const startedAt = cycle * CYCLE_S * 1000;

  if (into >= LIVE_S) {
    return {
      live: false, game: 'cs2', opponent: OPPONENTS[(cycle + 1) % OPPONENTS.length]!, event: 'Demo match',
      score: { faze: 0, opp: 0 }, startedAt: null, nextMatchAt: (cycle + 1) * CYCLE_S * 1000, lastEvent: null, source: 'mock',
    };
  }

  // Play rounds up to now; FaZe takes ~58% of rounds. First to 13 wins (MR12).
  const score = { faze: 0, opp: 0 };
  let lastEvent: LiveEvent | null = null;
  const rounds = Math.floor(into / ROUND_S);
  for (let r = 0; r < rounds && score.faze < 13 && score.opp < 13; r++) {
    const fazeWins = hash(cycle * 100 + r) < 0.58;
    if (fazeWins) score.faze++;
    else score.opp++;
    const ace = fazeWins && hash(cycle * 977 + r) < 0.08;
    const over = score.faze === 13 || score.opp === 13;
    lastEvent = {
      id: `mock-${cycle}-${r}`,
      type: over ? (fazeWins ? 'match_win' : 'match_loss') : ace ? 'ace' : fazeWins ? 'round_win' : 'round_loss',
      game: 'cs2', opponent, score: { ...score }, ts: startedAt + (r + 1) * ROUND_S * 1000,
    };
  }
  const over = score.faze === 13 || score.opp === 13;
  if (!lastEvent) lastEvent = { id: `mock-${cycle}-start`, type: 'match_start', game: 'cs2', opponent, score: { ...score }, ts: startedAt };
  return { live: !over, game: 'cs2', opponent, event: 'Demo match', score, startedAt, nextMatchAt: over ? (cycle + 1) * CYCLE_S * 1000 : null, lastEvent, source: 'mock' };
}

/** Real counts where the tables have data, plus a believable daily baseline so the Home page isn't dead. */
export async function liveCounters(db: Db, now = Date.now()): Promise<LiveCounters> {
  const d = new Date(now);
  const secs = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  let real = { pixels: 0, guessers: 0, users: 0 };
  try {
    const q = await db.query<{ pixels: string; guessers: string; users: string }>(
      `SELECT (SELECT count(*) FROM pixel_events WHERE time >= date_trunc('day', now())) AS pixels,
              (SELECT count(DISTINCT user_id) FROM guessr_guesses WHERE created_at >= date_trunc('day', now())) AS guessers,
              (SELECT count(*) FROM users) AS users`,
    );
    const row = q.rows[0];
    if (row) real = { pixels: Number(row.pixels), guessers: Number(row.guessers), users: Number(row.users) };
  } catch {
    /* tables missing on an old DB: baseline only */
  }
  const wave = Math.sin(now / 600_000) * 40;
  return {
    pixelsToday: real.pixels + Math.floor(secs * 1.7),
    setupsSynced: 1280 + Math.floor((now / 86_400_000) % 365) * 7 + Math.floor(secs / 900),
    guessersToday: real.guessers + Math.floor(secs / 38),
    fansOnline: Math.max(real.users, Math.round(420 + wave + (secs % 97))),
  };
}
