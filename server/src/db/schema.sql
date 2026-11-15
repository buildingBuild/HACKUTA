-- FaZe HQ schema: REQUIREMENTS.md §7.2. SHARED FILE: additive changes only.
-- Safe to re-run. Runs on TigerData (hypertables) and plain Postgres 13+ (plain tables).
-- Apply with: npm run db:migrate   (also applies leaderboards.sql afterwards)

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
CREATE INDEX IF NOT EXISTS game_accounts_user_idx ON game_accounts (user_id, game);

CREATE TABLE IF NOT EXISTS social_accounts (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform  text NOT NULL,
  handle    text NOT NULL,
  url       text
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
CREATE INDEX IF NOT EXISTS clips_user_idx ON clips (user_id, created_at DESC);

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
-- ADDITIVE (Yao): §7.3 coaching JSON has "summary"; §7.2 had no column for it.
ALTER TABLE coaching_reports ADD COLUMN IF NOT EXISTS summary text;
CREATE INDEX IF NOT EXISTS coaching_reports_clip_idx ON coaching_reports (clip_id, created_at DESC);

CREATE TABLE IF NOT EXISTS communities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text UNIQUE NOT NULL,
  name         text NOT NULL,
  description  text
);

CREATE TABLE IF NOT EXISTS threads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id  uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          text NOT NULL DEFAULT 'post' CHECK (type IN ('post', 'challenge')),
  title         text NOT NULL,
  body          text,
  clip_id       uuid REFERENCES clips(id) ON DELETE SET NULL,
  score         int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  parent_id   uuid REFERENCES comments(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        text NOT NULL,
  clip_id     uuid REFERENCES clips(id) ON DELETE SET NULL,
  score       int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS votes (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type  text NOT NULL CHECK (target_type IN ('thread', 'comment')),
  target_id    uuid NOT NULL,
  value        smallint NOT NULL CHECK (value IN (-1, 1)),
  PRIMARY KEY (user_id, target_type, target_id)
);

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

-- ---------- time-series (hypertables on TigerData) ----------

CREATE TABLE IF NOT EXISTS player_stats (
  time     timestamptz NOT NULL,
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game     text NOT NULL DEFAULT 'cs2',
  metric   text NOT NULL,
  value    double precision NOT NULL
);
CREATE INDEX IF NOT EXISTS player_stats_user_metric_time_idx ON player_stats (user_id, metric, time DESC);

CREATE TABLE IF NOT EXISTS social_stats (
  time             timestamptz NOT NULL,
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform         text NOT NULL,
  followers        bigint,
  views            bigint,
  engagement_rate  double precision
);
CREATE INDEX IF NOT EXISTS social_stats_user_time_idx ON social_stats (user_id, platform, time DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb') THEN
    CREATE EXTENSION IF NOT EXISTS timescaledb;
    PERFORM create_hypertable('player_stats', 'time', if_not_exists => TRUE, migrate_data => TRUE);
    PERFORM create_hypertable('social_stats', 'time', if_not_exists => TRUE, migrate_data => TRUE);
    RAISE NOTICE 'player_stats + social_stats are hypertables';
  ELSE
    RAISE NOTICE 'TimescaleDB not available: time-series tables stay plain (leaderboards.sql will be skipped)';
  END IF;
END $$;
