// Clip analysis pipeline (Joe). One video in, its best moments out as clips.
//
//   source (Twitch/YouTube URL, channel, or local folder/file)
//     -> yt-dlp / ffmpeg: grab a window of the video (default 6 min)
//     -> audio signals every 0.5s: loudness, gunfire transients
//     -> ElevenLabs Scribe: words + timestamps + speakers + (laughter)/(shouting) tags
//     -> 10 scoring rules turn signals into candidate moments       (all signals -> clip_signals hypertable)
//     -> AI agent with tools (candidates, signals, transcript search, watch a window) picks + labels clips
//        (AI_PROVIDER=openai|gemini, see llm.ts)
//     -> ffmpeg cuts the clips to server/media/clips, rows go in `clips`
//
// Keeps it simple: local files, in-process queue, no cloud storage.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';
import { judge, provider, runAgent, type ToolDef } from './llm.js';

// ---------- paths + shell helpers ----------
const here = path.dirname(fileURLToPath(import.meta.url));
export const MEDIA_DIR = path.resolve(here, '../../../media');
export const CLIPS_DIR = path.join(MEDIA_DIR, 'clips');
const WORK_DIR = path.join(MEDIA_DIR, 'work');
const LOCAL_YTDLP = path.resolve(here, '../../../bin/yt-dlp');
const YTDLP = process.env.YT_DLP || (existsSync(LOCAL_YTDLP) ? LOCAL_YTDLP : 'yt-dlp');
const VIDEO_EXT = /\.(mp4|mov|mkv|webm|m4v|avi)$/i;

function run(cmd: string, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    let err = '';
    p.stdout.on('data', (d: Buffer) => out.push(d));
    p.stderr.on('data', (d: Buffer) => (err = (err + d.toString()).slice(-2000)));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`${path.basename(cmd)} exited ${code}: ${err.trim().split('\n').pop()}`))));
  });
}
const sh = async (cmd: string, args: string[]) => (await run(cmd, args)).toString().trim();

// ---------- sources ----------
export type Platform = 'twitch' | 'youtube' | 'folder';
export interface SourceItem {
  source: string;
  platform: Platform;
  title?: string;
}

const platformOf = (s: string): Platform => (/twitch\.tv/i.test(s) ? 'twitch' : /youtu\.?be/i.test(s) ? 'youtube' : 'folder');

/** Expand a channel URL or a folder into individual videos (newest first). */
export async function resolveSources(source: string, limit = 10): Promise<SourceItem[]> {
  const s = source.trim();
  if (!/^https?:\/\//i.test(s)) {
    const p = s.replace(/^~(?=\/)/, process.env.HOME ?? '~');
    if (!existsSync(p)) throw new Error(`Folder or file not found: ${p}`);
    if (statSync(p).isFile()) return [{ source: p, platform: 'folder', title: path.basename(p) }];
    return readdirSync(p)
      .filter((f) => VIDEO_EXT.test(f))
      .map((f) => path.join(p, f))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
      .slice(0, limit)
      .map((f) => ({ source: f, platform: 'folder' as const, title: path.basename(f) }));
  }
  const twitchChannel = s.match(/twitch\.tv\/([A-Za-z0-9_]+)\/?(?:videos)?\/?(?:\?.*)?$/i);
  const youtubeChannel = s.match(/youtube\.com\/(@[\w.-]+|channel\/[\w-]+|c\/[\w-]+)/i);
  const list =
    twitchChannel && twitchChannel[1].toLowerCase() !== 'videos'
      ? `https://www.twitch.tv/${twitchChannel[1]}/videos?filter=archives&sort=time`
      : youtubeChannel && !/watch|shorts/.test(s)
        ? `https://www.youtube.com/${youtubeChannel[1]}/videos`
        : null;
  if (!list) return [{ source: s, platform: platformOf(s) }];
  const out = await sh(YTDLP, ['--flat-playlist', '--playlist-end', String(limit), '--print', '%(url)s\t%(title)s', list]);
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [url, title] = line.split('\t');
      return { source: url, platform: platformOf(s), title };
    });
}

