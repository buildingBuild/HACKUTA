// Pure checks for the scouting engine + cache + schema (no DB/network needed).
// Usage: npm run test:engine
import assert from 'node:assert/strict';
import { evaluateRule, getRules } from '../server/src/lib/scouting/engine.js';
import { getCachedReport, getFallbackReport, cacheKeyFor, listCachedKeys } from '../server/src/lib/ai/cache/index.js';
import { CoachingReportSchema } from '../server/src/lib/ai/coachingSchema.js';
import { normalize } from '../server/src/lib/faceit/metrics.js';

const rule = getRules().rules.find((r) => r.id === 'player_v1')!;
const vyper = { faceit_level: 10, elo: 2610, kd: 1.31, hs_pct: 54, adr: 88.4 };

// Prospect is just under: seeded last-5 avg = (77 + 79 + 76 + 78) / 4 = 77.5
const before = evaluateRule(rule, { ...vyper, avg_clip_score: 77.5 });
assert.equal(before.pass, false, 'prospect must start below the bar');
assert.deepEqual(before.criteria.filter((c) => !c.pass).map((c) => c.metric), ['avg_clip_score']);
assert.ok(before.progress > 0.95 && before.progress < 1, `progress ${before.progress}`);

// After the live clip (cached 92): (77 + 79 + 76 + 78 + 92) / 5 = 80.4
const great = getCachedReport('http://localhost:3001/demo-clips/prospect-great-clip.mp4');
assert.ok(great, 'great clip must be cached');
const seeded = ['prospect-nuke-ramp', 'prospect-ancient-awp', 'prospect-inferno-entry', 'prospect-mirage-retake'].map((k) => getCachedReport(`${k}.mp4`)!.overall_score);
const avgAfter = [...seeded, great.overall_score].reduce((a, b) => a + b, 0) / 5;
const avgBefore = seeded.reduce((a, b) => a + b, 0) / 4;
assert.ok(avgBefore < 80, `seeded avg ${avgBefore} must be < 80`);
const after = evaluateRule(rule, { ...vyper, avg_clip_score: avgAfter });
assert.equal(after.pass, true, `prospect must pass after the great clip (avg ${avgAfter})`);
assert.equal(after.progress, 1);
assert.ok(after.score >= 80 && after.score <= 100, `score ${after.score}`);

// Missing metrics never pass, never throw
const empty = evaluateRule(rule, {});
assert.equal(empty.pass, false);
assert.equal(empty.progress, 0);

// Cache + schema
assert.equal(cacheKeyFor('https://x.public.blob.vercel-storage.com/clips/prospect-great-clip.mp4?token=1'), 'prospect-great-clip');
for (const k of listCachedKeys()) CoachingReportSchema.parse(getCachedReport(k + '.mp4'));
CoachingReportSchema.parse(getFallbackReport());
assert.equal(CoachingReportSchema.safeParse({ ...great, overall_score: 140 }).success, false, 'out-of-range score rejected');
assert.equal(CoachingReportSchema.safeParse({ ...great, notes: [{ ...great.notes[0], t: '7s' }] }).success, false, 'bad timestamp rejected');

// FACEIT normalization (shape of /games/cs2/stats items)
const n = normalize(
  { player_id: 'p', nickname: 'x', games: { cs2: { skill_level: 10, faceit_elo: 2600, region: 'NA' } } },
  { player_id: 'p', lifetime: { 'Average K/D Ratio': '1.2', 'Win Rate %': '55', Matches: '900' } },
  { items: [
    { stats: { Kills: '25', Deaths: '18', 'K/R Ratio': '0.9', 'Headshots %': '50', ADR: '90.5', Result: '1' } },
    { stats: { Kills: '15', Deaths: '17', 'K/R Ratio': '0.7', 'Headshots %': '40', ADR: '70.5', Result: '0' } },
  ] },
);
assert.equal(n.last20.kd, 1.14); // 40 / 35
assert.equal(n.last20.hs_pct, 45);
assert.equal(n.last20.adr, 80.5);
assert.equal(n.last20.win_rate, 50);
assert.equal(n.lifetime.lifetime_matches, 900);

console.log(`engine OK: before ${before.progress} progress / after avg ${avgAfter} -> pass, score ${after.score}`);
