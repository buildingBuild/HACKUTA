// Mock FACEIT (FACEIT_MODE=mock, the default when there's no FACEIT_API_KEY).
// Behaves like a real sync: existing players "play a few matches" (small, upward-biased
// drift so a demo prospect never falls back under the bar); new accounts get a
// believable baseline + 30 days of history derived from their nickname.
import type { Db } from '../yao-deps.js';
import { insertSnapshot } from './stats.js';

/** FACEIT CS2 skill levels by ELO. */
export function levelForElo(elo: number): number {
  const bands = [500, 750, 900, 1050, 1200, 1350, 1530, 1750, 2000];
  const i = bands.findIndex((max) => elo <= max);
  return i === -1 ? 10 : i + 1;
}

function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
function rng(seed: number) {
  let s = seed || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface MockStats {
  faceit_level: number;
  elo: number;
  kd: number;
  kr: number;
  hs_pct: number;
  adr: number;
  win_rate: number;
  matches: number;
}

/** Stats that roughly track ELO, like real FACEIT distributions. */
function baselineFor(nickname: string): MockStats {
  const r = rng(hash(nickname.toLowerCase()));
  const elo = Math.round(900 + r() * 1400); // L4..L10
  const t = (elo - 900) / 1400; // 0..1 skill
  return {
    elo,
    faceit_level: levelForElo(elo),
    kd: round(0.9 + t * 0.35 + (r() - 0.5) * 0.1),
    kr: round(0.62 + t * 0.22 + (r() - 0.5) * 0.05),
    hs_pct: round(38 + t * 14 + (r() - 0.5) * 4, 1),
    adr: round(68 + t * 18 + (r() - 0.5) * 5, 1),
    win_rate: round(47 + t * 10 + (r() - 0.5) * 6, 1),
    matches: 20,
  };
}

function drift(prev: Partial<MockStats>, r: () => number): MockStats {
  const elo = Math.round((prev.elo ?? 1500) + (r() * 30 - 6)); // about -6..+24 over a few matches
  return {
    elo,
    faceit_level: levelForElo(elo),
    kd: round(clamp((prev.kd ?? 1) * (1 + (r() * 0.035 - 0.008)), 0.5, 2.5)),
    kr: round(clamp((prev.kr ?? 0.7) * (1 + (r() * 0.03 - 0.008)), 0.4, 1.5)),
    hs_pct: round(clamp((prev.hs_pct ?? 45) + (r() * 1.6 - 0.4), 20, 75), 1),
    adr: round(clamp((prev.adr ?? 75) + (r() * 2.4 - 0.6), 40, 130), 1),
    win_rate: round(clamp((prev.win_rate ?? 50) + (r() * 3 - 1.2), 30, 80), 1),
    matches: 20,
  };
}

export interface MockSyncResult {
  stats: MockStats;
  newMatches: number;
  backfilled: boolean;
}

export async function mockSync(db: Db, userId: string, nickname: string): Promise<MockSyncResult> {
  const latestQ = await db.query<{ metric: string; value: string }>(
    `SELECT DISTINCT ON (metric) metric, value FROM player_stats
      WHERE user_id = $1 AND game = 'cs2' ORDER BY metric, time DESC`,
    [userId],
  );
  const latest = Object.fromEntries(latestQ.rows.map((x) => [x.metric, Number(x.value)])) as Partial<MockStats>;
  const r = rng(hash(nickname) ^ Date.now());
  let backfilled = false;

  if (latest.elo == null) {
    // New account: write 30 days of history ending at the baseline so charts aren't empty.
    const base = baselineFor(nickname);
    for (let d = 30; d >= 1; d--) {
      const k = 1 - (d / 30) * 0.08; // start ~8% lower, climb to today
      const day = {
        elo: Math.round(base.elo * k),
        kd: round(base.kd * (0.95 + 0.05 * (1 - d / 30)) * (1 + (r() - 0.5) * 0.04)),
        kr: round(base.kr * (1 + (r() - 0.5) * 0.04)),
        hs_pct: round(base.hs_pct * (1 + (r() - 0.5) * 0.05), 1),
        adr: round(base.adr * (0.96 + 0.04 * (1 - d / 30)) * (1 + (r() - 0.5) * 0.04), 1),
        win_rate: round(base.win_rate * (1 + (r() - 0.5) * 0.06), 1),
      };
      await insertSnapshot(db, userId, { ...day, faceit_level: levelForElo(day.elo), matches: 20 }, new Date(Date.now() - d * 86400_000));
    }
    Object.assign(latest, base);
    backfilled = true;
  }

  const stats = drift(latest, r);
  await insertSnapshot(db, userId, { ...stats });
  await db.query(
    `UPDATE game_accounts SET faceit_level = $2, faceit_elo = $3, region = COALESCE(region, 'NA'),
            faceit_player_id = COALESCE(faceit_player_id, $4)
      WHERE user_id = $1 AND game = 'cs2'`,
    [userId, stats.faceit_level, stats.elo, `mock-${hash(nickname).toString(16)}`],
  );
  return { stats, newMatches: 2 + Math.floor(r() * 4), backfilled };
}
