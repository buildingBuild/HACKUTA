// TEMPORARY sandbox seed for Yao's features. Fold into server/src/db/seed.ts at merge.
// Safe on a shared DB: only deletes/recreates the handles listed below.
//
// Demo setup:
//   - "vyper" is the prospect JUST UNDER the bar: every stat passes, but avg AI clip
//     score over the last 5 clips is 77.5 (< 80). Their newest clip
//     "prospect-great-clip" is uploaded but not analyzed. Analyzing it live (cached
//     score 92) lifts the last-5 average to 80.4 and creates a scout report.
//   - "kairo" and "nyx" already passed, so the recruiter dashboard isn't empty.
import { fileURLToPath } from 'node:url';
import type { Db } from '../server/src/lib/yao-deps.js';
import { CATEGORIES, type CoachingReport } from '../server/src/lib/ai/coachingSchema.js';
import { getCachedReport } from '../server/src/lib/ai/cache/index.js';
import { templateSummary } from '../server/src/lib/ai/scoutReport.js';
import { evaluateRule, getRules } from '../server/src/lib/scouting/engine.js';

const CLIP_BASE = process.env.DEMO_CLIP_BASE || 'http://localhost:3001/demo-clips';

// deterministic PRNG so every seed looks the same
let s = 42;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const jitter = (v: number, pct: number) => v * (1 + (rnd() * 2 - 1) * pct);
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

interface Final { faceit_level: number; elo: number; kd: number; kr: number; hs_pct: number; adr: number; win_rate: number }
interface SeedPlayer {
  handle: string; display_name: string; region: string; faceit: string; final: Final;
  clips: { key: string; title: string; map: string; side: 'T' | 'CT'; score?: number; analyzed?: boolean; daysAgo: number }[];
  existingReport?: 'new' | 'reviewing' | 'contacted';
}

const players: SeedPlayer[] = [
  {
    handle: 'vyper', display_name: 'Vyper', region: 'NA', faceit: 'vyper_cs',
    final: { faceit_level: 10, elo: 2610, kd: 1.31, kr: 0.86, hs_pct: 54, adr: 88.4, win_rate: 62 },
    clips: [
      { key: 'prospect-nuke-ramp', title: 'Ramp hold on Nuke', map: 'Nuke', side: 'CT', daysAgo: 12 },
      { key: 'prospect-ancient-awp', title: 'AWP mid control', map: 'Ancient', side: 'CT', daysAgo: 8 },
      { key: 'prospect-inferno-entry', title: 'Banana entry', map: 'Inferno', side: 'T', daysAgo: 5 },
      { key: 'prospect-mirage-retake', title: 'B retake Mirage', map: 'Mirage', side: 'CT', daysAgo: 2 },
      { key: 'prospect-great-clip', title: '1v3 clutch on A site', map: 'Mirage', side: 'T', analyzed: false, daysAgo: 0 },
    ],
  },
  {
    handle: 'kairo', display_name: 'Kairo', region: 'EU', faceit: 'kairo_awp',
    final: { faceit_level: 10, elo: 3120, kd: 1.48, kr: 0.92, hs_pct: 57, adr: 94.2, win_rate: 68 },
    clips: [
      { key: 'kairo-1', title: 'Triple on Anubis', map: 'Anubis', side: 'T', score: 88, daysAgo: 9 },
      { key: 'kairo-2', title: 'AWP flicks Dust2', map: 'Dust2', side: 'CT', score: 91, daysAgo: 4 },
    ],
    existingReport: 'reviewing',
  },
  {
    handle: 'nyx', display_name: 'Nyx', region: 'NA', faceit: 'nyx_entry',
    final: { faceit_level: 10, elo: 2740, kd: 1.29, kr: 0.84, hs_pct: 52, adr: 87.1, win_rate: 59 },
    clips: [
      { key: 'nyx-1', title: 'Entry frags Ancient', map: 'Ancient', side: 'T', score: 83, daysAgo: 6 },
      { key: 'nyx-2', title: 'Retake 1v2', map: 'Inferno', side: 'CT', score: 85, daysAgo: 1 },
    ],
    existingReport: 'new',
  },
  // Below the bar for different reasons (progress bars/leaderboards look real)
  { handle: 'drift', display_name: 'Drift', region: 'NA', faceit: 'drift_cs', final: { faceit_level: 10, elo: 2380, kd: 1.18, kr: 0.79, hs_pct: 49, adr: 82.0, win_rate: 55 },
    clips: [{ key: 'drift-1', title: 'Spray transfer', map: 'Mirage', side: 'T', score: 74, daysAgo: 3 }] },
  { handle: 'mochi', display_name: 'Mochi', region: 'EU', faceit: 'mochi_cs', final: { faceit_level: 9, elo: 1950, kd: 1.12, kr: 0.75, hs_pct: 47, adr: 79.5, win_rate: 53 },
    clips: [{ key: 'mochi-1', title: 'Smoke exec', map: 'Inferno', side: 'T', score: 69, daysAgo: 7 }] },
  { handle: 'tempo', display_name: 'Tempo', region: 'NA', faceit: 'tempo_cs', final: { faceit_level: 8, elo: 1780, kd: 1.05, kr: 0.71, hs_pct: 44, adr: 76.0, win_rate: 51 },
    clips: [{ key: 'tempo-1', title: 'Eco round ace attempt', map: 'Dust2', side: 'CT', score: 64, daysAgo: 10 }] },
  { handle: 'rook', display_name: 'Rook', region: 'SA', faceit: 'rook_cs', final: { faceit_level: 7, elo: 1560, kd: 0.98, kr: 0.66, hs_pct: 42, adr: 72.3, win_rate: 49 },
    clips: [{ key: 'rook-1', title: 'Anchor B', map: 'Nuke', side: 'CT', score: 61, daysAgo: 4 }] },
  { handle: 'pixel', display_name: 'Pixel', region: 'EU', faceit: 'pixel_cs', final: { faceit_level: 5, elo: 1210, kd: 0.91, kr: 0.62, hs_pct: 38, adr: 68.9, win_rate: 47 },
    clips: [{ key: 'pixel-1', title: 'First FACEIT ace', map: 'Ancient', side: 'T', score: 58, daysAgo: 2 }] },
];
const staff = [
  { handle: 'faze_recruiter', display_name: 'FaZe Recruiter (demo)', role: 'recruiter' },
  { handle: 'faze_admin', display_name: 'FaZe Admin (demo)', role: 'admin' },
];

