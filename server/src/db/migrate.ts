// Applies schema.sql, then leaderboards.sql (continuous aggregates, TigerData only).
// Usage: npm run db:migrate
import { readFileSync } from 'node:fs';
import { pool } from './client.js';

const read = (f: string) => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');

const client = await pool.connect();
client.on('notice', (n) => console.log('  notice:', n.message));
try {
  await client.query(read('schema.sql'));
  console.log('✓ schema.sql');

  const ts = await client.query(`SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'`);
  if (ts.rows.length) {
    // Continuous aggregates can't be created inside a transaction block, so run statements one by one.
    const statements = read('leaderboards.sql')
      .split(/;\s*(?:\r?\n|$)/)
      .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
      .filter(Boolean);
    for (const s of statements) await client.query(s);
    console.log('✓ leaderboards.sql');
  } else {
    console.log('- leaderboards.sql skipped (no TimescaleDB); profiles fall back to raw tables');
  }
} catch (e) {
  console.error('migration failed:', (e as Error).message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
