// Player stats routes (Yao). Contract: REQUIREMENTS.md §7.4
//   GET  /api/players/:userId/stats?days=30   latest metrics + daily trend
//   POST /api/players/:userId/sync            pull fresh FACEIT stats (seeded fallback)
//   GET  /api/players/:userId/account         linked CS2 / FACEIT account
//   PUT  /api/players/:userId/faceit          { nickname } link a FACEIT nickname (demo step 1)
import { Router } from 'express';
import type { YaoDeps } from '../lib/yao-deps.js';
import { getLatestStats, getStatTrend, syncFromFaceit } from '../lib/faceit/stats.js';
import { evaluate } from '../lib/scouting/engine.js';

export function createPlayersRouter({ db, auth }: YaoDeps): Router {
  const r = Router();
  r.use(auth.identify);

  const ACCOUNT_COLS = `faceit_nickname, faceit_player_id, region, faceit_level, faceit_elo`;

  r.get('/:userId/account', async (req, res) => {
    try {
      const q = await db.query(`SELECT ${ACCOUNT_COLS} FROM game_accounts WHERE user_id = $1 AND game = 'cs2' LIMIT 1`, [req.params.userId]);
      res.json({ account: q.rows[0] ?? null });
    } catch (e) {
      console.error(e);
      res.status(400).json({ error: 'invalid user id' });
    }
  });

  r.put('/:userId/faceit', async (req, res) => {
    const u = req.user;
    if (!u) return res.status(401).json({ error: 'sign in required' });
    if (u.role === 'user' && u.id !== req.params.userId) return res.status(403).json({ error: 'can only link your own account' });
    const nickname = String(req.body?.nickname ?? '').trim();
    if (!/^[\w.-]{2,32}$/.test(nickname)) return res.status(400).json({ error: 'enter a valid FACEIT nickname' });
    try {
      const upd = await db.query(
        `UPDATE game_accounts SET faceit_nickname = $2 WHERE user_id = $1 AND game = 'cs2' RETURNING ${ACCOUNT_COLS}`,
        [req.params.userId, nickname],
      );
      const account =
        upd.rows[0] ??
        (await db.query(
          `INSERT INTO game_accounts (user_id, game, faceit_nickname) VALUES ($1, 'cs2', $2) RETURNING ${ACCOUNT_COLS}`,
          [req.params.userId, nickname],
        )).rows[0];
      res.json({ account });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'failed to link account' });
    }
  });

  r.get('/:userId/stats', async (req, res) => {
    try {
      const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
      const [latest, trend] = await Promise.all([getLatestStats(db, req.params.userId), getStatTrend(db, req.params.userId, days)]);
      res.json({ user_id: req.params.userId, latest, trend });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'failed to load stats' });
    }
  });

  r.post('/:userId/sync', async (req, res) => {
    const u = req.user;
    if (!u) return res.status(401).json({ error: 'sign in required' });
    if (u.role === 'user' && u.id !== req.params.userId) return res.status(403).json({ error: 'can only sync your own stats' });
    try {
      const result = await syncFromFaceit(db, req.params.userId);
      // New stats can push a player over the threshold too.
      const ev = await evaluate(db, req.params.userId).catch(() => null);
      res.json({ ...result, scouting: ev && { created: ev.created, primary: ev.primary } });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'sync failed' });
    }
  });

  return r;
}
