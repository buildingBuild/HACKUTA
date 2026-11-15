// Adapter: Yao's scouting engine -> the ScoutProgress shape Omar's profiles router expects
// (server/src/routes/profiles.ts `scoutProgress` hook). Keeps one source of truth for the bar.
import type { Db } from '../yao-deps.js';
import { getProgress } from './engine.js';

export type ProfileScoutProgress = {
  status: 'reported' | 'in_progress' | 'unavailable';
  progress: number | null;
  rule_id: string | null;
  criteria: { metric: string; label: string; current: number | null; target: number; met: boolean }[];
  report: { id: string; status: string; created_at: string } | null;
};

export async function profileScoutProgress(db: Db, userId: string): Promise<ProfileScoutProgress> {
  const [progress, rep] = await Promise.all([
    getProgress(db, userId),
    db.query<{ id: string; status: string; created_at: string; rule_id: string }>(
      `SELECT id, status, created_at, rule_id FROM scout_reports
        WHERE user_id = $1 AND track = 'player' ORDER BY created_at DESC LIMIT 1`,
      [userId],
    ),
  ]);
  const report = rep.rows[0] ?? null;
  const rule = (report && progress.rules.find((r) => r.rule_id === report.rule_id)) || progress.primary;
  if (!rule) return { status: 'unavailable', progress: null, rule_id: null, criteria: [], report: null };

  const criteria = rule.criteria.map((c) => ({
    metric: c.metric,
    label: c.label ?? c.metric,
    current: c.actual,
    target: c.value,
    met: c.pass,
  }));
  if (report) {
    return {
      status: 'reported',
      progress: 1,
      rule_id: report.rule_id,
      criteria,
      report: { id: String(report.id), status: report.status, created_at: report.created_at },
    };
  }
  return { status: 'in_progress', progress: rule.pass ? 1 : Math.min(rule.progress, 0.99), rule_id: rule.rule_id, criteria, report: null };
}
