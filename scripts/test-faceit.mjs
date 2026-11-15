// Smoke test: is the FACEIT key working, and what do we get for a nickname?
// Usage: node --env-file=.env scripts/test-faceit.mjs <nickname>
const nickname = process.argv[2];
const key = process.env.FACEIT_API_KEY;
if (!nickname) {
  console.error('usage: node --env-file=.env scripts/test-faceit.mjs <faceit-nickname>');
  process.exit(1);
}
if (!key) {
  console.error('FACEIT_API_KEY is not set (put it in .env and run with --env-file=.env)');
  process.exit(1);
}

const BASE = 'https://open.faceit.com/data/v4';
const get = async (path) => {
  const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json();
};

const player = await get(`/players?nickname=${encodeURIComponent(nickname)}&game=cs2`);
const cs2 = player.games?.cs2 ?? {};
console.log(`player: ${player.nickname} (${player.player_id}) region=${cs2.region} level=${cs2.skill_level} elo=${cs2.faceit_elo}`);

const lifetime = await get(`/players/${player.player_id}/stats/cs2`);
const lt = lifetime.lifetime ?? {};
console.log(`lifetime: matches=${lt['Matches']} K/D=${lt['Average K/D Ratio']} HS%=${lt['Average Headshots %']} win%=${lt['Win Rate %']}`);

const recent = await get(`/players/${player.player_id}/games/cs2/stats?limit=20`);
const items = recent.items ?? [];
const n = (v) => Number(v ?? 0);
const k = items.reduce((a, i) => a + n(i.stats['Kills']), 0);
const d = items.reduce((a, i) => a + n(i.stats['Deaths']), 0);
const avg = (key) => (items.reduce((a, i) => a + n(i.stats[key]), 0) / (items.length || 1)).toFixed(1);
console.log(`last ${items.length}: K/D=${(k / (d || 1)).toFixed(2)} HS%=${avg('Headshots %')} ADR=${avg('ADR')}`);
if (items[0]) console.log('sample match stat keys:', Object.keys(items[0].stats).join(', '));