/** Plausible report around a target score for non-demo clips. */
function makeReport(score: number): CoachingReport {
  const cats = Object.fromEntries(CATEGORIES.map((c) => [c, Math.max(0, Math.min(100, Math.round(jitter(score, 0.1))))])) as CoachingReport['category_scores'];
  const weakest = (Object.entries(cats).sort((a, b) => a[1] - b[1])[0][0]) as (typeof CATEGORIES)[number];
  return {
    overall_score: score,
    category_scores: cats,
    notes: [
      { t: '00:04', category: weakest, severity: score < 70 ? 'high' : 'medium', note: `Biggest leak in this clip is ${weakest.replace(/_/g, ' ')}.`, fix: 'Isolate it in practice for 10 minutes before every session.' },
      { t: '00:11', category: 'crosshair_placement', severity: 'low', note: 'Crosshair mostly at head level when clearing angles.', fix: 'Keep pre-aiming common spots while moving.' },
      { t: '00:17', category: 'movement', severity: 'medium', note: 'One shot fired before fully stopping.', fix: 'Counter-strafe before the first bullet.' },
    ],
    drills: [{ name: 'Counter-strafe + one-tap drill', where: 'aim_botz', minutes: 10 }],
    summary: `Solid clip; ${weakest.replace(/_/g, ' ')} is the main area to improve.`,
  };
}

