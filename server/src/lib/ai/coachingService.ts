// Orchestrates: clip -> (Gemini | cache) -> validated report -> DB -> scouting check.
import type { Db } from '../yao-deps.js';
import type { CoachingReport } from './coachingSchema.js';
import { analyzeClip, withTimeout } from './gemini.js';
import { getCachedReport, getFallbackReport } from './cache/index.js';
import type { PlayerContext } from './prompt.js';
import { evaluate, type EvaluateResult } from '../scouting/engine.js';

export type CoachingMode = 'auto' | 'live' | 'cache';
export const coachingMode = (): CoachingMode => {
  const m = process.env.COACHING_MODE as CoachingMode | undefined;
  return m === 'live' || m === 'cache' ? m : 'auto';
};

const LIVE_TIMEOUT_MS = Number(process.env.COACHING_TIMEOUT_MS || 60_000);
const CACHE_DELAY_MS = Number(process.env.COACHING_CACHE_DELAY_MS ?? 2_500);

export interface ClipRow {
  id: string;
  user_id: string;
  blob_url: string;
  map: string | null;
  side: string | null;
  title: string | null;
  status: string;
}

export interface StoredReport extends CoachingReport {
  id: string;
  clip_id: string;
  model: string;
  created_at: string;
}

export async function getClip(db: Db, clipId: string): Promise<ClipRow | null> {
  const r = await db.query<ClipRow>(
    `SELECT id, user_id, blob_url, map, side, title, status FROM clips WHERE id = $1`,
    [clipId],
  );
  return r.rows[0] ?? null;
}

export async function getLatestReport(db: Db, clipId: string): Promise<StoredReport | null> {
  const r = await db.query<StoredReport>(
    `SELECT id, clip_id, overall_score, category_scores, notes, drills, summary, model, created_at
       FROM coaching_reports WHERE clip_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [clipId],
  );
  return r.rows[0] ?? null;
}

async function playerContext(db: Db, clip: ClipRow): Promise<PlayerContext> {
  const [u, stats] = await Promise.all([
    db.query<{ handle: string; faceit_level: number | null; faceit_elo: number | null }>(
      `SELECT u.handle, g.faceit_level, g.faceit_elo
         FROM users u LEFT JOIN game_accounts g ON g.user_id = u.id AND g.game = 'cs2'
        WHERE u.id = $1`,
      [clip.user_id],
    ),
    db.query<{ metric: string; value: string }>(
      `SELECT DISTINCT ON (metric) metric, value FROM player_stats
        WHERE user_id = $1 AND game = 'cs2' AND metric IN ('kd','hs_pct','adr','win_rate')
        ORDER BY metric, time DESC`,
      [clip.user_id],
    ),
  ]);
  const row = u.rows[0];
  return {
    handle: row?.handle,
    faceit_level: row?.faceit_level,
    faceit_elo: row?.faceit_elo,
    map: clip.map,
    side: clip.side,
    title: clip.title,
    stats: Object.fromEntries(stats.rows.map((s) => [s.metric, Number(s.value)])),
  };
}

async function produceReport(clip: ClipRow, ctx: PlayerContext): Promise<{ report: CoachingReport; model: string }> {
  const mode = coachingMode();
  const cached = () => {
    const exact = getCachedReport(clip.blob_url);
    return { report: exact ?? getFallbackReport(), model: exact ? 'cache' : 'cache-fallback' };
  };

  const delayed = async () => {
    await new Promise((r) => setTimeout(r, CACHE_DELAY_MS)); // feels like real analysis on stage
    return cached();
  };
  if (mode === 'cache') return delayed();
  // auto: seeded demo clips keep their scripted result (e.g. the prospect's 92 that crosses the bar).
  if (mode === 'auto' && getCachedReport(clip.blob_url)) return delayed();
  try {
    return await withTimeout(analyzeClip(clip.blob_url, ctx), LIVE_TIMEOUT_MS, 'Gemini analysis');
  } catch (e) {
    if (mode === 'live') throw e;
    console.warn(`[coaching] live analysis failed for clip ${clip.id}, using cache:`, (e as Error).message);
    return cached();
  }
}

export interface AnalyzeResult {
  report: StoredReport;
  scouting: Pick<EvaluateResult, 'created' | 'primary'> | null;
}

/** Runs the full analysis synchronously (host-agnostic: works as a serverless function). */
export async function analyze(db: Db, clip: ClipRow): Promise<AnalyzeResult> {
  await db.query(`UPDATE clips SET status = 'analyzing' WHERE id = $1`, [clip.id]);
  try {
    const ctx = await playerContext(db, clip);
    const { report, model } = await produceReport(clip, ctx);
    const ins = await db.query<StoredReport>(
      `INSERT INTO coaching_reports (clip_id, overall_score, category_scores, notes, drills, summary, model)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, clip_id, overall_score, category_scores, notes, drills, summary, model, created_at`,
      [
        clip.id,
        report.overall_score,
        JSON.stringify(report.category_scores),
        JSON.stringify(report.notes),
        JSON.stringify(report.drills),
        report.summary,
        model,
      ],
    );
    await db.query(`UPDATE clips SET status = 'done' WHERE id = $1`, [clip.id]);

    let scouting: AnalyzeResult['scouting'] = null;
    try {
      const ev = await evaluate(db, clip.user_id);
      scouting = { created: ev.created, primary: ev.primary };
    } catch (e) {
      console.error('[coaching] scouting evaluation failed:', e);
    }
    return { report: ins.rows[0], scouting };
  } catch (e) {
    await db.query(`UPDATE clips SET status = 'failed' WHERE id = $1`, [clip.id]);
    throw e;
  }
}
