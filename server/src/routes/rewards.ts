// FaZe Points (owner: Omar): challenges earn points, the store spends them on merch or coaching sessions.
//   GET  /api/rewards/me                          balance, challenges + progress, history, redemptions
//   GET  /api/rewards/catalog                     store items (public)
//   POST /api/rewards/challenges/:id/claim        claim a completed challenge
//   POST /api/rewards/redeem { reward_id, option? }
//   GET  /api/rewards/coaching-credits            { credits }  (for the coaching page)
//   POST /api/rewards/coaching-credits/use        spend one credit on a booking (402 if none)
// Challenges are daily (reset 00:00 UTC) or weekly (reset Monday 00:00 UTC) and can be claimed once per period.
// Progress is read from existing tables (clips, threads, comments, votes); nothing is recomputed elsewhere.
// Challenge definitions live in config/challenges.json.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import type { Pool, PoolClient } from 'pg';
import type { AuthDeps } from '../lib/yao-deps.js';

type Metric = 'clips' | 'clip_reactions' | 'threads' | 'comments';
type Period = 'daily' | 'weekly';
interface Challenge {
  id: string;
  title: string;
  blurb: string;
  metric: Metric;
  target: number;
  points: number;
  period: Period;
}
interface ChallengeConfig {
  welcome_bonus: number;
  challenges: Challenge[];
}

const CONFIG_PATH = fileURLToPath(new URL('../config/challenges.json', import.meta.url));
function loadConfig(): ChallengeConfig {
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as ChallengeConfig;
}

/** Monday 00:00 UTC of the current week. */
export function weekStart(now = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d;
}
/** 00:00 UTC today. */
export function dayStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
const periodStart = (p: Period) => (p === 'daily' ? dayStart() : weekStart());
const periodEnd = (p: Period) => new Date(periodStart(p).getTime() + (p === 'daily' ? 1 : 7) * 86400_000);
const claimKey = (c: Challenge) => `${c.id}@${periodStart(c.period).toISOString().slice(0, 10)}`;
/** Best case points per week if a fan finishes every challenge. */
const weeklyPotential = (cfg: ChallengeConfig) =>
  cfg.challenges.reduce((n, c) => n + c.points * (c.period === 'daily' ? 7 : 1), 0);

type Metrics = Record<Metric, number>;

/**
 * Every metric for one user since `since`. Clip "reactions" = upvotes from other fans on Community
 * threads/comments that share clips the user posted since `since` (swap this subquery if clips get their own reactions).
 */
async function metricsFor(db: Pool | PoolClient, userId: string, since: Date): Promise<Metrics> {
  const r = await db.query(
    `SELECT
       (SELECT count(*) FROM clips WHERE user_id = $1 AND created_at >= $2)::int AS clips,
       (SELECT count(*) FROM votes v
          WHERE v.value = 1 AND v.user_id <> $1 AND (
            (v.target_type = 'thread' AND v.target_id IN
               (SELECT t.id FROM threads t JOIN clips c ON c.id = t.clip_id WHERE c.user_id = $1 AND c.created_at >= $2))
            OR (v.target_type = 'comment' AND v.target_id IN
               (SELECT cm.id FROM comments cm JOIN clips c ON c.id = cm.clip_id WHERE c.user_id = $1 AND c.created_at >= $2))))::int AS clip_reactions,
       (SELECT count(*) FROM threads WHERE user_id = $1 AND created_at >= $2)::int AS threads,
       (SELECT count(*) FROM comments WHERE user_id = $1 AND created_at >= $2)::int AS comments`,
    [userId, since],
  );
  const row = r.rows[0] ?? {};
  const out = {} as Metrics;
  for (const k of ['clips', 'clip_reactions', 'threads', 'comments'] as Metric[]) out[k] = Number(row[k] ?? 0);
  return out;
}

async function balanceOf(db: Pool | PoolClient, userId: string): Promise<number> {
  const r = await db.query(`SELECT COALESCE(sum(delta), 0)::int AS balance FROM point_events WHERE user_id = $1`, [userId]);
  return Number(r.rows[0]?.balance ?? 0);
}

