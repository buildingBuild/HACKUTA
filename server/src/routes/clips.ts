// PLACEHOLDER clips routes (owner: Joe). Minimal REQUIREMENTS.md §7.4 contract so the
// demo loop and the clip detail page work before the real clips feature lands.
// Joe: replace freely, just keep these routes/response fields compatible.
//   POST /api/clips       register an already-uploaded clip { blob_url, map, side, title, ... }
//   GET  /api/clips       ?userId= optional
//   GET  /api/clips/external  FaZe YouTube + Reddit (lib/social), cached with snapshot fallback
//   GET  /api/clips/:id
import { Router } from 'express';
import { getExternal } from '../lib/social/feeds.js';
import type { YaoDeps } from '../lib/yao-deps.js';

const COLS = `c.id, c.user_id, c.blob_url, c.thumbnail_url, c.game, c.map, c.side, c.title, c.social_post_url,
              c.status, c.created_at, u.handle, u.display_name`;

export function createClipsRouter({ db, auth }: YaoDeps): Router {
  const r = Router();
  r.use(auth.identify);

  // warm the external cache at boot so the first feed load doesn't wait on YouTube/Reddit
  void getExternal().catch(() => {});

  // must be registered before '/:id'
  r.get('/external', async (_req, res) => {
    const out = await getExternal();
    res.set('Cache-Control', 'public, max-age=120').json(out);
  });

  r.get('/', async (req, res) => {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : null;
    try {
      const q = await db.query(
        `SELECT ${COLS} FROM clips c JOIN users u ON u.id = c.user_id
          ${userId ? 'WHERE c.user_id = $1' : ''} ORDER BY c.created_at DESC LIMIT 100`,
        userId ? [userId] : [],
      );
      res.json({ clips: q.rows });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'failed to load clips' });
    }
  });

  r.get('/:id', async (req, res) => {
    try {
      const q = await db.query(`SELECT ${COLS} FROM clips c JOIN users u ON u.id = c.user_id WHERE c.id = $1`, [req.params.id]);
      if (!q.rows[0]) return res.status(404).json({ error: 'clip not found' });
      res.json(q.rows[0]);
    } catch (e) {
      console.error(e);
      res.status(400).json({ error: 'invalid clip id' });
    }
  });

  r.post('/', auth.requireRole('user', 'recruiter', 'admin'), async (req, res) => {
    const b = req.body ?? {};
    if (typeof b.blob_url !== 'string' || !/^https?:\/\/\S+$/.test(b.blob_url.trim())) {
      return res.status(400).json({ error: 'blob_url (uploaded clip URL or YouTube link) is required' });
    }
    b.blob_url = b.blob_url.trim();
    if (b.side && !['T', 'CT'].includes(b.side)) return res.status(400).json({ error: 'side must be T or CT' });
    try {
      const q = await db.query(
        `INSERT INTO clips (user_id, blob_url, thumbnail_url, map, side, title, social_post_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [req.user!.id, b.blob_url, b.thumbnail_url ?? null, b.map ?? null, b.side ?? null, b.title ?? null, b.social_post_url ?? null],
      );
      res.status(201).json(q.rows[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'failed to register clip' });
    }
  });

  return r;
}
