// Demo seed (REQUIREMENTS.md §7.6). SHARED FILE: each owner adds their own seed module
// and calls it below. Every seed only touches its own handles, so it's safe to re-run.
// Usage: npm run db:seed
import { seedCommunity } from '../routes/community.js';
import { pool } from './client.js';
import { seedFanHub } from './seed-fanhub.js';
import { seed as seedPlayers } from './seed-yao.js';

// §7.5 demo login picker accounts that aren't owned by a feature seed.
const FANS = [
  { handle: 'new_fan', display_name: 'New Fan (demo)', bio: 'Just found FaZe through a watch party. Learning the lore one Guessr at a time.' },
  { handle: 'og_fan', display_name: 'Returning Fan (demo)', bio: 'Watching since the ILLCAMS days. Lights go red when FaZe wins a round.' },
];

async function seedFans() {
  // Recreate so anything added while demoing (clips, linked FACEIT) is reset.
  await pool.query(`DELETE FROM users WHERE handle = ANY($1::text[])`, [FANS.map((f) => f.handle)]);
  for (const f of FANS) {
    await pool.query(`INSERT INTO users (handle, display_name, role, bio, created_at) VALUES ($1, $2, 'user', $3, now() - interval '40 days')`, [f.handle, f.display_name, f.bio]);
  }
  console.log(`✓ fans (${FANS.length})`);
}

/** Backdated seed rows sit behind the continuous-aggregate watermark, so re-materialize them (TimescaleDB only). */
async function refreshAggregates() {
  for (const view of ['player_stats_daily', 'social_stats_daily', 'player_stats_weekly']) {
    try {
      await pool.query(`CALL refresh_continuous_aggregate('${view}', NULL, NULL)`);
    } catch {
      /* plain Postgres or view missing: profiles fall back to raw tables */
    }
  }
  console.log('✓ refreshed continuous aggregates');
}

try {
  await seedFans();
  await seedPlayers(pool); // Yao: players, 30d stats, fan clips, prospects, recruiter/admin
  await seedCommunity(pool); // Dahiya: boards + sourced demo discussions
  await seedFanHub(pool); // V3: backdated threads, comments and votes across every board
  // Joe:    await seedClips(pool);
  await refreshAggregates();
  console.log('✓ seed complete');
} catch (e) {
  console.error('seed failed:', e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
