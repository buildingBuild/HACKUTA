// npm run analyze -- <video URL | channel URL | folder> --user <handle> [--start 3600] [--duration 360] [--clips 3] [--limit 10]
import { pool } from '../../db/client.js';
import { resolveSources, runJob } from './analyze.js';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const source = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const handle = flag('user');
if (!source || !handle) {
  console.log('usage: npm run analyze -- <url|channel|folder> --user <handle> [--start s] [--duration s] [--clips n] [--limit n]');
  process.exit(1);
}

const num = (v?: string) => (v === undefined ? undefined : Number(v));
try {
  const { rows } = await pool.query<{ id: string }>(`SELECT id FROM users WHERE handle = $1`, [handle]);
  if (!rows[0]) throw new Error(`no user @${handle}`);
  const items = await resolveSources(source, num(flag('limit')) ?? 10);
  console.log(`${items.length} video(s) for @${handle}`);
  for (const it of items) {
    const { rows: [job] } = await pool.query<{ id: string }>(
      `INSERT INTO clip_jobs (user_id, source, platform, title) VALUES ($1, $2, $3, $4) RETURNING id`,
      [rows[0].id, it.source, it.platform, it.title ?? null],
    );
    const t = Date.now();
    console.log(`\n▶ ${it.title ?? it.source}`);
    try {
      const picks = await runJob(pool, job.id, { start: num(flag('start')), duration: num(flag('duration')), maxClips: num(flag('clips')) });
      for (const p of picks) console.log(`  [${p.category}] ${p.score} "${p.title}" ${p.start.toFixed(0)}-${p.end.toFixed(0)}s  rules: ${p.rules.join(', ') || '-'}\n      ${p.reason}`);
      console.log(`  ✓ ${picks.length} clips in ${((Date.now() - t) / 1000).toFixed(0)}s`);
    } catch (e) {
      console.log(`  ✗ ${(e as Error).message}`);
    }
  }
} finally {
  await pool.end();
}
