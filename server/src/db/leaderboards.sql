-- Profile + leaderboard rollups (owner: Omar). Additive only.
-- Run AFTER schema.sql (needs the player_stats and social_stats hypertables).
-- Safe to re-run.
--
-- materialized_only = false turns on real-time aggregation, so the views include
-- rows that the refresh policy hasn't materialized yet. Seeded data shows up instantly.
-- The profiles route falls back to the raw hypertables if these views don't exist.

CREATE MATERIALIZED VIEW IF NOT EXISTS player_stats_daily
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT
  time_bucket(INTERVAL '1 day', time) AS bucket,
  user_id,
  metric,
  last(value, time) AS last_value,
  avg(value)        AS avg_value,
  min(value)        AS min_value,
  max(value)        AS max_value
FROM player_stats
GROUP BY bucket, user_id, metric
WITH NO DATA;

CREATE MATERIALIZED VIEW IF NOT EXISTS social_stats_daily
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT
  time_bucket(INTERVAL '1 day', time) AS bucket,
  user_id,
  platform,
  last(followers, time)  AS followers,
  last(views, time)      AS views,
  avg(engagement_rate)   AS engagement_rate
FROM social_stats
GROUP BY bucket, user_id, platform
WITH NO DATA;

SELECT add_continuous_aggregate_policy('player_stats_daily',
  start_offset => INTERVAL '120 days', end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '15 minutes', if_not_exists => true);

SELECT add_continuous_aggregate_policy('social_stats_daily',
  start_offset => INTERVAL '120 days', end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '15 minutes', if_not_exists => true);

-- Weekly rollup for long-range trend charts (hierarchical continuous aggregate).
CREATE MATERIALIZED VIEW IF NOT EXISTS player_stats_weekly
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT
  time_bucket(INTERVAL '7 days', bucket) AS bucket,
  user_id,
  metric,
  last(last_value, bucket) AS last_value,
  avg(avg_value)           AS avg_value
FROM player_stats_daily
GROUP BY 1, user_id, metric
WITH NO DATA;

SELECT add_continuous_aggregate_policy('player_stats_weekly',
  start_offset => INTERVAL '365 days', end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 hour', if_not_exists => true);
