-- TEMPORARY sandbox schema: the subset of REQUIREMENTS.md §7.2 that Yao's features touch.
-- Column names match the contract exactly. Additive extras are marked "ADDITIVE" and
-- must be proposed to the team before going into server/src/db/schema.sql.
-- Runs on plain Postgres (13+) and on TigerData (hypertable created when TimescaleDB exists).

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle        text UNIQUE NOT NULL,
  display_name  text,
  avatar_url    text,
  role          text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'recruiter', 'admin')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_accounts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game              text NOT NULL DEFAULT 'cs2',
  faceit_nickname   text,
  faceit_player_id  text,
  steam_id64        text,
  region            text,
  faceit_level      int,
  faceit_elo        int,
  premier_rating    int
);

CREATE TABLE IF NOT EXISTS clips (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blob_url         text NOT NULL,
  thumbnail_url    text,
  game             text NOT NULL DEFAULT 'cs2',
  map              text,
  side             text,
  title            text,
  social_post_url  text,
  status           text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'analyzing', 'done', 'failed')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coaching_reports (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id          uuid NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  overall_score    int NOT NULL,
  category_scores  jsonb NOT NULL,
  notes            jsonb NOT NULL,
  drills           jsonb NOT NULL,
  model            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
-- ADDITIVE: §7.3 JSON has "summary" but §7.2 coaching_reports has no column for it.
ALTER TABLE coaching_reports ADD COLUMN IF NOT EXISTS summary text;
CREATE INDEX IF NOT EXISTS coaching_reports_clip_idx ON coaching_reports (clip_id, created_at DESC);

CREATE TABLE IF NOT EXISTS scout_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track       text NOT NULL CHECK (track IN ('player', 'creator')),
  rule_id     text NOT NULL,
  summary     text NOT NULL,
  evidence    jsonb NOT NULL DEFAULT '{}'::jsonb,
  audio_url   text,
  status      text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'contacted', 'passed')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Time-series (hypertable on TigerData)
CREATE TABLE IF NOT EXISTS player_stats (
  time     timestamptz NOT NULL,
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game     text NOT NULL DEFAULT 'cs2',
  metric   text NOT NULL,
  value    double precision NOT NULL
);
CREATE INDEX IF NOT EXISTS player_stats_user_metric_time_idx ON player_stats (user_id, metric, time DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb') THEN
    CREATE EXTENSION IF NOT EXISTS timescaledb;
    PERFORM create_hypertable('player_stats', 'time', if_not_exists => TRUE, migrate_data => TRUE);
    RAISE NOTICE 'player_stats is a hypertable';
  ELSE
    RAISE NOTICE 'TimescaleDB not available: player_stats stays a plain table';
  END IF;
END $$;
