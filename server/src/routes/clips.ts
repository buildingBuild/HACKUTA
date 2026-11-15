// PLACEHOLDER clips routes (owner: Joe). Minimal REQUIREMENTS.md §7.4 contract so the
// demo loop and the clip detail page work before the real clips feature lands.
// Joe: replace freely, just keep these routes/response fields compatible.
//   POST /api/clips       register an already-uploaded clip { blob_url, map, side, title, ... }
//   GET  /api/clips       ?userId= optional
//   GET  /api/clips/external  FaZe YouTube + Reddit (lib/social), cached with snapshot fallback
//   POST /api/clips/analyze   { source, start?, duration?, clips?, limit? } analyze Twitch/YouTube URL, channel, or local folder
//   GET  /api/clips/jobs      my analysis jobs (progress)   GET /api/clips/jobs/:id
//   GET  /api/clips/files/*   rendered clip mp4/jpg (server/media/clips)
//   GET  /api/clips/:id
import express, { Router } from 'express';
import type { Pool } from 'pg';
import { CLIPS_DIR, createJobs, resumeJobs } from '../lib/media/analyze.js';
import { getExternal } from '../lib/social/feeds.js';
import type { YaoDeps } from '../lib/yao-deps.js';

const COLS = `c.id, c.user_id, c.blob_url, c.thumbnail_url, c.game, c.map, c.side, c.title, c.social_post_url,
              c.status, c.created_at, u.handle, u.display_name,
              c.category, c.ai_score, c.ai_reason, c.ai_rules, c.source_url, c.start_s, c.end_s, c.job_id`;

export function createClipsRouter({ db, auth }: YaoDeps): Router {
  const r = Router();
  r.use(auth.identify);

  // warm the external cache at boot so the first feed load doesn't wait on YouTube/Reddit
  void getExternal().catch(() => {});

  void resumeJobs(db as unknown as Pool).catch(() => {});

  // rendered clips + thumbnails from the analysis pipeline
  r.use('/files', express.static(CLIPS_DIR, { maxAge: '1d', fallthrough: false }));

  // start analysis: one job per video (a channel or folder expands to its newest videos)
  r.post('/analyze', auth.requireRole('user', 'recruiter', 'admin'), async (req, res) => {
    const b = req.body ?? {};
    if (typeof b.source !== 'string' || !b.source.trim()) return res.status(400).json({ error: 'source (video URL, channel URL or folder path) is required' });
    const n = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : Number(v));
    try {
      const jobs = await createJobs(db as unknown as Pool, req.user!.id, b.source, { start: n(b.start), duration: n(b.duration), maxClips: n(b.clips) }, Math.min(10, n(b.limit) ?? 3));
      res.status(202).json({ jobs });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  r.get('/jobs', auth.requireRole('user', 'recruiter', 'admin'), async (req, res) => {
    const q = await db.query(
      `SELECT id, source, platform, title, status, stage, progress, error, clip_count, created_at, updated_at
         FROM clip_jobs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [req.user!.id],
    );
    res.json({ jobs: q.rows });
  });

  r.get('/jobs/:id', async (req, res) => {
    try {
      const q = await db.query(`SELECT * FROM clip_jobs WHERE id = $1`, [req.params.id]);
      if (!q.rows[0]) return res.status(404).json({ error: 'job not found' });
      const clips = await db.query(`SELECT ${COLS} FROM clips c JOIN users u ON u.id = c.user_id WHERE c.job_id = $1 ORDER BY c.ai_score DESC`, [req.params.id]);
      res.json({ job: q.rows[0], clips: clips.rows });
    } catch {
      res.status(400).json({ error: 'invalid job id' });
    }
  });

  // must be registered before '/:id'
  r.get('/external', async (_req, res) => {
    const out = await getExternal();
    res.set('Cache-Control', 'public, max-age=120').json(out);
  });

  r.get('/', async (req, res) => {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : null;
    const category = typeof req.query.category === 'string' ? req.query.category : null;
    const where: string[] = [];
    const params: unknown[] = [];
    if (userId) where.push(`c.user_id = $${params.push(userId)}`);
    if (category) where.push(`c.category = $${params.push(category)}`);
    try {
      const q = await db.query(
        `SELECT ${COLS} FROM clips c JOIN users u ON u.id = c.user_id
          ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY c.created_at DESC LIMIT 100`,
        params,
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
