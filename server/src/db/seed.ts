// Demo seed (REQUIREMENTS.md §7.6). SHARED FILE: each owner adds their own seed module
// and calls it below. Every seed only touches its own handles, so it's safe to re-run.
// Usage: npm run db:seed
import { seedCommunity } from '../routes/community.js';
import { pool } from './client.js';
import { seed as seedCoachingScouting } from './seed-yao.js';

// §7.5 demo login picker accounts that aren't owned by a feature seed.
const FANS = [
  { handle: 'new_fan', display_name: 'New Fan (demo)' },
  { handle: 'og_fan', display_name: 'Returning Fan (demo)' },
];

async function seedFans() {
  for (const f of FANS) {
    await pool.query(
      `INSERT INTO users (handle, display_name, role) VALUES ($1, $2, 'user')
       ON CONFLICT (handle) DO UPDATE SET display_name = EXCLUDED.display_name`,
      [f.handle, f.display_name],
    );
  }
  console.log(`✓ fans (${FANS.length})`);
}

try {
  await seedFans();
  await seedCoachingScouting(pool); // Yao: players, 30d stats, clips + reports, prospects, recruiter/admin
  await seedCommunity(pool); // Dahiya: boards + sourced demo discussions
  // Joe:    await seedClips(pool);
  console.log('✓ seed complete');
} catch (e) {
  console.error('seed failed:', e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
