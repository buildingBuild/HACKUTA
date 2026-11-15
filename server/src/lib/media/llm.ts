// AI provider switch for the clip pipeline (Joe).
//   AI_PROVIDER=openai  -> OpenAI Responses API (OPENAI_API_KEY, OPENAI_MODEL). Video isn't a native input there,
//                          so a moment is shown as ~6 frames + the transcript/signals text.
//   AI_PROVIDER=gemini  -> Gemini Interactions API (GEMINI_API_KEY, GEMINI_MODEL). Watches the actual clip (video + audio).
// Default: openai when OPENAI_API_KEY is set, otherwise gemini.
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { interact, type Part } from './gemini.js';

export interface ToolDef {
  name: string;
  description: string;
  parameters: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
}

export const provider = (): 'openai' | 'gemini' =>
  (process.env.AI_PROVIDER as 'openai' | 'gemini') || (process.env.OPENAI_API_KEY ? 'openai' : 'gemini');

const ffmpeg = (args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const p = spawn('ffmpeg', ['-loglevel', 'error', '-y', ...args], { stdio: 'ignore' });
    p.on('error', reject);
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg exited ${c}`))));
  });

/** ~6 evenly spaced frames from a short segment, as base64 JPEGs (OpenAI path). */
async function frames(segment: string, count = 6): Promise<string[]> {
  const dir = path.dirname(segment);
  const stem = path.basename(segment, '.mp4');
  const probe = await new Promise<number>((resolve) => {
    const p = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', segment]);
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('close', () => resolve(Number(out) || 10));
  });
  await ffmpeg(['-i', segment, '-vf', `fps=${count / probe},scale=768:-2`, '-frames:v', String(count), '-q:v', '5', path.join(dir, `${stem}-f%02d.jpg`)]);
  return readdirSync(dir)
    .filter((f) => f.startsWith(`${stem}-f`) && f.endsWith('.jpg'))
    .sort()
    .map((f) => readFileSync(path.join(dir, f)).toString('base64'));
}

// ---------- OpenAI (Responses API) ----------
const OPENAI_URL = 'https://api.openai.com/v1/responses';
const openaiModel = () => process.env.OPENAI_MODEL || 'gpt-5-mini';

type OpenAIOut = {
  id: string;
  output?: { type: string; call_id?: string; name?: string; arguments?: string; content?: { type: string; text?: string }[] }[];
  error?: { message?: string };
};

async function openai(body: Record<string, unknown>): Promise<OpenAIOut> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set');
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: openaiModel(), ...body }),
      signal: AbortSignal.timeout(120_000),
    }).catch((e) => e as Error);
    if (res instanceof Error) {
      last = res;
    } else {
      const json = (await res.json().catch(() => ({}))) as OpenAIOut;
      if (res.ok) return json;
      last = new Error(`OpenAI ${res.status}: ${json.error?.message ?? 'request failed'}`);
      if (res.status !== 429 && res.status < 500) break;
    }
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  throw last;
}

const outText = (r: OpenAIOut) =>
  (r.output ?? [])
    .filter((o) => o.type === 'message')
    .flatMap((o) => o.content ?? [])
    .map((c) => c.text ?? '')
    .join('');

/** OpenAI strict JSON schema needs additionalProperties:false on every object. */
function strict(schema: Record<string, unknown>): Record<string, unknown> {
  if (schema.type !== 'object') return schema;
  const props = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  return {
    ...schema,
    additionalProperties: false,
    required: Object.keys(props),
    properties: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, strict(v)])),
  };
}

// ---------- public API ----------

/** Look at a short video segment (+ context text) and return JSON matching `schema`. */
export async function judge<T>(segment: string, prompt: string, schema: Record<string, unknown>): Promise<T> {
  if (provider() === 'gemini') {
    const input: Part[] = [
      { type: 'video', data: readFileSync(segment).toString('base64'), mime_type: 'video/mp4' },
      { type: 'text', text: prompt },
    ];
    const r = await interact({ input, schema, thinking: 'minimal' });
    return JSON.parse(r.text.replace(/^```(?:json)?\s*|\s*```$/g, '')) as T;
  }
  const imgs = await frames(segment);
  const r = await openai({
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: `${prompt}\n(You are seeing ${imgs.length} frames sampled evenly across the moment, in order. Audio is described by the transcript/signals above.)` },
          ...imgs.map((b) => ({ type: 'input_image', image_url: `data:image/jpeg;base64,${b}`, detail: 'low' })),
        ],
      },
    ],
    text: { format: { type: 'json_schema', name: 'verdict', schema: strict(schema), strict: true } },
    reasoning: { effort: 'minimal' },
  });
  return JSON.parse(outText(r)) as T;
}

/**
 * Tool-calling loop. `exec` runs a tool and returns its result; the loop ends when the model
 * stops calling tools, calls a tool named `finish`, or after `maxTurns`.
 */
export async function runAgent(
  system: string,
  user: string,
  tools: ToolDef[],
  exec: (name: string, args: Record<string, unknown>) => Promise<unknown>,
  maxTurns = 18,
): Promise<void> {
  const call = async (name: string, args: Record<string, unknown>) => {
    try {
      return JSON.stringify(await exec(name, args)).slice(0, 12_000);
    } catch (e) {
      return JSON.stringify({ error: (e as Error).message });
    }
  };

  if (provider() === 'gemini') {
    const gTools = tools.map((t) => ({ type: 'function' as const, ...t }));
    let res = await interact({ system_instruction: system, input: user, tools: gTools, thinking: 'low' });
    for (let turn = 0; turn < maxTurns && res.calls.length; turn++) {
      const results: Part[] = [];
      for (const c of res.calls) results.push({ type: 'function_result', name: c.name, call_id: c.id, result: [{ type: 'text', text: await call(c.name, c.arguments) }] });
      if (res.calls.some((c) => c.name === 'finish')) return;
      res = await interact({ input: results, previous_interaction_id: res.id, tools: gTools, thinking: 'low' });
    }
    return;
  }

  const oTools = tools.map((t) => ({ type: 'function', name: t.name, description: t.description, parameters: t.parameters }));
  let res = await openai({ instructions: system, input: user, tools: oTools, reasoning: { effort: 'low' } });
  for (let turn = 0; turn < maxTurns; turn++) {
    const calls = (res.output ?? []).filter((o) => o.type === 'function_call');
    if (!calls.length) return;
    const outputs = [];
    for (const c of calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(c.arguments ?? '{}');
      } catch {
        /* model sent bad JSON: run with no args */
      }
      outputs.push({ type: 'function_call_output', call_id: c.call_id, output: await call(c.name ?? '', args) });
    }
    if (calls.some((c) => c.name === 'finish')) return;
    res = await openai({ previous_response_id: res.id, input: outputs, tools: oTools, reasoning: { effort: 'low' } });
  }
}
