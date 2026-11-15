// Player stats storage/reads (player_stats hypertable) + FACEIT sync with seeded fallback.
import type { Db } from '../yao-deps.js';
import { getLifetimeStats, getPlayerByNickname, getRecentMatchStats } from './client.js';
import { normalize } from './metrics.js';

export async function getLatestStats(db: Db, userId: string): Promise<Record<string, number>> {
  const r = await db.query<{ metric: string; value: string }>(
    `SELECT DISTINCT ON (metric) metric, value FROM player_stats
      WHERE user_id = $1 AND game = 'cs2' ORDER BY metric, time DESC`,
    [userId],
  );
  return Object.fromEntries(r.rows.map((x) => [x.metric, Number(x.value)]));
}

/**
 * Daily trend per metric. Uses date_trunc so it runs on plain Postgres today;
 * on TigerData this can switch to time_bucket / a continuous aggregate.
 */
export async function getStatTrend(db: Db, userId: string, days = 30, metrics = ['elo', 'kd', 'hs_pct', 'adr', 'win_rate']) {
  const r = await db.query<{ day: string; metric: string; value: string }>(
    `SELECT date_trunc('day', time) AS day, metric, AVG(value) AS value
       FROM player_stats
      WHERE user_id = $1 AND game = 'cs2' AND metric = ANY($2::text[])
        AND time > now() - ($3 || ' days')::interval
      GROUP BY 1, 2 ORDER BY 1`,
    [userId, metrics, String(days)],
  );
  const byDay = new Map<string, Record<string, number | string>>();
  for (const row of r.rows) {
    const day = new Date(row.day).toISOString().slice(0, 10);
    const point = byDay.get(day) ?? { day };
    point[row.metric] = Math.round(Number(row.value) * 100) / 100;
    byDay.set(day, point);
  }
  return [...byDay.values()];
}

export async function insertSnapshot(db: Db, userId: string, values: Record<string, number | null | undefined>, time = new Date()) {
  const entries = Object.entries(values).filter(([, v]) => v != null && Number.isFinite(v)) as [string, number][];
  if (!entries.length) return 0;
  const params: unknown[] = [];
  const tuples = entries.map(([metric, value], i) => {
    params.push(time, userId, metric, value);
    return `($${i * 4 + 1}, $${i * 4 + 2}, 'cs2', $${i * 4 + 3}, $${i * 4 + 4})`;
  });
  await db.query(`INSERT INTO player_stats (time, user_id, game, metric, value) VALUES ${tuples.join(',')}`, params);
  return entries.length;
}

export interface SyncResult {
  source: 'faceit' | 'seed';
  nickname: string | null;
  stats: Record<string, number | null | undefined>;
  error?: string;
}

/**
 * Pull fresh FACEIT stats for a user's linked nickname and store a snapshot.
 * If FACEIT fails (no key, rate limit, not on FACEIT), return the latest seeded
 * stats instead so the UI never breaks.
 */
export async function syncFromFaceit(db: Db, userId: string): Promise<SyncResult> {
  const acc = await db.query<{ id: string; faceit_nickname: string | null }>(
    `SELECT id, faceit_nickname FROM game_accounts WHERE user_id = $1 AND game = 'cs2' LIMIT 1`,
    [userId],
  );
  const nickname = acc.rows[0]?.faceit_nickname ?? null;
  const fallback = async (error: string): Promise<SyncResult> => ({ source: 'seed', nickname, stats: await getLatestStats(db, userId), error });

  if (!nickname) return fallback('no FACEIT nickname linked');
  try {
    const player = await getPlayerByNickname(nickname);
    const [lifetime, recent] = await Promise.all([
      getLifetimeStats(player.player_id).catch(() => null),
      getRecentMatchStats(player.player_id, 20).catch(() => null),
    ]);
    const n = normalize(player, lifetime, recent);
    await insertSnapshot(db, userId, { ...n.last20, ...n.lifetime });
    await db.query(
      `UPDATE game_accounts SET faceit_player_id = $2, faceit_level = $3, faceit_elo = $4,
              region = COALESCE($5, region), steam_id64 = COALESCE($6, steam_id64)
        WHERE user_id = $1 AND game = 'cs2'`,
      [userId, player.player_id, n.last20.faceit_level, n.last20.elo, player.games?.cs2?.region ?? null, player.steam_id_64 ?? null],
    );
    return { source: 'faceit', nickname, stats: { ...n.last20, ...n.lifetime } };
  } catch (e) {
    console.warn(`[faceit] sync failed for ${nickname}:`, (e as Error).message);
    return fallback((e as Error).message);
  }
}
