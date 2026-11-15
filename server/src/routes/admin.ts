// Admin area (owner: Yao). Every route is admin-only.
//   GET /api/admin/overview   counts for the admin page
// Phase 2: the director console (POST /api/admin/live/events) mounts here.
import { Router } from 'express';
import type { YaoDeps } from '../lib/yao-deps.js';

export function createAdminRouter({ db, auth }: YaoDeps): Router {
  const r = Router();
  r.use(auth.identify, auth.requireRole('admin'));

  r.get('/overview', async (_req, res) => {
    try {
      const q = await db.query<Record<string, string>>(
        `SELECT (SELECT count(*) FROM users) AS users,
                (SELECT count(*) FROM users WHERE role <> 'user') AS staff,
                (SELECT count(*) FROM threads) AS threads,
                (SELECT count(*) FROM comments) AS comments,
                (SELECT count(*) FROM scout_reports WHERE status = 'new') AS new_prospects,
                (SELECT count(*) FROM live_events) AS live_events,
                (SELECT count(*) FROM pixel_events) AS pixels,
                (SELECT count(*) FROM guessr_puzzles) AS guessr_puzzles`,
      );
      res.json({ counts: Object.fromEntries(Object.entries(q.rows[0] ?? {}).map(([k, v]) => [k, Number(v)])) });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'failed to load overview' });
    }
  });

  return r;
}
