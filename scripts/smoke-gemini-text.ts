// Quick key check: one tiny text call (no video). Usage: npx tsx --env-file=../.env ../scripts/smoke-gemini-text.ts
import { generateText, geminiModel } from '../server/src/lib/ai/gemini.js';
const t0 = Date.now();
const out = await generateText('In one short sentence, what is counter-strafing in Counter-Strike 2?');
console.log(`OK ${geminiModel()} in ${Date.now() - t0}ms: ${out}`);
