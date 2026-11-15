// Shared Postgres / TigerData pool. Import { pool } and pass it as `db` to routers.
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set (copy .env.example to .env at the repo root)');

const local = /localhost|127\.0\.0\.1/.test(url) || process.env.PGSSL === 'off';

export const pool = new pg.Pool({
  // TLS is configured here; strip sslmode from the URL so pg doesn't override it or warn.
  connectionString: url.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, ''),
  ssl: local ? undefined : { rejectUnauthorized: false },
  max: Number(process.env.PG_POOL_MAX || 5),
});

pool.on('error', (err) => console.error('[db] idle client error:', err.message));
