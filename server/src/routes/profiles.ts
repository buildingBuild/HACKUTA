// Profiles + leaderboards (owner: Omar). See REQUIREMENTS.md §5.4.
//
// Mount from app.ts:
//   import { createProfilesRouter } from "./routes/profiles.js";
//   app.use("/api", createProfilesRouter({ db: pool }));
//
// Routes:
//   POST /api/profiles                   onboarding -> create player (409 if tag taken by someone else)
//   GET /api/handles/:gamertag           is this tag available?
//   PUT /api/profiles/:handle/faceit     link your FACEIT nickname (own profile only)
//   GET /api/profiles/:handle            public gamer resume
//   GET /api/profiles/:handle/card.svg   shareable profile card (1200x630)
//   GET /api/leaderboards                list of leaderboard types
//   GET /api/leaderboards/:type          elo | clip-score | improvement | creator-growth | karma
//
// Read-only: this file never writes. Stats come from player_stats/social_stats
// (Yao), clip scores from coaching_reports (Yao), karma from threads/comments
// (Dahiya), scout status from scout_reports (Yao).

import { Router, type Request, type Response, type NextFunction } from "express";
import type { Pool, QueryResultRow } from "pg";
import { readFile, access } from "node:fs/promises";
import path from "node:path";

type Db = Pick<Pool, "query">;

export type ScoutCriterion = { metric: string; label: string; current: number | null; target: number; met: boolean };
export type ScoutProgress = {
  status: "reported" | "in_progress" | "unavailable";
  progress: number | null; // 0..1
  rule_id: string | null;
  criteria: ScoutCriterion[];
  report: { id: string; status: string; created_at: string } | null;
};

export type ProfilesRouterOptions = {
  db: Db;
  /** Yao's scoring hook. If provided, it fully replaces the built-in progress reader. */
  scoutProgress?: (db: Db, userId: string) => Promise<ScoutProgress | null>;
  /** Defaults to server/src/config/scouting-rules.json */
  rulesPath?: string | URL;
};

const STAT_METRICS = ["elo", "kd", "hs_pct", "adr", "win_rate"] as const;

const LEADERBOARDS = {
  elo: { label: "FACEIT ELO", unit: "ELO" },
  "clip-score": { label: "AI clip score", unit: "avg score" },
  improvement: { label: "Most improved", unit: "ELO gained" },
  "creator-growth": { label: "Creator growth", unit: "follower growth" },
  karma: { label: "Community karma", unit: "karma" },
} as const;
type LeaderboardType = keyof typeof LEADERBOARDS;

// ---------- helpers ----------

const num = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));

async function rows<T extends QueryResultRow>(db: Db, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

async function hasRelation(db: Db, name: string): Promise<boolean> {
  const r = await rows<{ ok: boolean }>(db, "SELECT to_regclass($1) IS NOT NULL AS ok", [name]);
  return r[0]?.ok ?? false;
}

function clampInt(v: unknown, def: number, min: number, max: number): number {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}

const asyncRoute =
  (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

// ---------- scout progress (reads Yao's rules + reports) ----------

type RuleCriterion = { metric: string; op: string; value: number; label?: string };
type Rule = { id: string; track: string; criteria: RuleCriterion[] };

const METRIC_LABELS: Record<string, string> = {
  faceit_level: "FACEIT level", elo: "ELO", faceit_elo: "ELO", kd: "K/D", kr: "K/R", hs_pct: "HS%",
  adr: "ADR", win_rate: "Win rate", avg_clip_score: "Avg AI clip score", clip_score: "Avg AI clip score",
};

/** Accepts a few likely shapes of scouting-rules.json so we don't break when Yao finalizes it. */
function parseRules(raw: unknown): Rule[] {
  const list: unknown[] = Array.isArray(raw) ? raw : Array.isArray((raw as { rules?: unknown })?.rules) ? (raw as { rules: unknown[] }).rules : [];
  const out: Rule[] = [];
  for (const r of list) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    let crit: RuleCriterion[] = [];
    if (Array.isArray(o.criteria)) {
      crit = o.criteria.flatMap((c): RuleCriterion[] => {
        const x = c as Record<string, unknown>;
        const value = Number(x.value ?? x.min ?? x.threshold);
        return typeof x.metric === "string" && Number.isFinite(value)
          ? [{ metric: x.metric, op: String(x.op ?? x.operator ?? ">="), value, label: typeof x.label === "string" ? x.label : undefined }]
          : [];
      });
    } else if (o.thresholds && typeof o.thresholds === "object") {
      // { thresholds: { kd: 1.25, adr: 85 } } means each one is ">="
      crit = Object.entries(o.thresholds as Record<string, unknown>)
        .filter(([, v]) => Number.isFinite(Number(v)))
        .map(([metric, v]) => ({ metric, op: ">=", value: Number(v) }));
    }
    if (crit.length) out.push({ id: String(o.id ?? o.rule_id ?? "rule"), track: String(o.track ?? "player"), criteria: crit });
  }
  return out;
}

/** Works whether the server runs from the repo root or from server/, in ESM or CJS builds. */
async function defaultRulesPath(): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), "server/src/config/scouting-rules.json"),
    path.resolve(process.cwd(), "src/config/scouting-rules.json"),
  ];
  for (const c of candidates) {
    try {
      await access(c);
      return c;
    } catch {
      /* try next */
    }
  }
  return candidates[0]!;
}

