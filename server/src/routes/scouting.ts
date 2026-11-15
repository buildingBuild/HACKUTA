// Scouting routes (Yao). Contract: REQUIREMENTS.md §7.4 (+ additive progress/rules routes)
//   GET   /api/scouting/prospects            recruiter/admin: ranked prospects (filters: track, minLevel, region, status)
//   GET   /api/scouting/prospects/:id        recruiter/admin: report + stats trend + top clips
//   PATCH /api/scouting/prospects/:id        recruiter/admin: { status }
//   GET   /api/scouting/progress/:userId     public: scout progress bar data (for profiles)
//   GET   /api/scouting/rules, PUT /api/scouting/rules   admin: threshold config (P2)
import { Router } from 'express';
import type { YaoDeps } from '../lib/yao-deps.js';
import { getProgress, getRules, saveRules, type RulesFile } from '../lib/scouting/engine.js';
import { getStatTrend } from '../lib/faceit/stats.js';

const STATUSES = ['new', 'reviewing', 'contacted', 'passed'] as const;

export function createScoutingRouter({ db, auth }: YaoDeps): Router {
  const r = Router();
  r.use(auth.identify);
  const staff = auth.requireRole('recruiter', 'admin');

  r.get('/progress/:userId', async (req, res) => {
    try {
      res.json(await getProgress(db, req.params.userId));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'failed to compute progress' });
    }
  });

  r.get('/prospects', staff, async (req, res) => {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, v: unknown) => {
      params.push(v);
      where.push(sql.replace('?', `$${params.length}`));
    };
    if (req.query.track) add('s.track = ?', String(req.query.track));
    if (req.query.status) add('s.status = ?', String(req.query.status));
    if (req.query.region) add('g.region = ?', String(req.query.region));
    if (req.query.minLevel) add('g.faceit_level >= ?', Number(req.query.minLevel));
    try {
      const rows = await db.query(
        `SELECT s.id, s.user_id, s.track, s.rule_id, s.summary, s.status, s.audio_url, s.created_at,
                (s.evidence->>'score')::int AS score, s.evidence->'metrics' AS metrics,
                u.handle, u.display_name, u.avatar_url,
                g.region, g.faceit_level, g.faceit_elo, g.faceit_nickname
           FROM scout_reports s
           JOIN users u ON u.id = s.user_id
           LEFT JOIN game_accounts g ON g.user_id = s.user_id AND g.game = 'cs2'
          ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
          ORDER BY (s.status = 'new') DESC, (s.evidence->>'score')::int DESC NULLS LAST, s.created_at DESC`,
        params,
      );
      res.json({ prospects: rows.rows });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'failed to load prospects' });
    }
  });

  r.get('/prospects/:id', staff, async (req, res) => {
    try {
      const rep = await db.query(
        `SELECT s.*, u.handle, u.display_name, u.avatar_url,
                g.region, g.faceit_level, g.faceit_elo, g.faceit_nickname
           FROM scout_reports s JOIN users u ON u.id = s.user_id
           LEFT JOIN game_accounts g ON g.user_id = s.user_id AND g.game = 'cs2'
          WHERE s.id = $1`,
        [req.params.id],
      );
      const report = rep.rows[0];
      if (!report) return res.status(404).json({ error: 'prospect not found' });

      const [trend, clips, progress] = await Promise.all([
        getStatTrend(db, report.user_id, 30),
        db.query(
          `SELECT DISTINCT ON (c.id) c.id, c.title, c.map, c.side, c.blob_url, c.thumbnail_url, c.created_at,
                  r.overall_score, r.category_scores, r.notes, r.summary
             FROM clips c JOIN coaching_reports r ON r.clip_id = c.id
            WHERE c.user_id = $1
            ORDER BY c.id, r.created_at DESC`,
          [report.user_id],
        ),
        getProgress(db, report.user_id),
      ]);
      const topClips = clips.rows.sort((a, b) => b.overall_score - a.overall_score).slice(0, 5);
      res.json({ report, trend, topClips, progress });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'failed to load prospect' });
    }
  });

  r.patch('/prospects/:id', staff, async (req, res) => {
    const status = req.body?.status;
    if (!STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });
    try {
      const upd = await db.query(`UPDATE scout_reports SET status = $2 WHERE id = $1 RETURNING id, status`, [req.params.id, status]);
      if (!upd.rows[0]) return res.status(404).json({ error: 'prospect not found' });
      res.json(upd.rows[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'failed to update status' });
    }
  });

  r.get('/rules', staff, (_req, res) => res.json(getRules()));

  r.put('/rules', auth.requireRole('admin'), (req, res) => {
    const body = req.body as RulesFile;
    const valid =
      body && Array.isArray(body.rules) &&
      body.rules.every((x) => x.id && ['player', 'creator'].includes(x.track) && Array.isArray(x.all) &&
        x.all.every((c) => typeof c.metric === 'string' && ['>=', '>', '<=', '<', '=='].includes(c.op) && typeof c.value === 'number'));
    if (!valid) return res.status(400).json({ error: 'invalid rules file' });
    saveRules({ version: (getRules().version ?? 0) + 1, rules: body.rules });
    res.json(getRules());
  });

  return r;
}
