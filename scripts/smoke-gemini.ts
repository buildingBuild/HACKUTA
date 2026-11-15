// Smoke test: run a real CS2 clip through the coaching pipeline (Gemini + zod).
// Usage: npm run smoke:gemini -- <path-or-url-to-clip> [map] [side]
// Tip: when the output is good, paste it into server/src/lib/ai/cache/reports.json
// under the clip's file name so the demo has a cached copy.
import { analyzeClip, geminiModel } from '../server/src/lib/ai/gemini.js';

const [clip, map = 'Mirage', side = 'T'] = process.argv.slice(2);
if (!clip) {
  console.error('usage: npm run smoke:gemini -- <clip.mp4 | https://... | youtube url> [map] [side]');
  process.exit(1);
}
const t0 = Date.now();
console.log(`analyzing ${clip} with ${geminiModel()}…`);
const { report, model } = await analyzeClip(clip, { handle: 'smoke-test', faceit_level: 10, faceit_elo: 2500, map, side });
console.log(JSON.stringify(report, null, 2));
console.log(`OK via ${model} in ${((Date.now() - t0) / 1000).toFixed(1)}s, overall ${report.overall_score}`);