function meets(op: string, cur: number, target: number): boolean {
  switch (op) {
    case ">": return cur > target;
    case "<": return cur < target;
    case "<=": return cur <= target;
    case "=": case "==": return cur === target;
    default: return cur >= target;
  }
}

async function builtinScoutProgress(db: Db, userId: string, rulesPath: string | URL, metrics: Record<string, number | null>): Promise<ScoutProgress> {
  const [report] = await rows<{ id: string; status: string; created_at: string; rule_id: string | null }>(
    db,
    `SELECT id, status, created_at, rule_id FROM scout_reports
      WHERE user_id = $1 AND track = 'player' ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );

  let rules: Rule[] = [];
  try {
    rules = parseRules(JSON.parse(await readFile(rulesPath, "utf8"))).filter((r) => r.track === "player");
  } catch {
    rules = [];
  }
  const rule = (report?.rule_id && rules.find((r) => r.id === report.rule_id)) || rules[0];

  const criteria: ScoutCriterion[] = (rule?.criteria ?? []).map((c) => {
    const current = metrics[c.metric] ?? null;
    return {
      metric: c.metric,
      label: c.label ?? METRIC_LABELS[c.metric] ?? c.metric,
      current,
      target: c.value,
      met: current !== null && meets(c.op, current, c.value),
    };
  });

  // Progress shown on the bar: average of each criterion's closeness to its target, capped at 1.
  const progress = criteria.length
    ? criteria.reduce((s, c) => s + (c.current === null || c.target === 0 ? 0 : Math.min(1, Math.max(0, c.current / c.target))), 0) / criteria.length
    : null;

  const reportOut = report ? { id: report.id, status: report.status, created_at: report.created_at } : null;
  if (report) return { status: "reported", progress: 1, rule_id: report.rule_id ?? rule?.id ?? null, criteria, report: reportOut };
  if (!rule) return { status: "unavailable", progress: null, rule_id: null, criteria: [], report: null };
  // All bars met but Yao's job hasn't filed the report yet: show 100%, status stays in_progress.
  const allMet = criteria.length > 0 && criteria.every((c) => c.met);
  return { status: "in_progress", progress: allMet ? 1 : Math.min(progress ?? 0, 0.99), rule_id: rule.id, criteria, report: null };
}

// ---------- data loaders ----------

type UserRow = { id: string; handle: string; display_name: string | null; avatar_url: string | null; role: string; created_at: string; bio: string | null };

async function loadUser(db: Db, handle: string): Promise<UserRow | undefined> {
  const [u] = await rows<UserRow>(
    db,
    `SELECT u.id, u.handle, u.display_name, u.avatar_url, u.role, u.created_at, to_jsonb(u)->>'bio' AS bio
       FROM users u WHERE lower(u.handle) = lower($1) LIMIT 1`,
    [handle],
  );
  return u;
}

async function loadProfile(db: Db, opts: ProfilesRouterOptions, user: UserRow) {
  const uid = user.id;
  const useDaily = await hasRelation(db, "player_stats_daily");
  const useSocialDaily = await hasRelation(db, "social_stats_daily");

  const [game] = await rows<Record<string, unknown>>(
    db,
    `SELECT faceit_nickname, faceit_player_id, steam_id64, region, faceit_level, faceit_elo, premier_rating
       FROM game_accounts WHERE user_id = $1 AND game = 'cs2' LIMIT 1`,
    [uid],
  );

  const socialAccounts = await rows<{ platform: string; handle: string; url: string | null }>(
    db, `SELECT platform, handle, url FROM social_accounts WHERE user_id = $1 ORDER BY platform`, [uid],
  );

  // Latest value per metric, and value at the start of the 30-day window (for deltas).
  const latest = await rows<{ metric: string; value: number; time: string }>(
    db,
    `SELECT DISTINCT ON (metric) metric, value, time FROM player_stats
      WHERE user_id = $1 AND metric = ANY($2) ORDER BY metric, time DESC`,
    [uid, STAT_METRICS],
  );
  const start = await rows<{ metric: string; value: number }>(
    db,
    `SELECT DISTINCT ON (metric) metric, value FROM player_stats
      WHERE user_id = $1 AND metric = ANY($2) AND time >= now() - interval '30 days' ORDER BY metric, time ASC`,
    [uid, STAT_METRICS],
  );
  const startBy = new Map(start.map((r) => [r.metric, Number(r.value)]));
  const stats: Record<string, { value: number; delta_30d: number | null; updated_at: string }> = {};
  for (const r of latest) {
    const s = startBy.get(r.metric);
    stats[r.metric] = { value: Number(r.value), delta_30d: s === undefined ? null : Number(r.value) - s, updated_at: r.time };
  }

  // Daily trend points (continuous aggregate when present).
  const trendRows = useDaily
    ? await rows<{ t: string; metric: string; v: number }>(
        db,
        `SELECT bucket AS t, metric, last_value AS v FROM player_stats_daily
          WHERE user_id = $1 AND metric = ANY($2) AND bucket >= now() - interval '30 days' ORDER BY bucket`,
        [uid, STAT_METRICS],
      )
    : await rows<{ t: string; metric: string; v: number }>(
        db,
        `SELECT DISTINCT ON (date_trunc('day', time), metric) date_trunc('day', time) AS t, metric, value AS v
           FROM player_stats WHERE user_id = $1 AND metric = ANY($2) AND time >= now() - interval '30 days'
          ORDER BY date_trunc('day', time), metric, time DESC`,
        [uid, STAT_METRICS],
      );
  const trends: Record<string, { t: string; v: number }[]> = {};
  for (const r of trendRows) (trends[r.metric] ??= []).push({ t: r.t, v: Number(r.v) });

  // Social stats: latest per platform + 30d follower growth.
  const social = await rows<{ platform: string; followers: number | null; views: number | null; engagement_rate: number | null; followers_30d_ago: number | null }>(
    db,
    useSocialDaily
      ? `SELECT DISTINCT ON (platform) platform, followers, views, engagement_rate,
                (SELECT s2.followers FROM social_stats_daily s2 WHERE s2.user_id = s.user_id AND s2.platform = s.platform
                   AND s2.bucket >= now() - interval '30 days' ORDER BY s2.bucket ASC LIMIT 1) AS followers_30d_ago
           FROM social_stats_daily s WHERE user_id = $1 ORDER BY platform, bucket DESC`
      : `SELECT DISTINCT ON (platform) platform, followers, views, engagement_rate,
                (SELECT s2.followers FROM social_stats s2 WHERE s2.user_id = s.user_id AND s2.platform = s.platform
                   AND s2.time >= now() - interval '30 days' ORDER BY s2.time ASC LIMIT 1) AS followers_30d_ago
           FROM social_stats s WHERE user_id = $1 ORDER BY platform, time DESC`,
    [uid],
  );

  // Clips with their latest coaching report.
  const clips = await rows<Record<string, unknown>>(
    db,
    `SELECT c.id, c.title, c.map, c.side, c.thumbnail_url, c.blob_url, c.social_post_url, c.status, c.created_at,
            r.overall_score, r.category_scores, r.summary
       FROM clips c
       LEFT JOIN LATERAL (
         SELECT cr.overall_score, cr.category_scores,
                COALESCE(to_jsonb(cr)->>'summary', cr.category_scores->>'summary') AS summary
           FROM coaching_reports cr WHERE cr.clip_id = c.id ORDER BY cr.created_at DESC LIMIT 1
       ) r ON true
      WHERE c.user_id = $1
      ORDER BY r.overall_score DESC NULLS LAST, c.created_at DESC`,
    [uid],
  );
  const scored = clips.map((c) => num(c.overall_score)).filter((s): s is number => s !== null);
  const avgClipScore = scored.length ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10 : null;

  const [k] = await rows<{ karma: number }>(
    db,
    `SELECT COALESCE((SELECT sum(score) FROM threads WHERE user_id = $1), 0)
          + COALESCE((SELECT sum(score) FROM comments WHERE user_id = $1), 0) AS karma`,
    [uid],
  );

  const elo = num(game?.faceit_elo) ?? stats.elo?.value ?? null;
  const [rank] = elo === null ? [] : await rows<{ rank: number; total: number }>(
    db,
    `SELECT (SELECT count(*) FROM game_accounts ga JOIN users u ON u.id = ga.user_id
              WHERE u.role = 'user' AND ga.game = 'cs2' AND ga.faceit_elo > $1) + 1 AS rank,
            (SELECT count(*) FROM game_accounts ga JOIN users u ON u.id = ga.user_id
              WHERE u.role = 'user' AND ga.game = 'cs2' AND ga.faceit_elo IS NOT NULL) AS total`,
    [elo],
  );

  const metricsForScout: Record<string, number | null> = {
    faceit_level: num(game?.faceit_level),
    faceit_elo: elo,
    elo,
    avg_clip_score: avgClipScore,
    clip_score: avgClipScore,
  };
  for (const m of STAT_METRICS) if (m !== "elo") metricsForScout[m] = stats[m]?.value ?? null;

  const rulesPath = opts.rulesPath ?? (await defaultRulesPath());
  let scout: ScoutProgress | null = null;
  try {
    scout = opts.scoutProgress ? await opts.scoutProgress(db, uid) : await builtinScoutProgress(db, uid, rulesPath, metricsForScout);
  } catch (err) {
    console.warn("[profiles] scout progress failed:", err);
  }
  scout ??= { status: "unavailable", progress: null, rule_id: null, criteria: [], report: null };

  const linked = [
    ...(game?.faceit_nickname ? [{ platform: "faceit", handle: String(game.faceit_nickname), url: `https://www.faceit.com/en/players/${encodeURIComponent(String(game.faceit_nickname))}` }] : []),
    ...(game?.steam_id64 ? [{ platform: "steam", handle: String(game.steam_id64), url: `https://steamcommunity.com/profiles/${encodeURIComponent(String(game.steam_id64))}` }] : []),
    ...socialAccounts,
  ];

  return {
    user: { id: user.id, handle: user.handle, display_name: user.display_name ?? user.handle, avatar_url: user.avatar_url, role: user.role, bio: user.bio, created_at: user.created_at },
    game: game
      ? { faceit_nickname: game.faceit_nickname ?? null, region: game.region ?? null, faceit_level: num(game.faceit_level), faceit_elo: elo, premier_rating: num(game.premier_rating) }
      : null,
    linked_accounts: linked,
    stats,
    trends,
    social: social.map((s) => {
      const f = num(s.followers), f0 = num(s.followers_30d_ago);
      return { platform: s.platform, followers: f, views: num(s.views), engagement_rate: num(s.engagement_rate), followers_growth_30d: f !== null && f0 ? (f - f0) / f0 : null };
    }),
    clips: clips.slice(0, 6).map((c) => ({
      id: c.id, title: c.title, map: c.map, side: c.side, thumbnail_url: c.thumbnail_url, blob_url: c.blob_url,
      social_post_url: c.social_post_url, status: c.status, created_at: c.created_at,
      overall_score: num(c.overall_score), summary: c.summary ?? null,
    })),
    clip_count: clips.length,
    avg_clip_score: avgClipScore,
    karma: Number(k?.karma ?? 0),
    elo_rank: rank ? { rank: Number(rank.rank), total: Number(rank.total) } : null,
    scout,
  };
}

