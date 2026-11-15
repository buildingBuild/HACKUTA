// Voice routes (Yao). Contract: REQUIREMENTS.md §7.4
//   POST /api/voice/session              { clipId } -> { signedUrl, dynamicVariables, fallbackAudioUrl }
//   POST /api/voice/briefing/:reportId   recruiter/admin: TTS of the scout report -> { audio_url }
//   GET  /api/voice/audio/:file          serves cached/committed mp3s (sandbox/local storage)
import { Router } from 'express';
import type { YaoDeps } from '../lib/yao-deps.js';
import { briefingScript, getSignedUrl, tts } from '../lib/voice/elevenlabs.js';
import { hasAudio, readAudio, saveAudio } from '../lib/voice/audioStore.js';
import { getLatestReport, getClip } from '../lib/ai/coachingService.js';
import type { CoachingReport } from '../lib/ai/coachingSchema.js';

const COACH_FALLBACK = 'coach-fallback.mp3';

export function createVoiceRouter({ db, auth }: YaoDeps): Router {
  const r = Router();
  r.use(auth.identify);

  r.post('/session', async (req, res) => {
    const clipId = req.body?.clipId;
    if (!clipId) return res.status(400).json({ error: 'clipId is required' });
    try {
      const clip = await getClip(db, String(clipId));
      if (!clip) return res.status(404).json({ error: 'clip not found' });
      const report = await getLatestReport(db, clip.id);
      if (!report) return res.status(409).json({ error: 'clip has no coaching report yet' });
      const user = await db.query<{ handle: string; display_name: string | null; faceit_level: number | null; faceit_elo: number | null }>(
        `SELECT u.handle, u.display_name, g.faceit_level, g.faceit_elo
           FROM users u LEFT JOIN game_accounts g ON g.user_id = u.id AND g.game = 'cs2' WHERE u.id = $1`,
        [clip.user_id],
      );
      const u = user.rows[0];
      const dynamicVariables = coachVariables(report, {
        player_name: u?.display_name || u?.handle || 'player',
        faceit_level: u?.faceit_level ?? 'unknown',
        elo: u?.faceit_elo ?? 'unknown',
        map: clip.map ?? 'unknown',
        side: clip.side ?? 'unknown',
      });
      const fallbackAudioUrl = (await hasAudio(COACH_FALLBACK)) ? `/api/voice/audio/${COACH_FALLBACK}` : null;
      try {
        const signedUrl = await getSignedUrl();
        res.json({ signedUrl, dynamicVariables, fallbackAudioUrl });
      } catch (e) {
        console.warn('[voice] signed URL failed:', (e as Error).message);
        res.json({ signedUrl: null, dynamicVariables, fallbackAudioUrl, error: 'voice agent unavailable' });
      }
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'failed to start voice session' });
    }
  });

  r.post('/briefing/:reportId', auth.requireRole('recruiter', 'admin'), async (req, res) => {
    try {
      const q = await db.query<{ id: string; summary: string; audio_url: string | null; handle: string; display_name: string | null }>(
        `SELECT s.id, s.summary, s.audio_url, u.handle, u.display_name
           FROM scout_reports s JOIN users u ON u.id = s.user_id WHERE s.id = $1`,
        [req.params.reportId],
      );
      const rep = q.rows[0];
      if (!rep) return res.status(404).json({ error: 'report not found' });
      const text = briefingScript(rep);
      const file = `briefing-${rep.id}.mp3`;

      if (rep.audio_url && !req.query.regenerate) return res.json({ audio_url: rep.audio_url, text, cached: true });
      if (!req.query.regenerate && (await hasAudio(file))) {
        const url = `/api/voice/audio/${file}`;
        await db.query(`UPDATE scout_reports SET audio_url = $2 WHERE id = $1`, [rep.id, url]);
        return res.json({ audio_url: url, text, cached: true });
      }
      try {
        const url = await saveAudio(file, await tts(text));
        await db.query(`UPDATE scout_reports SET audio_url = $2 WHERE id = $1`, [rep.id, url]);
        res.json({ audio_url: url, text, cached: false });
      } catch (e) {
        console.warn('[voice] TTS failed:', (e as Error).message);
        // Frontend falls back to the browser's speechSynthesis with this text.
        res.status(503).json({ error: 'tts unavailable', text });
      }
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'failed to create briefing' });
    }
  });

  r.get('/audio/:file', async (req, res) => {
    const bytes = await readAudio(req.params.file);
    if (!bytes) return res.status(404).json({ error: 'audio not found' });
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(bytes);
  });

  return r;
}

/**
 * Dynamic variables referenced in the ElevenLabs agent's system prompt / first
 * message as {{player_name}}, {{coaching_summary}}, etc. (see sandbox/ELEVENLABS_AGENT.md).
 */
export function coachVariables(report: CoachingReport, base: Record<string, string | number>): Record<string, string | number> {
  const notes = [...report.notes].sort((a, b) => sev(b.severity) - sev(a.severity));
  return {
    ...base,
    overall_score: report.overall_score,
    category_scores: Object.entries(report.category_scores).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(', '),
    coaching_summary: report.summary,
    top_mistakes: notes.map((n) => `At ${n.t} (${n.category.replace(/_/g, ' ')}, ${n.severity}): ${n.note} Fix: ${n.fix}`).join(' | '),
    drills: report.drills.map((d) => `${d.name} in ${d.where} for ${d.minutes} minutes`).join('; '),
  };
}
const sev = (s: string) => (s === 'high' ? 3 : s === 'medium' ? 2 : 1);
