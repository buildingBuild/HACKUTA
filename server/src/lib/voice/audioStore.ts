// Where briefing mp3s live. SANDBOX/LOCAL: disk under server/.cache/audio, served by
// GET /api/voice/audio/:file. After merge, swap save() for the team's blob storage
// (Vercel's filesystem is not persistent) and return the blob URL instead.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CACHE_DIR = fileURLToPath(new URL('../../../.cache/audio/', import.meta.url));
// Committed, pre-generated demo audio (e.g. prospect briefing, coach fallback).
const STATIC_DIR = fileURLToPath(new URL('./audio/', import.meta.url));

const safe = (name: string) => path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '');

export async function saveAudio(name: string, bytes: Buffer): Promise<string> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(path.join(CACHE_DIR, safe(name)), bytes);
  return `/api/voice/audio/${safe(name)}`;
}

/** Looks in the runtime cache first, then the committed demo audio. */
export async function readAudio(name: string): Promise<Buffer | null> {
  for (const dir of [CACHE_DIR, STATIC_DIR]) {
    try {
      return await readFile(path.join(dir, safe(name)));
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function hasAudio(name: string): Promise<boolean> {
  for (const dir of [CACHE_DIR, STATIC_DIR]) {
    try {
      await access(path.join(dir, safe(name)));
      return true;
    } catch {
      /* try next */
    }
  }
  return false;
}