// ---------- leaderboards ----------

async function loadLeaderboard(db: Db, type: LeaderboardType, limit: number, windowDays: number) {
  const base = `FROM users u LEFT JOIN game_accounts ga ON ga.user_id = u.id AND ga.game = 'cs2' WHERE u.role = 'user'`;
  const cols = `u.handle, COALESCE(u.display_name, u.handle) AS display_name, u.avatar_url, ga.faceit_level`;
  const useDaily = await hasRelation(db, "player_stats_daily");
  const useSocialDaily = await hasRelation(db, "social_stats_daily");
  let sql: string;
  const params: unknown[] = [limit, windowDays];

  switch (type) {
    case "elo":
      sql = `SELECT ${cols}, ga.faceit_elo::float AS value ${base} AND ga.faceit_elo IS NOT NULL
              AND $2::int > 0 ORDER BY value DESC LIMIT $1`;
      break;
    case "clip-score":
      sql = `SELECT ${cols}, round(avg(r.overall_score)::numeric, 1)::float AS value, count(*)::int AS sample
               ${base.replace("WHERE", `JOIN clips c ON c.user_id = u.id
               JOIN LATERAL (SELECT overall_score FROM coaching_reports cr WHERE cr.clip_id = c.id ORDER BY cr.created_at DESC LIMIT 1) r ON true
               WHERE`)} AND r.overall_score IS NOT NULL AND $2::int > 0
             GROUP BY u.id, ga.faceit_level ORDER BY value DESC LIMIT $1`;
      break;
    case "improvement": {
      const src = useDaily
        ? `SELECT user_id, first(last_value, bucket) AS v0, last(last_value, bucket) AS v1 FROM player_stats_daily
            WHERE metric = 'elo' AND bucket >= now() - make_interval(days => $2::int) GROUP BY user_id`
        : `SELECT user_id, (array_agg(value ORDER BY time ASC))[1] AS v0, (array_agg(value ORDER BY time DESC))[1] AS v1 FROM player_stats
            WHERE metric = 'elo' AND time >= now() - make_interval(days => $2::int) GROUP BY user_id`;
      sql = `SELECT ${cols}, round((d.v1 - d.v0)::numeric)::float AS value
               ${base.replace("WHERE", `JOIN (${src}) d ON d.user_id = u.id WHERE`)}
             ORDER BY value DESC LIMIT $1`;
      break;
    }
    case "creator-growth": {
      const src = useSocialDaily
        ? `SELECT user_id, platform, first(followers, bucket) AS f0, last(followers, bucket) AS f1 FROM social_stats_daily
            WHERE bucket >= now() - make_interval(days => $2::int) GROUP BY user_id, platform`
        : `SELECT user_id, platform, (array_agg(followers ORDER BY time ASC))[1] AS f0, (array_agg(followers ORDER BY time DESC))[1] AS f1 FROM social_stats
            WHERE time >= now() - make_interval(days => $2::int) GROUP BY user_id, platform`;
      sql = `SELECT ${cols}, ((sum(g.f1) - sum(g.f0)) / NULLIF(sum(g.f0), 0))::float AS value, sum(g.f1)::float AS sample
               ${base.replace("WHERE", `JOIN (${src}) g ON g.user_id = u.id WHERE`)}
             GROUP BY u.id, ga.faceit_level HAVING sum(g.f0) > 0 ORDER BY value DESC LIMIT $1`;
      break;
    }
    case "karma":
      sql = `SELECT ${cols}, (COALESCE(t.s, 0) + COALESCE(c.s, 0))::float AS value
               ${base.replace("WHERE", `LEFT JOIN (SELECT user_id, sum(score) s FROM threads GROUP BY user_id) t ON t.user_id = u.id
               LEFT JOIN (SELECT user_id, sum(score) s FROM comments GROUP BY user_id) c ON c.user_id = u.id WHERE`)}
               AND $2::int > 0 AND (t.s IS NOT NULL OR c.s IS NOT NULL)
             ORDER BY value DESC LIMIT $1`;
      break;
  }

  const list = await rows<{ handle: string; display_name: string; avatar_url: string | null; faceit_level: number | null; value: number; sample?: number }>(db, sql, params);
  return {
    type,
    ...LEADERBOARDS[type],
    window_days: type === "improvement" || type === "creator-growth" ? windowDays : null,
    entries: list.map((r, i) => ({
      rank: i + 1,
      handle: r.handle,
      display_name: r.display_name,
      avatar_url: r.avatar_url,
      faceit_level: num(r.faceit_level),
      value: Number(r.value),
      ...(r.sample !== undefined ? { sample: Number(r.sample) } : {}),
    })),
  };
}