// ---------- jobs ----------
export interface JobOptions {
  /** seconds into the video to start (default: 0, or 30% in for long VODs) */
  start?: number;
  /** seconds of video to analyze (default 360) */
  duration?: number;
  /** clips to keep per video (default 3) */
  maxClips?: number;
}

type Job = { id: string; user_id: string; source: string; platform: Platform; created_at: Date };

async function setJob(db: Pool, id: string, patch: Record<string, unknown>) {
  const keys = Object.keys(patch);
  await db.query(
    `UPDATE clip_jobs SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() WHERE id = $1`,
    [id, ...keys.map((k) => patch[k])],
  );
}

let chain: Promise<unknown> = Promise.resolve();
const queue = <T>(fn: () => Promise<T>) => (chain = chain.then(fn, fn)) as Promise<T>;

/** Create one job per video in `source` and queue them (one at a time). */
export async function createJobs(db: Pool, userId: string, source: string, opts: JobOptions = {}, limit = 10) {
  const items = await resolveSources(source, limit);
  if (!items.length) throw new Error('No videos found there');
  const jobs: { id: string; source: string; title: string | null }[] = [];
  for (const it of items) {
    const {
      rows: [j],
    } = await db.query<{ id: string }>(`INSERT INTO clip_jobs (user_id, source, platform, title) VALUES ($1, $2, $3, $4) RETURNING id`, [
      userId,
      it.source,
      it.platform,
      it.title ?? null,
    ]);
    jobs.push({ id: j.id, source: it.source, title: it.title ?? null });
    void queue(() => runJob(db, j.id, opts).catch((e) => console.warn('[clips] job failed', j.id, (e as Error).message)));
  }
  return jobs;
}

// ---------- 1. fetch ----------
async function fetchWindow(job: Job, dir: string, opts: JobOptions) {
  const out = path.join(dir, 'src.mp4');
  const want = opts.duration ?? 360;
  let title = path.basename(job.source);
  let total: number;

  if (job.platform === 'folder') {
    total = Number(await sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', job.source])) || 0;
  } else {
    const meta = await sh(YTDLP, ['--skip-download', '--no-warnings', '--print', '%(duration)s\t%(title)s', job.source]);
    const [d, t] = meta.split('\n')[0].split('\t');
    total = Number(d) || 0;
    title = t || title;
  }
  const start = Math.max(0, Math.min(opts.start ?? (total > 1800 ? Math.round(total * 0.3) : 0), Math.max(0, total - 30)));
  const length = total ? Math.min(want, total - start) : want;

  if (job.platform === 'folder') {
    await run('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(start), '-t', String(length), '-i', job.source, '-c', 'copy', out]);
  } else {
    await run(YTDLP, [
      '-q', '--no-warnings', '-f', 'bv*[height<=480]+ba/b[height<=480]/b', '--merge-output-format', 'mp4',
      '--download-sections', `*${start}-${start + length}`, '-o', out, job.source,
    ]);
  }
  return { file: out, start, length, title };
}

// ---------- 2. audio signals ----------
const BIN = 0.5; // seconds per signal bin

async function pcm(file: string, filter?: string): Promise<Int16Array> {
  const args = ['-loglevel', 'error', '-i', file, '-vn', '-ac', '1', '-ar', '16000'];
  if (filter) args.push('-af', filter);
  const buf = await run('ffmpeg', [...args, '-f', 's16le', '-']);
  return new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 2));
}

const db20 = (rms: number) => 20 * Math.log10(Math.max(rms, 1e-6));

