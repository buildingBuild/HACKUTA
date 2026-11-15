// Player stats routes (Yao). Contract: REQUIREMENTS.md §7.4
//   GET  /api/players/:userId/stats?days=30   latest metrics + daily trend
//   POST /api/players/:userId/sync            pull fresh FACEIT stats (seeded fallback)
import { Router } from 'express';
import type { YaoDeps } from '../lib/yao-deps.js';
import { getLatestStats, getStatTrend, syncFromFaceit } from '../lib/faceit/stats.js';
import { evaluate } from '../lib/scouting/engine.js';

export function createPlayersRouter({ db, auth }: YaoDeps): Router {
  const r = Router();
  r.use(auth.identify);

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
    if (u && u.role === 'user' && u.id !== req.params.userId) return res.status(403).json({ error: 'can only sync your own stats' });
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