// ---------- share card ----------

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fmt = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? "–" : v.toFixed(d));

function renderCard(p: Awaited<ReturnType<typeof loadProfile>>): string {
  const s = p.stats;
  const tiles: [string, string][] = [
    ["ELO", fmt(p.game?.faceit_elo)],
    ["K/D", fmt(s.kd?.value, 2)],
    ["HS%", fmt(s.hs_pct?.value, 0)],
    ["ADR", fmt(s.adr?.value, 0)],
    ["AI SCORE", fmt(p.avg_clip_score, 0)],
  ];
  const pct = Math.round((p.scout.progress ?? 0) * 100);
  const level = p.game?.faceit_level ?? "–";
  const tileSvg = tiles
    .map(([k, v], i) => {
      const x = 64 + i * 218;
      return `<g transform="translate(${x},330)"><rect width="200" height="130" rx="10" fill="#161616" stroke="#2a2a2a"/>
        <text x="20" y="42" font-size="20" fill="#9a9a9a" font-weight="700" letter-spacing="2">${k}</text>
        <text x="20" y="104" font-size="56" fill="#fff" font-weight="800">${esc(v)}</text></g>`;
    })
    .join("");
  const rank = p.elo_rank ? `#${p.elo_rank.rank} of ${p.elo_rank.total} by ELO` : "";
  const scoutLabel = p.scout.status === "reported" ? "SCOUT REPORT FILED" : p.scout.status === "in_progress" ? `SCOUT PROGRESS ${pct}%` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="'Barlow Condensed','Oswald','Arial Narrow',Arial,sans-serif">
  <rect width="1200" height="630" fill="#0a0a0a"/>
  <rect width="1200" height="8" fill="#e4002b"/>
  <path d="M900 0 L1200 0 L1200 630 L1060 630 Z" fill="#e4002b" opacity="0.12"/>
  <text x="64" y="92" font-size="26" fill="#e4002b" font-weight="800" letter-spacing="6">FAZE HQ · CS2 PORTFOLIO</text>
  <text x="64" y="190" font-size="96" fill="#fff" font-weight="800">${esc(p.user.display_name)}</text>
  <text x="64" y="244" font-size="34" fill="#bdbdbd" font-weight="600">@${esc(p.user.handle)}${p.game?.region ? ` · ${esc(p.game.region)}` : ""}${rank ? ` · ${esc(rank)}` : ""}</text>
  <g transform="translate(1010,110)"><circle r="70" fill="none" stroke="#e4002b" stroke-width="8"/>
    <text text-anchor="middle" y="-8" font-size="22" fill="#9a9a9a" font-weight="700" letter-spacing="2">LEVEL</text>
    <text text-anchor="middle" y="44" font-size="64" fill="#fff" font-weight="800">${esc(level)}</text></g>
  ${tileSvg}
  ${scoutLabel ? `<text x="64" y="530" font-size="24" fill="#fff" font-weight="800" letter-spacing="3">${scoutLabel}</text>
  <rect x="64" y="548" width="1072" height="14" rx="7" fill="#222"/>
  <rect x="64" y="548" width="${Math.round(10.72 * pct)}" height="14" rx="7" fill="#e4002b"/>` : ""}
  <text x="1136" y="604" text-anchor="end" font-size="18" fill="#6b6b6b">Fan-made HackUTA 2026 project. Not affiliated with FaZe Clan, Valve, or FACEIT.</text>
</svg>`;
}

// ---------- create profile (from onboarding) ----------

const SOCIAL_PLATFORMS = {
  twitch: (h: string) => `https://twitch.tv/${encodeURIComponent(h)}`,
  youtube: (h: string) => `https://youtube.com/@${encodeURIComponent(h)}`,
  psn: () => null,
  xbox: () => null,
} as const;
type SocialPlatform = keyof typeof SOCIAL_PLATFORMS;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** URL-safe handle from a gamertag: keeps letters, digits, _ . - ; everything else becomes _. */
export function toProfileHandle(gamertag: string): string {
  return gamertag.trim().replace(/^@+/, "").replace(/[^A-Za-z0-9_.-]+/g, "_").replace(/_+/g, "_").replace(/^[_.-]+|[_.-]+$/g, "").slice(0, 32);
}

