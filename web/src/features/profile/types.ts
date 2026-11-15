// Mirrors the JSON returned by server/src/routes/profiles.ts (owner: Omar).

export type StatKey = "elo" | "kd" | "hs_pct" | "adr" | "win_rate";

export type TrendPoint = { t: string; v: number };

export type ScoutCriterion = { metric: string; label: string; current: number | null; target: number; met: boolean };

export type ScoutProgress = {
  status: "reported" | "in_progress" | "unavailable";
  progress: number | null;
  rule_id: string | null;
  criteria: ScoutCriterion[];
  report: { id: string; status: string; created_at: string } | null;
};

export type ProfileClip = {
  id: string;
  title: string | null;
  map: string | null;
  side: string | null;
  thumbnail_url: string | null;
  blob_url: string | null;
  social_post_url: string | null;
  status: string | null;
  created_at: string;
};

export type Profile = {
  user: { id: string; handle: string; display_name: string; avatar_url: string | null; role: string; bio: string | null; created_at: string };
  game: { faceit_nickname: string | null; region: string | null; faceit_level: number | null; faceit_elo: number | null; premier_rating: number | null } | null;
  linked_accounts: { platform: string; handle: string; url: string | null }[];
  stats: Partial<Record<StatKey, { value: number; delta_30d: number | null; updated_at: string }>>;
  trends: Partial<Record<StatKey, TrendPoint[]>>;
  social: { platform: string; followers: number | null; views: number | null; engagement_rate: number | null; followers_growth_30d: number | null }[];
  clips: ProfileClip[];
  clip_count: number;
  karma: number;
  elo_rank: { rank: number; total: number } | null;
  /** Recruiting data: real values for recruiter/admin viewers only (server-gated). */
  scout: ScoutProgress;
  dossier: Dossier | null;
  activity: Activity;
};

export type Activity = {
  thread_count: number;
  comment_count: number;
  threads: { id: string; title: string; score: number; created_at: string; board: string; board_name: string; comment_count: number }[];
  comments: { id: string; body: string; score: number; created_at: string; thread_id: string; thread_title: string }[];
};

export type Dossier = {
  percentiles: { metric: string; label: string; digits: number; value: number; better_than_pct: number | null; pool: number }[];
  form: {
    days_tracked: number;
    elo_delta: number | null;
    kd_delta: number | null;
    adr_delta: number | null;
    hs_delta: number | null;
    consistency: "high" | "steady" | "streaky" | null;
    consistency_cv: number | null;
  };
};

export type LeaderboardType = "elo" | "improvement" | "creator-growth" | "karma";

export type LeaderboardEntry = {
  rank: number;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  faceit_level: number | null;
  value: number;
  sample?: number;
};

export type Leaderboard = {
  type: LeaderboardType;
  label: string;
  unit: string;
  window_days: number | null;
  entries: LeaderboardEntry[];
};
