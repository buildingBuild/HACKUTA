// Scouting engine: evaluates threshold rules (config/scouting-rules.json) against
// a player's latest stats + AI clip scores, and creates scout reports.
// Profile/leaderboards read getProgress(); they should not recompute it.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Db } from '../yao-deps.js';
import { writeScoutReport } from '../ai/scoutReport.js';

export type Op = '>=' | '>' | '<=' | '<' | '==';
export interface Criterion { metric: string; op: Op; value: number; label?: string }
export interface Rule { id: string; track: 'player' | 'creator'; enabled: boolean; label?: string; window?: string; all: Criterion[] }
export interface RulesFile { version: number; rules: Rule[] }

const RULES_PATH = fileURLToPath(new URL('../../config/scouting-rules.json', import.meta.url));

/** Read fresh every time so rules can be tuned live without a restart. */
export function getRules(): RulesFile {
  return JSON.parse(readFileSync(RULES_PATH, 'utf8')) as RulesFile;
}
export function saveRules(rules: RulesFile): void {
  writeFileSync(RULES_PATH, JSON.stringify(rules, null, 2) + '\n');
}

export const OPEN_STATUSES = ['new', 'reviewing', 'contacted'] as const;

// ---------- metric collection ----------

export type Metrics = Record<string, number | null>;

export async function collectMetrics(db: Db, userId: string): Promise<Metrics> {
  const [stats, account, clips] = await Promise.all([
    db.query<{ metric: string; value: string | number }>(
      `SELECT DISTINCT ON (metric) metric, value
         FROM player_stats WHERE user_id = $1 AND game = 'cs2'
        ORDER BY metric, time DESC`,
      [userId],
    ),
    db.query<{ faceit_level: number | null; faceit_elo: number | null }>(
      `SELECT faceit_level, faceit_elo FROM game_accounts WHERE user_id = $1 AND game = 'cs2' LIMIT 1`,
      [userId],
    ),
    db.query<{ n: string }>(
      `SELECT COUNT(DISTINCT c.id) AS n
         FROM clips c JOIN coaching_reports r ON r.clip_id = c.id
        WHERE c.user_id = $1`,
      [userId],
    ),
  ]);

  const m: Metrics = {};
  for (const row of stats.rows) m[row.metric] = Number(row.value);
  const acc = account.rows[0];
  if (acc) {
    m.faceit_level ??= acc.faceit_level;
    m.elo ??= acc.faceit_elo;
  }
  m.avg_clip_score = await avgLastClipScores(db, userId, 5);
  m.clips_analyzed = Number(clips.rows[0]?.n ?? 0);
  Object.assign(m, await collectCreatorMetrics(db, userId));
  return m;
}

/** Average overall_score of the user's N most recent analyzed clips. */
async function avgLastClipScores(db: Db, userId: string, n: number): Promise<number | null> {
  const r = await db.query<{ avg: string | null }>(
    `SELECT AVG(overall_score) AS avg FROM (
       SELECT DISTINCT ON (c.id) c.id, c.created_at, r.overall_score
         FROM coaching_reports r JOIN clips c ON c.id = r.clip_id
        WHERE c.user_id = $1
        ORDER BY c.id, r.created_at DESC
     ) x
     WHERE x.id IN (
       SELECT c2.id FROM clips c2
        WHERE c2.user_id = $1 AND EXISTS (SELECT 1 FROM coaching_reports r2 WHERE r2.clip_id = c2.id)
        ORDER BY c2.created_at DESC LIMIT $2
     )`,
    [userId, n],
  );
  const v = r.rows[0]?.avg;
  return v == null ? null : Math.round(Number(v) * 10) / 10;
}

/** Creator-track metrics from social_stats. Table may not exist yet: return nothing. */
async function collectCreatorMetrics(db: Db, userId: string): Promise<Metrics> {
  try {
    const r = await db.query<{ growth: string | null; engagement: string | null }>(
      `WITH s AS (
         SELECT time, SUM(followers) AS followers, AVG(engagement_rate) AS er
           FROM social_stats WHERE user_id = $1 AND time > now() - interval '30 days'
          GROUP BY time
       )
       SELECT
         (SELECT 100.0 * (last.followers - first.followers) / NULLIF(first.followers, 0)
            FROM (SELECT followers FROM s ORDER BY time ASC LIMIT 1) first,
                 (SELECT followers FROM s ORDER BY time DESC LIMIT 1) last) AS growth,
         (SELECT AVG(er) FROM s) AS engagement`,
      [userId],
    );
    const row = r.rows[0];
    return {
      follower_growth_30d_pct: row?.growth == null ? null : Number(row.growth),
      engagement_rate: row?.engagement == null ? null : Number(row.engagement),
    };
  } catch {
    return {};
  }
}

// ---------- evaluation ----------

