// Gemini clip analysis. Video goes Blob URL -> server -> Gemini (never through
// our API body from the browser). Small clips are sent inline, larger ones via
// the Files API.
import { GoogleGenAI, createPartFromBase64, createPartFromUri, type Part } from '@google/genai';
import { CoachingReportSchema, coachingJsonSchema, type CoachingReport } from './coachingSchema.js';
import { buildCoachingPrompt, buildRepairPrompt, type PlayerContext } from './prompt.js';

const INLINE_LIMIT_BYTES = 18 * 1024 * 1024; // Gemini inline request cap is ~20MB total

export const geminiModel = () => process.env.GEMINI_MODEL || 'gemini-3.8-flash';

/** Primary model, then fallbacks tried on overload (503/429/5xx) or a slow attempt. */
export const modelChain = (): string[] => {
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS ?? 'gemini-3.5-flash,gemini-3.5-flash-lite')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([geminiModel(), ...fallbacks])];
};
const ATTEMPT_TIMEOUT_MS = Number(process.env.GEMINI_ATTEMPT_TIMEOUT_MS || 20_000);

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

const retryable = (e: unknown) => {
  const status = (e as { status?: number }).status;
  return status === 429 || (status != null && status >= 500) || /timed out/i.test((e as Error).message ?? '');
};

type GenParams = Omit<Parameters<GoogleGenAI['models']['generateContent']>[0], 'model'>;

/** generateContent across the model chain. Returns the text and which model produced it. */
async function generate(params: GenParams, models = modelChain()): Promise<{ text: string; model: string }> {
  let lastErr: unknown;
  for (const model of models) {
    try {
      const res = await withTimeout(ai().models.generateContent({ ...params, model }), ATTEMPT_TIMEOUT_MS, `Gemini ${model}`);
      return { text: res.text ?? '', model };
    } catch (e) {
      lastErr = e;
      if (!retryable(e)) throw e;
      console.warn(`[gemini] ${model} unavailable (${(e as { status?: number }).status ?? (e as Error).message}), trying next model`);
    }
  }
  throw lastErr;
}

function guessMime(url: string, header?: string | null): string {
  if (header && header.startsWith('video/')) return header.split(';')[0];
  if (/\.webm(\?|$)/i.test(url)) return 'video/webm';
  if (/\.mov(\?|$)/i.test(url)) return 'video/quicktime';
  return 'video/mp4';
}

const isYouTube = (url: string) => /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(url);

/** Turns a clip URL (blob storage, YouTube, or local file:// path) into a Gemini Part. */
async function videoPart(url: string): Promise<Part> {
  // Gemini can read public YouTube URLs directly.
  if (isYouTube(url)) return { fileData: { fileUri: url, mimeType: 'video/mp4' } };

  let bytes: Buffer;
  let mime: string;
  if (url.startsWith('file://') || /^[a-zA-Z]:[\\/]/.test(url) || url.startsWith('/')) {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const p = url.startsWith('file://') ? fileURLToPath(url) : url;
    bytes = await readFile(p);
    mime = guessMime(p);
  } else {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not download clip (${res.status})`);
    bytes = Buffer.from(await res.arrayBuffer());
    mime = guessMime(url, res.headers.get('content-type'));
  }

  if (bytes.byteLength <= INLINE_LIMIT_BYTES) {
    return createPartFromBase64(bytes.toString('base64'), mime);
  }

  // Large clip: Files API upload, then wait for processing.
  const uploaded = await ai().files.upload({
    file: new Blob([new Uint8Array(bytes)], { type: mime }),
    config: { mimeType: mime },
  });
  let file = uploaded;
  for (let i = 0; i < 30 && file.state === 'PROCESSING'; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    file = await ai().files.get({ name: file.name! });
  }
  if (file.state !== 'ACTIVE' || !file.uri) throw new Error(`Gemini file not ready (${file.state})`);
  return createPartFromUri(file.uri, file.mimeType ?? mime);
}

function parseReport(text: string): { ok: true; report: CoachingReport } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch (e) {
    return { ok: false, error: `invalid JSON: ${(e as Error).message}` };
  }
  const parsed = CoachingReportSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  return { ok: true, report: parsed.data };
}

/**
 * Analyze a clip with Gemini. Validates with zod and retries once with a repair
 * prompt. Throws on failure; callers fall back to the cache (see coachingService).
 */
export async function analyzeClip(clipUrl: string, ctx: PlayerContext): Promise<{ report: CoachingReport; model: string }> {
  const video = await videoPart(clipUrl);
  const config = {
    responseMimeType: 'application/json',
    responseJsonSchema: coachingJsonSchema,
    temperature: 0.4,
  };

  const first = await generate({
    contents: [{ role: 'user', parts: [video, { text: buildCoachingPrompt(ctx) }] }],
    config,
  });
  const r1 = parseReport(first.text);
  if (r1.ok) return { report: r1.report, model: first.model };

  // Repair on the model that just answered (it's up), then the rest of the chain.
  const chain = modelChain();
  const second = await generate(
    { contents: [{ role: 'user', parts: [{ text: buildRepairPrompt(first.text, r1.error) }] }], config },
    [first.model, ...chain.filter((m) => m !== first.model)],
  );
  const r2 = parseReport(second.text);
  if (r2.ok) return { report: r2.report, model: second.model };
  throw new Error(`Gemini output failed validation twice: ${r2.error}`);
}

/** Plain text generation (scout report summaries). */
export async function generateText(prompt: string): Promise<string> {
  const { text } = await generate({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { temperature: 0.6 },
  });
  if (!text.trim()) throw new Error('Gemini returned empty text');
  return text.trim();
}

export function withTimeout<T>(p: Promise<T>, ms: number, label = 'operation'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}
