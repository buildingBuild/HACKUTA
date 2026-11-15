// Normalize FACEIT responses into our player_stats metric names:
//   faceit_level, elo, kd, kr, hs_pct, adr, win_rate, matches (last 20), plus lifetime_* values.
import type { FaceitLifetimeStats, FaceitMatchStats, FaceitPlayer } from './client.js';

export const METRICS = ['faceit_level', 'elo', 'kd', 'kr', 'hs_pct', 'adr', 'win_rate', 'matches'] as const;
export type MetricName = (typeof METRICS)[number];

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace('%', '').trim());
  return Number.isFinite(n) ? n : null;
};

const pick = (obj: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) {
    const v = num(obj[k]);
    if (v != null) return v;
  }
  return null;
};

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const round = (x: number | null, d = 2) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);

export interface NormalizedStats {
  last20: Partial<Record<MetricName, number | null>>;
  lifetime: Record<string, number | null>;
}

export function normalize(player: FaceitPlayer, lifetime: FaceitLifetimeStats | null, recent: FaceitMatchStats | null): NormalizedStats {
  const cs2 = player.games?.cs2 ?? {};
  const items = recent?.items?.map((i) => i.stats as Record<string, unknown>) ?? [];

  const kills = items.map((s) => pick(s, 'Kills'));
  const deaths = items.map((s) => pick(s, 'Deaths'));
  const totalK = kills.reduce<number>((a, b) => a + (b ?? 0), 0);
  const totalD = deaths.reduce<number>((a, b) => a + (b ?? 0), 0);
  const wins = items.map((s) => {
    const r = s['Result'];
    return r == null ? null : String(r) === '1' ? 1 : 0;
  });

  const last20: NormalizedStats['last20'] = {
    faceit_level: cs2.skill_level ?? null,
    elo: cs2.faceit_elo ?? null,
    // Aggregate K/D from totals is more honest than averaging per-match ratios.
    kd: round(totalD > 0 ? totalK / totalD : avg(items.map((s) => pick(s, 'K/D Ratio')))),
    kr: round(avg(items.map((s) => pick(s, 'K/R Ratio')))),
    hs_pct: round(avg(items.map((s) => pick(s, 'Headshots %'))), 1),
    adr: round(avg(items.map((s) => pick(s, 'ADR'))), 1),
    win_rate: round((avg(wins) ?? NaN) * 100, 1),
    matches: items.length,
  };
  if (last20.win_rate != null && Number.isNaN(last20.win_rate)) last20.win_rate = null;

  const lt = (lifetime?.lifetime ?? {}) as Record<string, unknown>;
  return {
    last20,
    lifetime: {
      lifetime_kd: pick(lt, 'Average K/D Ratio', 'K/D Ratio'),
      lifetime_hs_pct: pick(lt, 'Average Headshots %'),
      lifetime_win_rate: pick(lt, 'Win Rate %'),
      lifetime_matches: pick(lt, 'Matches'),
    },
  };
}
