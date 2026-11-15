// Pure checks for the scouting engine, template summary, mock FACEIT and FACEIT normalization (no DB/network).
// Usage: npm test
import assert from 'node:assert/strict';
import { evaluateRule, getRules } from '../server/src/lib/scouting/engine.js';
import { templateSummary } from '../server/src/lib/scouting/summary.js';
import { levelForElo } from '../server/src/lib/faceit/mock.js';
import { normalize } from '../server/src/lib/faceit/metrics.js';

const rule = getRules().rules.find((r) => r.id === 'player_v1')!;
assert.ok(rule.enabled, 'player_v1 must be enabled');
assert.ok(!rule.all.some((c) => c.metric === 'avg_clip_score'), 'no AI clip score criterion since the V3 pivot');

// Seeded demo prospect (server/src/db/seed-yao.ts): every stat passes, but only 18 of 20 recent matches.
const vyper = { faceit_level: 10, elo: 2610, kd: 1.31, kr: 0.86, hs_pct: 54, adr: 88.4, win_rate: 62 };

const before = evaluateRule(rule, { ...vyper, matches: 18 });
assert.equal(before.pass, false, 'prospect must start below the bar');
assert.deepEqual(before.criteria.filter((c) => !c.pass).map((c) => c.metric), ['matches'], 'only the sample size is missing');
assert.ok(before.progress > 0.95 && before.progress < 1, `progress ${before.progress}`);

// A FACEIT sync (mock or live) reports a full 20-match sample -> crosses the bar.
const after = evaluateRule(rule, { ...vyper, matches: 20 });
assert.equal(after.pass, true, 'prospect must pass after a sync');
assert.equal(after.progress, 1);
assert.ok(after.score >= 80 && after.score <= 100, `score ${after.score}`);

// Missing metrics never pass, never throw
const empty = evaluateRule(rule, {});
assert.equal(empty.pass, false);
assert.equal(empty.progress, 0);

// Template summary uses real numbers only
const summary = templateSummary({ handle: 'vyper', displayName: 'Vyper', region: 'NA', metrics: { ...vyper, matches: 20 } });
assert.match(summary, /2610 ELO/);
assert.match(summary, /1\.31 K\/D/);
assert.doesNotMatch(summary, /AI|clip score/i);

// Mock FACEIT levels follow ELO bands
assert.equal(levelForElo(400), 1);
assert.equal(levelForElo(1000), 4);
assert.equal(levelForElo(2001), 10);

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
assert.equal(n.last20.matches, 2);
assert.equal(n.lifetime.lifetime_matches, 900);

console.log(`scouting OK: before ${before.progress} (needs ${before.criteria.find((c) => !c.pass)?.label}) -> after sync pass, score ${after.score}`);