/** loudness per bin (dB) + gunfire-ish transients per bin (sharp jumps in the >2.5kHz band) */
async function audioSignals(file: string) {
  const [full, high] = await Promise.all([pcm(file), pcm(file, 'highpass=f=2500')]);
  const frame = 320; // 20ms @ 16k
  const frames = Math.floor(full.length / frame);
  const perBin = Math.round(BIN / 0.02);
  const fullDb: number[] = [];
  const highDb: number[] = [];
  for (let f = 0; f < frames; f++) {
    let a = 0;
    let b = 0;
    for (let i = f * frame; i < (f + 1) * frame; i++) {
      a += (full[i] / 32768) ** 2;
      b += (high[i] / 32768) ** 2;
    }
    fullDb.push(db20(Math.sqrt(a / frame)));
    highDb.push(db20(Math.sqrt(b / frame)));
  }
  const bins = Math.ceil(frames / perBin);
  const loud: number[] = [];
  const shots: number[] = [];
  for (let k = 0; k < bins; k++) {
    const slice = fullDb.slice(k * perBin, (k + 1) * perBin);
    loud.push(slice.length ? db20(Math.sqrt(slice.reduce((s, d) => s + 10 ** (d / 10), 0) / slice.length)) : -60);
    let n = 0;
    for (let f = k * perBin; f < Math.min(frames, (k + 1) * perBin); f++) {
      const prev = highDb.slice(Math.max(0, f - 10), f).sort((x, y) => x - y);
      const med = prev.length ? prev[prev.length >> 1] : highDb[f];
      if (highDb[f] - med > 10 && highDb[f] > -38) n++;
    }
    shots.push(n);
  }
  return { loud, shots };
}

// ---------- 3. transcript ----------
export interface Word {
  text: string;
  start: number;
  end: number;
  type: 'word' | 'audio_event' | 'spacing';
  speaker?: string;
}

async function transcribe(file: string, dir: string): Promise<Word[]> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return [];
  const mp3 = path.join(dir, 'audio.mp3');
  await run('ffmpeg', ['-loglevel', 'error', '-y', '-i', file, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '48k', mp3]);
  const form = new FormData();
  form.append('model_id', 'scribe_v2');
  form.append('timestamps_granularity', 'word');
  form.append('tag_audio_events', 'true');
  form.append('diarize', 'true');
  form.append('file', new Blob([readFileSync(mp3)], { type: 'audio/mpeg' }), 'audio.mp3');
  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': key },
    body: form,
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const body = (await res.json()) as { words?: { text: string; start: number; end: number; type: Word['type']; speaker_id?: string }[] };
  return (body.words ?? []).filter((w) => w.type !== 'spacing').map((w) => ({ text: w.text, start: w.start, end: w.end, type: w.type, speaker: w.speaker_id }));
}

// ---------- 4. scoring rules ----------
type Category = 'pro' | 'funny' | 'content';
interface Hit {
  rule: string;
  cat: Category;
  w: number;
  bin: number;
}

const HYPE = /^(ace|clutch|insane|nutty|crazy|holy|sheesh|huge|beautiful|clean|headshot|deagle|awp|collateral|wallbang|noscope|quad|triple|four|pog|poggers|lets|let's|omg|nasty|disgusting|unreal|1v[2-5]|onetap)$/i;
const HYPE_PHRASE = /(oh my god|no way|let'?s go|one tap|what a shot|are you serious|he'?s one)/i;
const REACT = /^(what|bro|how|huh|wait|dude|yo)$/i;
const RAGE = /^(why|cheat|cheater|cheating|hacker|refund|tilted|tilt|unlucky|throw|throwing|griefing|sorry|oops|bruh|kidding|ridiculous)$/i;
const FUNNY = /^(lol|lmao|haha|hahaha|clown|troll|funny|joke|dumb)$/i;
const STOP = new Set(['the', 'a', 'and', 'to', 'i', 'it', 'is', 'that', 'you', 'he', 'of', 'in', 'on', 'this', 'we', 'they', 'so', 'just', 'like', 'its', "it's", 'was', 'are', 'be', 'have']);

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9'+]/g, '');
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : 0;
};

/**
 * The ten rules. Each looks at a different "shape" of a moment, not just "it got loud":
 *  eruption      long tension (quiet) that breaks into a loud spike: clutch energy
 *  firefight     a burst of sharp high-band transients: gunfights, sprays, multi-kills
 *  hype_lexicon  hype words/phrases (ace, one tap, no way, let's go...)
 *  laugh_track   tagged (laughter)
 *  punchline     laughter landing within 6s after a spike or firefight: something went hilariously wrong
 *  jaw_drop      spike, then 2s of stunned silence, then "what / bro / how"
 *  tilt_meter    shouting or rage words (why, refund, cheater...) without a fight: comedic rage
 *  crosstalk     2+ speakers talking fast over each other: chaos, comms, banter
 *  story_time    one voice talking steadily for 20s+ with no fighting: commentary / content
 *  echo_chamber  the same word repeated 3+ times in 4s ("no no no", "go go go", "one one one")
 */
