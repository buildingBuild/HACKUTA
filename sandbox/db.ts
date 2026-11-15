// TEMPORARY sandbox DB pool. Replace with server/src/db/client.ts after merge.
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Copy sandbox/.env.example to ../.env (repo root) and fill it in.');
  process.exit(1);
}

export const pool = new pg.Pool({
  // TLS is configured below; drop sslmode from the URL so pg doesn't warn/override.
  connectionString: url.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, ''),
  // Hosted Postgres / TigerData require TLS; local Postgres usually doesn't.
  ssl: /localhost|127\.0\.0\.1/.test(url) || process.env.PGSSL === 'off' ? undefined : { rejectUnauthorized: false },
  max: 5,
});