const cleanStr = (v: unknown, max = 64): string => (typeof v === "string" ? v.trim().replace(/^@+/, "").slice(0, max) : "");

/** "https://twitch.tv/name", "youtube.com/@name" or "@name" -> "name". */
function socialHandle(v: unknown): string {
  const s = cleanStr(v, 200);
  const m = s.match(/(?:twitch\.tv|youtube\.com)\/(?:c\/|channel\/|user\/)?@?([^/?#\s]+)/i);
  if (!m) return cleanStr(s);
  try {
    return cleanStr(decodeURIComponent(m[1]!));
  } catch {
    return cleanStr(m[1]);
  }
}

type CreateBody = { gamertag?: unknown; game?: unknown; twitch?: unknown; youtube?: unknown; psn?: unknown; xbox?: unknown; faceit_nickname?: unknown; region?: unknown };

async function createOrUpdateProfile(db: Db, body: CreateBody, sessionUserId: string | null) {
  const gamertag = cleanStr(body.gamertag, 32);
  const handle = toProfileHandle(gamertag);
  if (handle.length < 2) return { status: 400, body: { error: "Gamertag needs at least 2 letters or numbers" } };
  const game = cleanStr(body.game, 16) || "cs2";
  if (game !== "cs2") return { status: 400, body: { error: "Only CS2 is live right now" } };

  const [existing] = await rows<{ id: string; handle: string }>(db, "SELECT id, handle FROM users WHERE lower(handle) = lower($1) LIMIT 1", [handle]);
  let userId: string;
  let created = false;
  if (existing) {
    // Re-running onboarding as the same signed-in player updates their links; anyone else gets 409.
    if (!sessionUserId || existing.id !== sessionUserId) return { status: 409, body: { error: `@${handle} is already taken`, handle } };
    userId = existing.id;
    await db.query("UPDATE users SET display_name = $2 WHERE id = $1", [userId, gamertag]);
  } else {
    const [u] = await rows<{ id: string }>(
      db,
      "INSERT INTO users (handle, display_name, role) VALUES ($1, $2, 'user') ON CONFLICT (handle) DO NOTHING RETURNING id",
      [handle, gamertag],
    );
    if (!u) return { status: 409, body: { error: `@${handle} is already taken`, handle } };
    userId = u.id;
    created = true;
  }

  const faceit = cleanStr(body.faceit_nickname, 32) || null;
  const region = cleanStr(body.region, 8) || null;
  const upd = await db.query(
    `UPDATE game_accounts SET faceit_nickname = COALESCE($2, faceit_nickname), region = COALESCE($3, region)
      WHERE user_id = $1 AND game = 'cs2'`,
    [userId, faceit, region],
  );
  if (!upd.rowCount) {
    await db.query("INSERT INTO game_accounts (user_id, game, faceit_nickname, region) VALUES ($1, 'cs2', $2, $3)", [userId, faceit, region]);
  }

  // Replace only the platforms onboarding knows about; leave anything else alone.
  const platforms = Object.keys(SOCIAL_PLATFORMS) as SocialPlatform[];
  const socials = platforms
    .map((p) => ({ platform: p, handle: socialHandle(body[p]) }))
    .filter((s) => s.handle.length > 0)
    .map((s) => ({ ...s, url: SOCIAL_PLATFORMS[s.platform](s.handle) }));
  await db.query("DELETE FROM social_accounts WHERE user_id = $1 AND platform = ANY($2)", [userId, platforms]);
  if (socials.length) {
    await db.query(
      `INSERT INTO social_accounts (user_id, platform, handle, url)
       SELECT $1, s.platform, s.handle, s.url FROM jsonb_to_recordset($2::jsonb) AS s(platform text, handle text, url text)`,
      [userId, JSON.stringify(socials)],
    );
  }

  const [user] = await rows<{ id: string; handle: string; display_name: string; role: string }>(
    db, "SELECT id, handle, display_name, role FROM users WHERE id = $1", [userId],
  );
  return { status: created ? 201 : 200, body: { user, created, profile_url: `/u/${encodeURIComponent(user!.handle)}` } };
}

// ---------- router ----------

export function createProfilesRouter(opts: ProfilesRouterOptions): Router {
  const { db } = opts;
  const router = Router();

  // Onboarding "FaZe up": create the player (or update links if it's already theirs).
  router.post("/profiles", asyncRoute(async (req, res) => {
    const sid = req.header("x-user-id") ?? null;
    const out = await createOrUpdateProfile(db, (req.body ?? {}) as CreateBody, sid && UUID.test(sid) ? sid : null);
    res.status(out.status).json(out.body);
  }));

  // Link (or change) your FACEIT nickname. The client then calls Yao's POST /api/players/:userId/sync.
  router.put("/profiles/:handle/faceit", asyncRoute(async (req, res) => {
    const user = await loadUser(db, String(req.params.handle));
    if (!user) return res.status(404).json({ error: "Profile not found" });
    if (req.header("x-user-id") !== user.id) return res.status(403).json({ error: "You can only link FACEIT on your own profile" });
    const nickname = cleanStr((req.body as { faceit_nickname?: unknown } | undefined)?.faceit_nickname, 40);
    if (!/^[A-Za-z0-9_.-]{2,32}$/.test(nickname)) return res.status(400).json({ error: "That doesn't look like a FACEIT nickname" });
    const upd = await db.query(
      `UPDATE game_accounts SET faceit_nickname = $2,
              faceit_player_id = CASE WHEN faceit_nickname IS DISTINCT FROM $2 THEN NULL ELSE faceit_player_id END
        WHERE user_id = $1 AND game = 'cs2'`,
      [user.id, nickname],
    );
    if (!upd.rowCount) await db.query("INSERT INTO game_accounts (user_id, game, faceit_nickname) VALUES ($1, 'cs2', $2)", [user.id, nickname]);
    res.json({ user_id: user.id, faceit_nickname: nickname });
  }));

  // Live "is this tag free?" check for the gamertag step.
  router.get("/handles/:gamertag", asyncRoute(async (req, res) => {
    const handle = toProfileHandle(String(req.params.gamertag));
    if (handle.length < 2) return res.json({ handle, available: false, reason: "too short" });
    const [u] = await rows<{ id: string }>(db, "SELECT id FROM users WHERE lower(handle) = lower($1) LIMIT 1", [handle]);
    const sid = req.header("x-user-id");
    res.json({ handle, available: !u || u.id === sid, mine: Boolean(u && u.id === sid) });
  }));

  router.get("/profiles/:handle", asyncRoute(async (req, res) => {
    const user = await loadUser(db, String(req.params.handle));
    if (!user) return res.status(404).json({ error: "Profile not found" });
    res.json(await loadProfile(db, opts, user));
  }));

  router.get("/profiles/:handle/card.svg", asyncRoute(async (req, res) => {
    const user = await loadUser(db, String(req.params.handle));
    if (!user) return res.status(404).json({ error: "Profile not found" });
    res.type("image/svg+xml").set("Cache-Control", "public, max-age=60").send(renderCard(await loadProfile(db, opts, user)));
  }));

  router.get("/leaderboards", (_req, res) => {
    res.json(Object.entries(LEADERBOARDS).map(([type, v]) => ({ type, ...v })));
  });

  router.get("/leaderboards/:type", asyncRoute(async (req, res) => {
    const type = String(req.params.type) as LeaderboardType;
    if (!(type in LEADERBOARDS)) return res.status(400).json({ error: `Unknown leaderboard. Use one of: ${Object.keys(LEADERBOARDS).join(", ")}` });
    const limit = clampInt(req.query.limit, 25, 1, 100);
    const windowDays = clampInt(req.query.window, 30, 1, 365);
    res.json(await loadLeaderboard(db, type, limit, windowDays));
  }));

  return router;
}

export default createProfilesRouter;