function scoreRules(loud: number[], shots: number[], words: Word[]) {
  const n = loud.length;
  const med = median(loud);
  const mad = median(loud.map((x) => Math.abs(x - med))) * 1.4826 || 1;
  const z = loud.map((x) => (x - med) / mad);
  const shotP90 = [...shots].sort((a, b) => a - b)[Math.floor(n * 0.9)] ?? 0;
  const at = (t: number) => Math.max(0, Math.min(n - 1, Math.floor(t / BIN)));
  const spoken = words.filter((w) => w.type === 'word');
  const events = words.filter((w) => w.type === 'audio_event');

  const wps = new Array(n).fill(0);
  const speakers: Set<string>[] = Array.from({ length: n }, () => new Set());
  for (const w of spoken) {
    wps[at(w.start)] += 1 / BIN;
    if (w.speaker) speakers[at(w.start)].add(w.speaker);
  }
  const laughs = events.filter((e) => /laugh|giggl|chuckl/i.test(e.text)).map((e) => at(e.start));
  const shouts = events.filter((e) => /shout|scream|yell/i.test(e.text)).map((e) => at(e.start));

  const hits: Hit[] = [];
  const hit = (rule: string, cat: Category, w: number, bin: number) => hits.push({ rule, cat, w, bin: Math.max(0, Math.min(n - 1, bin)) });
  const win = (b: number, len: number, f: (i: number) => number) => {
    let s = 0;
    for (let i = Math.max(0, b); i < Math.min(n, b + len); i++) s += f(i);
    return s;
  };

  const spikes: number[] = [];
  const fights: number[] = [];
  for (let b = 8; b < n; b++) {
    // eruption: >= 4s of below-median quiet, then z >= 2
    if (z[b] >= 2 && win(b - 8, 8, (i) => z[i]) / 8 <= -0.2) (hit('eruption', 'pro', 3, b), spikes.push(b));
    else if (z[b] >= 2.5) spikes.push(b);
  }
  for (let b = 0; b < n; b++) {
    if (win(b, 4, (i) => shots[i]) >= Math.max(6, shotP90 * 3) && !fights.some((f) => b - f < 6)) (hit('firefight', 'pro', 2, b), fights.push(b));
  }
  for (const w of spoken) {
    const t = norm(w.text);
    if (HYPE.test(t)) hit('hype_lexicon', 'pro', 1.5, at(w.start));
    if (RAGE.test(t)) hit('tilt_meter', 'funny', 1.5, at(w.start));
    if (FUNNY.test(t)) hit('laugh_track', 'funny', 1, at(w.start));
  }
  // phrases (2-4 word windows)
  for (let i = 0; i < spoken.length; i++) {
    const phrase = spoken.slice(i, i + 4).map((w) => w.text).join(' ');
    if (HYPE_PHRASE.test(phrase) && !HYPE_PHRASE.test(spoken.slice(i + 1, i + 4).map((w) => w.text).join(' '))) hit('hype_lexicon', 'pro', 2, at(spoken[i].start));
  }
  for (const b of laughs) {
    hit('laugh_track', 'funny', 3, b);
    if ([...spikes, ...fights].some((s) => b - s > 0 && b - s <= 12)) hit('punchline', 'funny', 3, b);
  }
  for (const b of shouts) if (!fights.some((f) => Math.abs(f - b) < 6)) hit('tilt_meter', 'funny', 2, b);
  for (const s of spikes) {
    const silent = win(s + 1, 4, (i) => wps[i]) === 0;
    const reaction = spoken.find((w) => at(w.start) > s + 3 && at(w.start) <= s + 10 && REACT.test(norm(w.text)));
    if (silent && reaction) hit('jaw_drop', 'funny', 2.5, s);
  }
  for (let b = 0; b < n; b += 2) {
    const sp = new Set<string>();
    for (let i = b; i < Math.min(n, b + 6); i++) speakers[i].forEach((x) => sp.add(x));
    if (sp.size >= 2 && win(b, 6, (i) => wps[i]) / 6 >= 3.5) hit('crosstalk', 'content', 1.5, b);
  }
  // story time: 20s+ of steady speech from one speaker, no fighting
  let runStart = -1;
  for (let b = 0; b <= n; b++) {
    const talking = b < n && wps[b] >= 1 && shots[b] < 2;
    if (talking && runStart < 0) runStart = b;
    if (!talking && runStart >= 0) {
      if (b - runStart >= 40) hit('story_time', 'content', 1.5, runStart + 4);
      runStart = -1;
    }
  }
  // echo chamber: same non-stopword 3+ times within 4s
  for (let i = 0; i < spoken.length; i++) {
    const t = norm(spoken[i].text);
    if (!t || STOP.has(t) || t.length < 2) continue;
    const reps = spoken.filter((w, j) => j >= i && w.start - spoken[i].start <= 4 && norm(w.text) === t).length;
    if (reps >= 3 && !(i > 0 && norm(spoken[i - 1].text) === t)) hit('echo_chamber', HYPE.test(t) ? 'pro' : 'funny', 1.5, at(spoken[i].start));
  }

  // timeline: rule weights smoothed over +-3s
  const score = new Array(n).fill(0);
  for (const h of hits) for (let d = -6; d <= 6; d++) if (h.bin + d >= 0 && h.bin + d < n) score[h.bin + d] += h.w * (1 - Math.abs(d) / 7);

  // candidates: peaks, at least 20s apart, window snapped to word gaps
  const order = score.map((s, i) => [s, i] as const).sort((a, b) => b[0] - a[0]);
  const picked: number[] = [];
  for (const [s, i] of order) {
    if (s < 2 || picked.length >= 12) break;
    if (picked.every((p) => Math.abs(p - i) * BIN >= 20)) picked.push(i);
  }
  const length = n * BIN;
  const candidates = picked.map((b, k) => {
    const peak = b * BIN;
    const near = hits.filter((h) => Math.abs(h.bin - b) * BIN <= 8);
    const byCat: Record<Category, number> = { pro: 0, funny: 0, content: 0 };
    near.forEach((h) => (byCat[h.cat] += h.w));
    let start = Math.max(0, peak - 9);
    let end = Math.min(length, peak + 7);
    const cutIn = spoken.find((w) => w.start < start && w.end > start);
    if (cutIn) start = Math.max(0, cutIn.start - 0.2);
    const cutOut = spoken.find((w) => w.start < end && w.end > end);
    if (cutOut) end = Math.min(length, cutOut.end + 0.3);
    return {
      id: k + 1,
      start: +start.toFixed(1),
      end: +end.toFixed(1),
      peak,
      score: +score[b].toFixed(1),
      hint: (Object.entries(byCat).sort((a, c) => c[1] - a[1])[0][0] as Category),
      rules: [...new Set(near.map((h) => h.rule))],
      transcript: transcriptBetween(words, start, end),
    };
  });
  return { z, wps, score, hits, candidates, laughs, shots };
}

