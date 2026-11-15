// Demo auth (REQUIREMENTS.md §7.5). SHARED FILE.
//   GET  /api/auth/demo-users   seeded accounts for the demo login picker
//   GET  /api/auth/me           the current user (cookie, or x-user-id header for scripts)
//   POST /api/auth/login        { userId } -> sets the httpOnly `fazehq_user` cookie
//   POST /api/auth/logout       clears it
import { Router, type Response } from 'express';
import type { YaoDeps } from '../lib/yao-deps.js';

export const SESSION_COOKIE = 'fazehq_user';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USER_COLS = `u.id, u.handle, u.display_name, u.role, u.avatar_url, g.faceit_level, g.faceit_elo`;
const USER_JOIN = `users u LEFT JOIN game_accounts g ON g.user_id = u.id AND g.game = 'cs2'`;

function setSession(res: Response, id: string | null) {
  const opts = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/' };
  if (id) res.cookie(SESSION_COOKIE, id, { ...opts, maxAge: 30 * 86400_000 });
  else res.clearCookie(SESSION_COOKIE, opts);
}

export function createAuthRouter({ db, auth }: YaoDeps): Router {
  const r = Router();
  r.use(auth.identify);

  r.get('/demo-users', async (_req, res) => {
    try {
      const q = await db.query(
        `SELECT ${USER_COLS} FROM ${USER_JOIN}
          ORDER BY CASE u.role WHEN 'recruiter' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
                   CASE WHEN u.handle IN ('new_fan', 'og_fan') THEN 0 ELSE 1 END,
                   g.faceit_elo DESC NULLS LAST, u.handle
          LIMIT 50`,
      );
      res.json({ users: q.rows });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'failed to load demo users' });
    }
  });

  r.get('/me', async (req, res) => {
    if (!req.user) return res.json({ user: null });
    const q = await db.query(`SELECT ${USER_COLS} FROM ${USER_JOIN} WHERE u.id = $1`, [req.user.id]);
    res.json({ user: q.rows[0] ?? null });
  });

  r.post('/login', async (req, res) => {
    const id = String(req.body?.userId ?? '');
    if (!UUID.test(id)) return res.status(400).json({ error: 'userId must be a user id' });
    try {
      const q = await db.query(`SELECT ${USER_COLS} FROM ${USER_JOIN} WHERE u.id = $1`, [id]);
      if (!q.rows[0]) return res.status(404).json({ error: 'user not found' });
      setSession(res, id);
      res.json({ user: q.rows[0] });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'login failed' });
    }
  });

  r.post('/logout', (_req, res) => {
    setSession(res, null);
    res.json({ ok: true });
  });

  return r;
}