function check(actual: number | null | undefined, op: Op, target: number): boolean {
  if (actual == null || Number.isNaN(actual)) return false;
  switch (op) {
    case '>=': return actual >= target;
    case '>': return actual > target;
    case '<=': return actual <= target;
    case '<': return actual < target;
    case '==': return actual === target;
  }
}

export interface CriterionResult extends Criterion { actual: number | null; pass: boolean; progress: number }
export interface RuleResult { rule_id: string; track: Rule['track']; label?: string; pass: boolean; progress: number; score: number; criteria: CriterionResult[] }

/**
 * Per-criterion progress = min(actual/target, 1); rule progress = mean.
 * Prospect score (for sorting): mean of min(actual/target, 1.25) scaled so that
 * sitting exactly on every threshold = 80 and beating every target by 25% = 100.
 */
export function evaluateRule(rule: Rule, metrics: Metrics): RuleResult {
  const criteria = rule.all.map((c) => {
    const actual = metrics[c.metric] ?? null;
    const ratio = actual == null || c.value === 0 ? 0 : c.op.startsWith('<') ? c.value / Math.max(actual, 1e-9) : actual / c.value;
    return { ...c, actual, pass: check(actual, c.op, c.value), progress: Math.max(0, Math.min(ratio, 1)), _ratio: ratio };
  });
  const n = Math.max(criteria.length, 1);
  const progress = criteria.reduce((s, c) => s + c.progress, 0) / n;
  const score = Math.round((100 * criteria.reduce((s, c) => s + Math.min(Math.max(c._ratio, 0), 1.25), 0)) / n / 1.25);
  return {
    rule_id: rule.id,
    track: rule.track,
    label: rule.label,
    pass: criteria.length > 0 && criteria.every((c) => c.pass),
    progress: Math.round(progress * 1000) / 1000,
    score,
    criteria: criteria.map(({ _ratio, ...c }) => ({ ...c, progress: Math.round(c.progress * 1000) / 1000 })),
  };
}

export interface Progress { user_id: string; metrics: Metrics; rules: RuleResult[]; primary: RuleResult | null }

/** Scout progress for the profile bar (Omar) and the dashboard. Read-only. */
export async function getProgress(db: Db, userId: string): Promise<Progress> {
  const metrics = await collectMetrics(db, userId);
  const rules = getRules().rules.filter((r) => r.enabled).map((r) => evaluateRule(r, metrics));
  return { user_id: userId, metrics, rules, primary: rules.find((r) => r.track === 'player') ?? rules[0] ?? null };
}

export interface EvaluateResult extends Progress { created: { id: string; rule_id: string }[] }

/**
 * Evaluate all enabled rules; create a scout report for each newly passed rule.
 * Idempotent: skips a rule if the user already has an open report for it.
 */
export async function evaluate(db: Db, userId: string): Promise<EvaluateResult> {
  const progress = await getProgress(db, userId);
  const created: EvaluateResult['created'] = [];

  for (const result of progress.rules.filter((r) => r.pass)) {
    const open = await db.query(
      `SELECT 1 FROM scout_reports WHERE user_id = $1 AND rule_id = $2 AND status = ANY($3::text[]) LIMIT 1`,
      [userId, result.rule_id, OPEN_STATUSES],
    );
    if (open.rows.length) continue;

    const [user, topClips] = await Promise.all([
      db.query<{ handle: string; display_name: string | null; region: string | null }>(
        `SELECT u.handle, u.display_name, g.region
           FROM users u LEFT JOIN game_accounts g ON g.user_id = u.id AND g.game = 'cs2'
          WHERE u.id = $1`,
        [userId],
      ),
      db.query<{ clip_id: string; title: string | null; map: string | null; overall_score: number; summary: string | null }>(
        `SELECT c.id AS clip_id, c.title, c.map, r.overall_score, r.summary
           FROM clips c JOIN coaching_reports r ON r.clip_id = c.id
          WHERE c.user_id = $1
          ORDER BY r.overall_score DESC, r.created_at DESC LIMIT 3`,
        [userId],
      ),
    ]);
    const u = user.rows[0];
    if (!u) continue;

    const { summary, source } = await writeScoutReport({
      handle: u.handle,
      displayName: u.display_name,
      region: u.region,
      metrics: progress.metrics,
      topClips: topClips.rows.map(({ clip_id, ...c }) => c),
    });

    const evidence = {
      score: result.score,
      rule_label: result.label,
      criteria: result.criteria,
      metrics: progress.metrics,
      top_clip_ids: topClips.rows.map((c) => c.clip_id),
      summary_source: source,
      evaluated_at: new Date().toISOString(),
    };
    const ins = await db.query<{ id: string }>(
      `INSERT INTO scout_reports (user_id, track, rule_id, summary, evidence, status)
       VALUES ($1, $2, $3, $4, $5, 'new') RETURNING id`,
      [userId, result.track, result.rule_id, summary, JSON.stringify(evidence)],
    );
    created.push({ id: String(ins.rows[0].id), rule_id: result.rule_id });
  }

  return { ...progress, created };
}