async function progressFor(db: Pool | PoolClient, userId: string | null, cfg: ChallengeConfig) {
  const zero = { clips: 0, clip_reactions: 0, threads: 0, comments: 0 } as Metrics;
  const [today, thisWeek, claims] = userId
    ? await Promise.all([
        metricsFor(db, userId, dayStart()),
        metricsFor(db, userId, weekStart()),
        db
          .query(`SELECT challenge_id FROM challenge_claims WHERE user_id = $1 AND claimed_at >= $2`, [userId, weekStart()])
          .then((r) => new Set(r.rows.map((x) => String(x.challenge_id)))),
      ])
    : [zero, zero, new Set<string>()];
  return cfg.challenges.map((c) => {
    const value = (c.period === 'daily' ? today : thisWeek)[c.metric];
    const claimed = claims.has(claimKey(c));
    return {
      ...c,
      progress: Math.min(value, c.target),
      value,
      claimed,
      claimable: Boolean(userId) && !claimed && value >= c.target,
      resets_at: periodEnd(c.period).toISOString(),
    };
  });
}

export function createRewardsRouter({ db, auth }: { db: Pool; auth: AuthDeps }): Router {
  const r = Router();
  r.use(auth.identify);

  r.get('/catalog', async (_req, res) => {
    try {
      const q = await db.query(
        `SELECT id, kind, name, blurb, cost, stock, options, art FROM rewards WHERE active ORDER BY sort, cost`,
      );
      res.json({ rewards: q.rows });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'failed to load the store' });
    }
  });

  r.get('/me', async (req, res) => {
    const uid = req.user?.id ?? null;
    try {
      const cfg = loadConfig();
      if (uid) {
        // first visit: a welcome bonus so every fan starts with something to spend
        const has = await db.query(`SELECT 1 FROM point_events WHERE user_id = $1 LIMIT 1`, [uid]);
        if (!has.rowCount && cfg.welcome_bonus > 0) {
          await db.query(`INSERT INTO point_events (user_id, delta, kind, reason) VALUES ($1, $2, 'bonus', 'Welcome to FaZe HQ')`, [uid, cfg.welcome_bonus]);
        }
      }
      const [challenges, balance, history, redemptions] = await Promise.all([
        progressFor(db, uid, cfg),
        uid ? balanceOf(db, uid) : Promise.resolve(null),
        uid
          ? db.query(`SELECT time, delta, kind, reason FROM point_events WHERE user_id = $1 ORDER BY time DESC LIMIT 12`, [uid]).then((q) => q.rows)
          : Promise.resolve([]),
        uid
          ? db
              .query(
                `SELECT d.id, d.reward_id, d.cost, d.option, d.status, d.created_at, d.used_at, w.name, w.kind, w.art
                   FROM redemptions d JOIN rewards w ON w.id = d.reward_id
                  WHERE d.user_id = $1 ORDER BY d.created_at DESC LIMIT 20`,
                [uid],
              )
              .then((q) => q.rows)
          : Promise.resolve([]),
      ]);
      const coaching_credits = redemptions.filter((d) => d.kind === 'coaching' && d.status === 'requested').length;
      res.json({
        signed_in: Boolean(uid),
        balance,
        day_resets_at: periodEnd('daily').toISOString(),
        week_resets_at: periodEnd('weekly').toISOString(),
        weekly_potential: weeklyPotential(cfg),
        challenges,
        history,
        redemptions,
        coaching_credits,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'failed to load points' });
    }
  });

  r.post('/challenges/:id/claim', async (req, res) => {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ error: 'sign in to claim points' });
    const cfg = loadConfig();
    const c = cfg.challenges.find((x) => x.id === req.params.id);
    if (!c) return res.status(404).json({ error: 'unknown challenge' });
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`points:${uid}`]);
      const m = await metricsFor(client, uid, periodStart(c.period));
      if (m[c.metric] < c.target) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `not done yet: ${m[c.metric]} of ${c.target}` });
      }
      const key = claimKey(c);
      const ins = await client.query(
        `INSERT INTO challenge_claims (user_id, challenge_id, points) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING challenge_id`,
        [uid, key, c.points],
      );
      if (!ins.rowCount) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: c.period === 'daily' ? 'already claimed today' : 'already claimed this week' });
      }
      await client.query(`INSERT INTO point_events (user_id, delta, kind, reason, ref) VALUES ($1, $2, 'challenge', $3, $4)`, [uid, c.points, c.title, key]);
      const balance = await balanceOf(client, uid);
      await client.query('COMMIT');
      res.json({ claimed: c.id, points: c.points, balance });
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(e);
      res.status(500).json({ error: 'failed to claim' });
    } finally {
      client.release();
    }
  });

  r.post('/redeem', async (req, res) => {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ error: 'sign in to redeem' });
    const rewardId = typeof req.body?.reward_id === 'string' ? req.body.reward_id : '';
    const option = typeof req.body?.option === 'string' ? req.body.option.slice(0, 20) : null;
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`points:${uid}`]);
      const w = await client.query(`SELECT id, kind, name, cost, stock, options FROM rewards WHERE id = $1 AND active FOR UPDATE`, [rewardId]);
      const reward = w.rows[0];
      if (!reward) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'unknown item' });
      }
      const opts: string[] = Array.isArray(reward.options) ? reward.options : [];
      if (opts.length && (!option || !opts.includes(option))) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `pick one of: ${opts.join(', ')}` });
      }
      if (reward.stock !== null && reward.stock <= 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'sold out' });
      }
      const balance = await balanceOf(client, uid);
      if (balance < reward.cost) {
        await client.query('ROLLBACK');
        return res.status(402).json({ error: `not enough points: ${balance} of ${reward.cost}`, balance });
      }
      if (reward.stock !== null) await client.query(`UPDATE rewards SET stock = stock - 1 WHERE id = $1`, [reward.id]);
      const d = await client.query(
        `INSERT INTO redemptions (user_id, reward_id, cost, option) VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
        [uid, reward.id, reward.cost, opts.length ? option : null],
      );
      await client.query(`INSERT INTO point_events (user_id, delta, kind, reason, ref) VALUES ($1, $2, 'redeem', $3, $4)`, [
        uid,
        -reward.cost,
        `Redeemed: ${reward.name}`,
        String(d.rows[0].id),
      ]);
      await client.query('COMMIT');
      res.json({ redemption: { id: d.rows[0].id, reward_id: reward.id, name: reward.name, kind: reward.kind }, balance: balance - reward.cost });
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(e);
      res.status(500).json({ error: 'failed to redeem' });
    } finally {
      client.release();
    }
  });

  // Coaching hook (for the coaching page): a redeemed coaching reward = one session credit.
  r.get('/coaching-credits', async (req, res) => {
    const uid = req.user?.id;
    if (!uid) return res.json({ credits: 0 });
    const q = await db.query(
      `SELECT count(*)::int AS n FROM redemptions d JOIN rewards w ON w.id = d.reward_id
        WHERE d.user_id = $1 AND w.kind = 'coaching' AND d.status = 'requested'`,
      [uid],
    );
    res.json({ credits: Number(q.rows[0]?.n ?? 0) });
  });

  r.post('/coaching-credits/use', async (req, res) => {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ error: 'sign in required' });
    const q = await db.query(
      `UPDATE redemptions SET status = 'used', used_at = now()
        WHERE id = (SELECT d.id FROM redemptions d JOIN rewards w ON w.id = d.reward_id
                     WHERE d.user_id = $1 AND w.kind = 'coaching' AND d.status = 'requested'
                     ORDER BY d.created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
        RETURNING id, reward_id`,
      [uid],
    );
    if (!q.rowCount) return res.status(402).json({ error: 'no coaching credits: redeem one in the store or book a paid session' });
    res.json({ used: q.rows[0] });
  });

  return r;
}