function transcriptBetween(words: Word[], a: number, b: number) {
  return words
    .filter((w) => w.start >= a && w.start <= b)
    .map((w) => (w.type === 'audio_event' ? `(${w.text.replace(/[()]/g, '')})` : w.text))
    .join(' ')
    .slice(0, 400);
}

// ---------- 5. Gemini: watch a window ----------
interface Verdict {
  category: Category | 'none';
  score: number;
  title: string;
  reason: string;
  seen: string;
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: ['pro', 'funny', 'content', 'none'] },
    score: { type: 'integer', description: '0-100, how clip-worthy for a CS2 fan feed' },
    title: { type: 'string', description: 'punchy clip title, max 6 words' },
    reason: { type: 'string', description: 'one sentence: why this moment works' },
    seen: { type: 'string', description: 'what literally happens on screen (kill feed, round result, reactions)' },
  },
  required: ['category', 'score', 'title', 'reason', 'seen'],
};

async function inspect(file: string, dir: string, a: number, b: number, context: string): Promise<Verdict> {
  const seg = path.join(dir, `seg-${Math.round(a * 10)}-${Math.round(b * 10)}.mp4`);
  if (!existsSync(seg))
    await run('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(a), '-t', String(Math.max(3, b - a)), '-i', file, '-vf', 'scale=-2:360', '-r', '12', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-c:a', 'aac', '-b:a', '48k', seg]);
  const prompt = `A ${Math.round(b - a)}s moment from a Counter-Strike 2 stream/video. Signals and transcript: ${context}
Judge it for a fan clip feed. Categories: "pro" = skilled play (multi-kill, clutch, flick, great utility), "funny" = fails, rage, banter, laughter, absurd moments, "content" = a good watchable talking/commentary/reaction moment, "none" = not clip-worthy. Read the kill feed and round banners if visible.`;
  return judge<Verdict>(seg, prompt, VERDICT_SCHEMA);
}

