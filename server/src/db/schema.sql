-- FaZe HQ schema: REQUIREMENTS.md §7.2. SHARED FILE: additive changes only.
-- (coaching_reports is legacy since the V3 pivot: kept, never dropped, no longer written.)
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

-- ---------- V3 pivot: fan profile + Phase 2 contracts (REQUIREMENTS.md §7.2) ----------

-- ADDITIVE (V3): fan profile bio (edited by the owner).
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text;

-- FaZe Live event bus log (Phase 2: director console / match feed writes, RGB Sync + The Wall + Home read).
CREATE TABLE IF NOT EXISTS live_events (
  time        timestamptz NOT NULL DEFAULT now(),
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id    uuid,
  type        text NOT NULL CHECK (type IN ('match_start', 'round_win', 'round_loss', 'ace', 'clutch', 'match_win', 'match_loss', 'match_end')),
  game        text NOT NULL DEFAULT 'cs2' CHECK (game IN ('cs2', 'r6', 'cod')),
  opponent    text NOT NULL,
  faze_score  int NOT NULL DEFAULT 0,
  opp_score   int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS live_events_match_time_idx ON live_events (match_id, time DESC);

-- The Wall placements (Phase 2): timelapse replay, per-user stats, admin rollback.
CREATE TABLE IF NOT EXISTS pixel_events (
  time     timestamptz NOT NULL DEFAULT now(),
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  canvas   text NOT NULL DEFAULT 'main',
  x        smallint NOT NULL CHECK (x >= 0),
  y        smallint NOT NULL CHECK (y >= 0),
  color    smallint NOT NULL CHECK (color >= 0)
);
CREATE INDEX IF NOT EXISTS pixel_events_canvas_time_idx ON pixel_events (canvas, time DESC);
CREATE INDEX IF NOT EXISTS pixel_events_user_time_idx ON pixel_events (user_id, time DESC);

-- FaZe Guessr (Phase 2). x/y are 0..1 radar-image coordinates; day is set for the daily puzzle.
CREATE TABLE IF NOT EXISTS guessr_puzzles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day          date UNIQUE,
  map          text NOT NULL,
  image_url    text NOT NULL,
  x            real NOT NULL CHECK (x BETWEEN 0 AND 1),
  y            real NOT NULL CHECK (y BETWEEN 0 AND 1),
  event_name   text,
  year         int,
  youtube_url  text,
  t_seconds    int,
  blurb        text,
  choices      jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guessr_guesses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  puzzle_id     uuid NOT NULL REFERENCES guessr_puzzles(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  x             real NOT NULL,
  y             real NOT NULL,
  event_choice  text,
  distance      real,
  score         int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (puzzle_id, user_id)
);
CREATE INDEX IF NOT EXISTS guessr_guesses_puzzle_score_idx ON guessr_guesses (puzzle_id, score DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb') THEN
    CREATE EXTENSION IF NOT EXISTS timescaledb;
    PERFORM create_hypertable('player_stats', 'time', if_not_exists => TRUE, migrate_data => TRUE);
    PERFORM create_hypertable('social_stats', 'time', if_not_exists => TRUE, migrate_data => TRUE);
    PERFORM create_hypertable('live_events', 'time', if_not_exists => TRUE, migrate_data => TRUE);
    PERFORM create_hypertable('pixel_events', 'time', if_not_exists => TRUE, migrate_data => TRUE);
    RAISE NOTICE 'player_stats, social_stats, live_events, pixel_events are hypertables';
  ELSE
    RAISE NOTICE 'TimescaleDB not available: time-series tables stay plain (leaderboards.sql will be skipped)';
  END IF;
END $$;

-- ---------- Clip analysis pipeline (Joe): Gemini + ElevenLabs, see server/src/lib/media ----------
ALTER TABLE clips ADD COLUMN IF NOT EXISTS job_id     uuid;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS source_url text;          -- original video, deep-linked to the moment
ALTER TABLE clips ADD COLUMN IF NOT EXISTS start_s    real;          -- position in the original video
ALTER TABLE clips ADD COLUMN IF NOT EXISTS end_s      real;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS category   text;          -- pro | funny | content
ALTER TABLE clips ADD COLUMN IF NOT EXISTS ai_score   int;           -- 0-100
ALTER TABLE clips ADD COLUMN IF NOT EXISTS ai_reason  text;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS ai_rules   text[];        -- scoring rules that fired

CREATE TABLE IF NOT EXISTS clip_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  source      text NOT NULL,                 -- video URL or local file path
  platform    text,                          -- twitch | youtube | folder
  title       text,
  status      text NOT NULL DEFAULT 'queued', -- queued | running | done | failed
  stage       text,
  progress    real NOT NULL DEFAULT 0,
  error       text,
  clip_count  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clip_jobs_user_idx ON clip_jobs (user_id, created_at DESC);

-- per-0.5s analysis signals for a video (time = job start + offset): loudness, gunfire, speech, laughter, rule score...
CREATE TABLE IF NOT EXISTS clip_signals (
  time    timestamptz NOT NULL,
  job_id  uuid NOT NULL,
  kind    text NOT NULL,
  value   double precision NOT NULL
);
CREATE INDEX IF NOT EXISTS clip_signals_job_kind_time_idx ON clip_signals (job_id, kind, time);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    PERFORM create_hypertable('clip_signals', 'time', if_not_exists => TRUE, migrate_data => TRUE);
  END IF;
END $$;