export async function seed(db: Db) {
  const handles = [...players.map((p) => p.handle), ...staff.map((x) => x.handle)];
  await db.query(`DELETE FROM users WHERE handle = ANY($1::text[])`, [handles]); // cascades
  console.log(`cleared ${handles.length} seed handles`);

  for (const st of staff) {
    await db.query(`INSERT INTO users (handle, display_name, role) VALUES ($1, $2, $3)`, [st.handle, st.display_name, st.role]);
  }

  for (const p of players) {
    const { rows: [u] } = await db.query<{ id: string }>(
      `INSERT INTO users (handle, display_name, role, avatar_url) VALUES ($1, $2, 'user', $3) RETURNING id`,
      [p.handle, p.display_name, `https://api.dicebear.com/9.x/identicon/svg?seed=${p.handle}`],
    );
    await db.query(
      `INSERT INTO game_accounts (user_id, game, faceit_nickname, region, faceit_level, faceit_elo) VALUES ($1, 'cs2', $2, $3, $4, $5)`,
      [u.id, p.faceit, p.region, p.final.faceit_level, p.final.elo],
    );

    // 30 days of daily snapshots, trending up toward today's values (ELO climbs ~8%).
    const params: unknown[] = [];
    const tuples: string[] = [];
    for (let d = 30; d >= 0; d--) {
      const progress = 1 - d / 30; // 0 -> 1
      const t = new Date(Date.now() - d * 86400_000);
      const day: Record<string, number> = {
        elo: d === 0 ? p.final.elo : Math.round(jitter(p.final.elo * (0.92 + 0.08 * progress), 0.01)),
        kd: d === 0 ? p.final.kd : round(jitter(p.final.kd * (0.94 + 0.06 * progress), 0.03)),
        kr: d === 0 ? p.final.kr : round(jitter(p.final.kr * (0.95 + 0.05 * progress), 0.03)),
        hs_pct: d === 0 ? p.final.hs_pct : round(jitter(p.final.hs_pct * (0.95 + 0.05 * progress), 0.03), 1),
        adr: d === 0 ? p.final.adr : round(jitter(p.final.adr * (0.95 + 0.05 * progress), 0.03), 1),
        win_rate: d === 0 ? p.final.win_rate : round(jitter(p.final.win_rate, 0.05), 1),
        faceit_level: p.final.faceit_level,
        matches: 20,
      };
      for (const [metric, value] of Object.entries(day)) {
        params.push(t, u.id, metric, value);
        const i = params.length;
        tuples.push(`($${i - 3}, $${i - 2}, 'cs2', $${i - 1}, $${i})`);
      }
    }
    await db.query(`INSERT INTO player_stats (time, user_id, game, metric, value) VALUES ${tuples.join(',')}`, params);

    for (const c of p.clips) {
      const created = new Date(Date.now() - c.daysAgo * 86400_000 - 3600_000);
      const blobUrl = `${CLIP_BASE}/${c.key}.mp4`;
      const analyzed = c.analyzed !== false;
      const { rows: [clip] } = await db.query<{ id: string }>(
        `INSERT INTO clips (user_id, blob_url, game, map, side, title, status, created_at)
         VALUES ($1, $2, 'cs2', $3, $4, $5, $6, $7) RETURNING id`,
        [u.id, blobUrl, c.map, c.side, c.title, analyzed ? 'done' : 'uploaded', created],
      );
      if (!analyzed) {
        console.log(`  demo clip ready to analyze live: ${p.handle} "${c.title}" -> clip id ${clip.id}`);
        continue;
      }
      const rep = getCachedReport(blobUrl) ?? makeReport(c.score ?? 70);
      await db.query(
        `INSERT INTO coaching_reports (clip_id, overall_score, category_scores, notes, drills, summary, model, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'seed', $7)`,
        [clip.id, rep.overall_score, JSON.stringify(rep.category_scores), JSON.stringify(rep.notes), JSON.stringify(rep.drills), rep.summary, created],
      );
    }

    if (p.existingReport) {
      const rule = getRules().rules.find((r) => r.id === 'player_v1')!;
      const scores = p.clips.map((c) => c.score ?? 0);
      const metrics = { ...p.final, avg_clip_score: scores.reduce((a, b) => a + b, 0) / scores.length };
      const result = evaluateRule(rule, metrics);
      const best = [...p.clips].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
      const summary = templateSummary({
        handle: p.handle, displayName: p.display_name, region: p.region, metrics,
        topClips: [{ title: best.title, map: best.map, overall_score: best.score ?? 0, summary: 'clean mechanics and confident decision making.' }],
      });
      await db.query(
        `INSERT INTO scout_reports (user_id, track, rule_id, summary, evidence, status, created_at)
         VALUES ($1, 'player', 'player_v1', $2, $3, $4, now() - interval '1 day')`,
        [u.id, summary, JSON.stringify({ score: result.score, rule_label: rule.label, criteria: result.criteria, metrics, summary_source: 'seed' }), p.existingReport],
      );
    }
    console.log(`seeded ${p.handle} (L${p.final.faceit_level}, ${p.final.elo} ELO, ${p.clips.length} clips)`);
  }
  console.log('done. Log in as faze_recruiter for the dashboard, vyper for the demo prospect.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { pool } = await import('./db.js');
  await seed(pool)
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