// ---------- 6. Gemini agent ----------
interface Pick {
  start: number;
  end: number;
  category: Category;
  score: number;
  title: string;
  reason: string;
  rules: string[];
}

const TOOLS: ToolDef[] = [
  { name: 'list_candidates', description: 'Candidate moments found by the scoring rules (times are seconds into the analyzed window).', parameters: { type: 'object', properties: {} } },
  {
    name: 'get_signals',
    description: 'Per-second signals between two times from the time-series DB: loudness z-score, gunfire transients, words/sec, laughter, rule score.',
    parameters: { type: 'object', properties: { start: { type: 'number' }, end: { type: 'number' } }, required: ['start', 'end'] },
  },
  {
    name: 'search_transcript',
    description: 'Find where words/phrases were said (case-insensitive). Returns matching lines with times.',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'inspect_window',
    description: 'Actually watch a 5-30s window (video + audio) and get a verdict: category, score, title, reason, what is seen.',
    parameters: { type: 'object', properties: { start: { type: 'number' }, end: { type: 'number' } }, required: ['start', 'end'] },
  },
  {
    name: 'save_clip',
    description: 'Keep a clip. 6-40s, must not overlap a saved clip. Use your own judgment on category/score after inspecting.',
    parameters: {
      type: 'object',
      properties: {
        start: { type: 'number' },
        end: { type: 'number' },
        category: { type: 'string', enum: ['pro', 'funny', 'content'] },
        score: { type: 'integer' },
        title: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['start', 'end', 'category', 'score', 'title', 'reason'],
    },
  },
  { name: 'finish', description: 'Call when done picking clips.', parameters: { type: 'object', properties: {} } },
];

async function agentPick(
  ctx: { db: Pool; job: Job; offset: number; length: number; file: string; dir: string; words: Word[]; cands: ReturnType<typeof scoreRules>['candidates'] },
  maxClips: number,
): Promise<Pick[]> {
  const picks: Pick[] = [];
  const t0 = ctx.job.created_at.getTime() / 1000 + ctx.offset;
  const ruleAt = (a: number, b: number) => [...new Set(ctx.cands.filter((c) => c.peak >= a - 4 && c.peak <= b + 4).flatMap((c) => c.rules))];

  const tools: Record<string, (args: Record<string, number | string>) => Promise<unknown>> = {
    list_candidates: async () => ctx.cands.map(({ peak: _p, ...c }) => c),
    get_signals: async ({ start, end }) => {
      const { rows } = await ctx.db.query(
        `SELECT extract(epoch FROM time_bucket('1 second', time))::float8 - $2::float8 AS t, kind, round(avg(value)::numeric, 2)::float AS v
           FROM clip_signals WHERE job_id = $1 AND time BETWEEN to_timestamp($2::float8 + $3::float8) AND to_timestamp($2::float8 + $4::float8)
          GROUP BY 1, 2 ORDER BY 1`,
        [ctx.job.id, t0, Number(start), Number(end)],
      );
      const out: Record<string, Record<string, number>> = {};
      for (const r of rows as { t: number; kind: string; v: number }[]) (out[r.t.toFixed(0)] ??= {})[r.kind] = r.v;
      return out;
    },
    search_transcript: async ({ query }) => {
      const q = String(query).toLowerCase();
      const lines: { t: number; text: string }[] = [];
      for (let i = 0; i < ctx.words.length; i += 12) {
        const chunk = ctx.words.slice(i, i + 12);
        const text = chunk.map((w) => (w.type === 'audio_event' ? `(${w.text})` : w.text)).join(' ');
        if (text.toLowerCase().includes(q)) lines.push({ t: +chunk[0].start.toFixed(1), text });
      }
      return lines.slice(0, 10);
    },
    inspect_window: async ({ start, end }) => {
      const a = Math.max(0, Number(start));
      const b = Math.min(ctx.length, Math.max(a + 5, Number(end)));
      return inspect(ctx.file, ctx.dir, a, b, `rules: ${ruleAt(a, b).join(', ') || 'none'}; said: ${transcriptBetween(ctx.words, a, b) || '(nothing)'}`);
    },
    save_clip: async (a) => {
      const start = Math.max(0, Number(a.start));
      const end = Math.min(ctx.length, Number(a.end));
      if (end - start < 6 || end - start > 40) return { ok: false, error: 'clip must be 6-40s' };
      if (picks.some((p) => Math.min(p.end, end) - Math.max(p.start, start) > 2)) return { ok: false, error: 'overlaps a saved clip' };
      if (picks.length >= maxClips) return { ok: false, error: `already have ${maxClips} clips, call finish` };
      picks.push({
        start,
        end,
        category: String(a.category) as Category,
        score: Math.max(0, Math.min(100, Math.round(Number(a.score)))),
        title: String(a.title).slice(0, 60),
        reason: String(a.reason).slice(0, 240),
        rules: ruleAt(start, end),
      });
      return { ok: true, saved: picks.length };
    },
    finish: async () => ({ ok: true }),
  };

  await runAgent(
    `You are the clip editor for FaZe HQ, a CS2 fan platform. Find the best moments in this video for a fan's profile.
Use the tools: list the rule-based candidates, check signals or the transcript if useful, ALWAYS inspect_window before saving, then save_clip the best ${maxClips} (fewer if nothing is good) and call finish.
Prefer variety across categories (pro / funny / content). Tighten windows so the clip starts just before the action and ends after the reaction.`,
    `Video: "${ctx.job.source}". Analyzed window: ${Math.round(ctx.length)}s. Pick up to ${maxClips} clips.`,
    TOOLS,
    (name, args) => (tools[name] ?? (async () => ({ error: 'unknown tool' })))(args as Record<string, number | string>),
  );
  return picks;
}

/** If the agent fails: watch the top candidates and keep the best by (Gemini score + rule score). */
async function fallbackPick(file: string, dir: string, cands: ReturnType<typeof scoreRules>['candidates'], maxClips: number): Promise<Pick[]> {
  const top = cands.slice(0, 6);
  const verdicts = await Promise.all(
    top.map((c) => inspect(file, dir, c.start, c.end, `rules: ${c.rules.join(', ')}; said: ${c.transcript || '(nothing)'}`).catch(() => null)),
  );
  return top
    .map((c, i) => ({ c, v: verdicts[i] }))
    .filter((x): x is { c: (typeof top)[number]; v: Verdict } => !!x.v && x.v.category !== 'none')
    .sort((a, b) => b.v.score + b.c.score * 4 - (a.v.score + a.c.score * 4))
    .slice(0, maxClips)
    .map(({ c, v }) => ({ start: c.start, end: c.end, category: v.category as Category, score: v.score, title: v.title, reason: v.reason, rules: c.rules }));
}

// ---------- 7. run one job ----------
const deepLink = (job: Job, at: number) => {
  const s = Math.max(0, Math.floor(at));
  if (job.platform === 'twitch') return `${job.source}${job.source.includes('?') ? '&' : '?'}t=${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m${s % 60}s`;
  if (job.platform === 'youtube') return `${job.source}${job.source.includes('?') ? '&' : '?'}t=${s}s`;
  return null;
};

export async function runJob(db: Pool, jobId: string, opts: JobOptions = {}) {
  const {
    rows: [job],
  } = await db.query<Job>(`SELECT id, user_id, source, platform, created_at FROM clip_jobs WHERE id = $1`, [jobId]);
  if (!job) throw new Error('job not found');
  const dir = path.join(WORK_DIR, job.id);
  mkdirSync(dir, { recursive: true });
  mkdirSync(CLIPS_DIR, { recursive: true });
  const step = (stage: string, progress: number) => setJob(db, job.id, { status: 'running', stage, progress });

  try {
    await step('downloading', 0.05);
    const { file, start: offset, length, title } = await fetchWindow(job, dir, opts);
    await setJob(db, job.id, { title });

    await step('listening', 0.25);
    const [{ loud, shots }, words] = await Promise.all([
      audioSignals(file),
      transcribe(file, dir).catch((e) => (console.warn('[clips] transcript skipped:', (e as Error).message), [] as Word[])),
    ]);

    await step('scoring', 0.45);
    const s = scoreRules(loud, shots, words);
    const base = job.created_at.getTime() / 1000 + offset;
    const kinds: [string, number[]][] = [
      ['loud_z', s.z],
      ['gunfire', shots],
      ['words_per_s', s.wps],
      ['laughter', loud.map((_, i) => (s.laughs.includes(i) ? 1 : 0))],
      ['rule_score', s.score],
    ];
    for (const [kind, vals] of kinds)
      await db.query(
        `INSERT INTO clip_signals (time, job_id, kind, value)
         SELECT to_timestamp($1::float8 + (i - 1) * $4::float8), $2, $3, v FROM unnest($5::float8[]) WITH ORDINALITY AS u(v, i)`,
        [base, job.id, kind, BIN, vals.map((v) => +v.toFixed(3))],
      );

    await step('picking', 0.6);
    const maxClips = opts.maxClips ?? 3;
    let picks: Pick[] = [];
    try {
      picks = await agentPick({ db, job, offset, length, file, dir, words, cands: s.candidates }, maxClips);
    } catch (e) {
      console.warn(`[clips] ${provider()} agent failed, using fallback:`, (e as Error).message);
    }
    if (!picks.length) picks = await fallbackPick(file, dir, s.candidates, maxClips);

    await step('cutting', 0.9);
    let n = 0;
    for (const p of picks) {
      const name = `${job.id}-${++n}`;
      await run('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(p.start), '-t', String(p.end - p.start), '-i', file, '-vf', "scale=-2:'min(720,ih)'", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', path.join(CLIPS_DIR, `${name}.mp4`)]);
      await run('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String((p.start + p.end) / 2), '-i', file, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '4', path.join(CLIPS_DIR, `${name}.jpg`)]);
      await db.query(
        `INSERT INTO clips (user_id, blob_url, thumbnail_url, game, title, social_post_url, status, job_id, source_url, start_s, end_s, category, ai_score, ai_reason, ai_rules)
         VALUES ($1, $2, $3, 'cs2', $4, $5, 'done', $6, $7, $8, $9, $10, $11, $12, $13)`,
        [job.user_id, `/api/clips/files/${name}.mp4`, `/api/clips/files/${name}.jpg`, p.title, deepLink(job, offset + p.start), job.id, job.source, offset + p.start, offset + p.end, p.category, p.score, p.reason, p.rules],
      );
    }
    await setJob(db, job.id, { status: 'done', stage: 'done', progress: 1, clip_count: picks.length });
    return picks;
  } catch (e) {
    await setJob(db, job.id, { status: 'failed', error: (e as Error).message.slice(0, 500) });
    throw e;
  } finally {
    if (!process.env.KEEP_WORK) rmSync(dir, { recursive: true, force: true });
  }
}
