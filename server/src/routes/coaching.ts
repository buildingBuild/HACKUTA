// Coaching routes (Yao). Contract: REQUIREMENTS.md §7.4
//   POST /api/coaching/analyze/:clipId   run analysis (sync), returns report + scouting outcome
//   GET  /api/coaching/:clipId           latest report + clip status
import { Router } from 'express';
import type { YaoDeps } from '../lib/yao-deps.js';
import { analyze, getClip, getLatestReport } from '../lib/ai/coachingService.js';

export function createCoachingRouter({ db, auth }: YaoDeps): Router {
  const r = Router();
  r.use(auth.identify);

  r.post('/analyze/:clipId', async (req, res) => {
    try {
      const clip = await getClip(db, req.params.clipId);
      if (!clip) return res.status(404).json({ error: 'clip not found' });
      if (req.user && req.user.role === 'user' && req.user.id !== String(clip.user_id)) {
        return res.status(403).json({ error: 'not your clip' });
      }
      if (clip.status === 'analyzing' && !req.query.force) {
        return res.status(409).json({ error: 'analysis already running' });
      }
      const result = await analyze(db, clip);
      res.json(result);
    } catch (e) {
      console.error('[coaching] analyze failed:', e);
      res.status(502).json({ error: `analysis failed: ${(e as Error).message}` });
    }
  });

  r.get('/:clipId', async (req, res) => {
    try {
      const clip = await getClip(db, req.params.clipId);
      if (!clip) return res.status(404).json({ error: 'clip not found' });
      const report = await getLatestReport(db, clip.id);
      res.json({ clip_id: clip.id, status: clip.status, report });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'failed to load report' });
    }
  });

  return r;
}
