// Demo login picker (REQUIREMENTS.md §7.5). SHARED FILE.
//   GET /api/auth/demo-users   seeded accounts for the picker
//   GET /api/auth/me           the current user (from x-user-id / cookie)
import { Router } from 'express';
import type { YaoDeps } from '../lib/yao-deps.js';

export function createAuthRouter({ db, auth }: YaoDeps): Router {
  const r = Router();
  r.use(auth.identify);

  r.get('/demo-users', async (_req, res) => {
    try {
      const q = await db.query(
        `SELECT u.id, u.handle, u.display_name, u.role, u.avatar_url, g.faceit_level, g.faceit_elo
           FROM users u LEFT JOIN game_accounts g ON g.user_id = u.id AND g.game = 'cs2'
          ORDER BY CASE u.role WHEN 'recruiter' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, g.faceit_elo DESC NULLS LAST, u.handle`,
      );
      res.json({ users: q.rows });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'failed to load demo users' });
    }
  });

  r.get('/me', async (req, res) => {
    if (!req.user) return res.json({ user: null });
    const q = await db.query(`SELECT id, handle, display_name, role, avatar_url FROM users WHERE id = $1`, [req.user.id]);
    res.json({ user: q.rows[0] ?? null });
  });

  return r;
}
