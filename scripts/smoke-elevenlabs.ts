// Smoke test for ElevenLabs + generates the committed demo fallback audio.
// Usage: npm run smoke:elevenlabs
//  1. TTS: writes server/src/lib/voice/audio/coach-fallback.mp3 (played if the live agent fails)
//  2. Signed URL: checks ELEVENLABS_AGENT_ID is reachable
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getSignedUrl, tts } from '../server/src/lib/voice/elevenlabs.js';
import { getCachedReport } from '../server/src/lib/ai/cache/index.js';

const dir = fileURLToPath(new URL('../server/src/lib/voice/audio/', import.meta.url));
await mkdir(dir, { recursive: true });

const r = getCachedReport('prospect-great-clip.mp4')!;
const coachText = `Nice clip. Your score is ${r.overall_score}. ${r.summary} One thing to work on: ${r.notes.find((n) => n.severity !== 'low')?.fix ?? r.notes[0].fix} For practice, try ${r.drills[0].name} for ${r.drills[0].minutes} minutes.`;

try {
  const mp3 = await tts(coachText);
  await writeFile(dir + 'coach-fallback.mp3', mp3);
  console.log(`TTS OK: coach-fallback.mp3 (${(mp3.byteLength / 1024).toFixed(0)} KB)`);
} catch (e) {
  console.error('TTS FAILED:', (e as Error).message);
}

try {
  const url = await getSignedUrl();
  console.log('signed URL OK:', url.slice(0, 60) + '…');
} catch (e) {
  console.error('signed URL FAILED:', (e as Error).message);
}
