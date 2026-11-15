// Tiny Gemini client for the Interactions API (POST /v1beta/interactions). Joe.
// gemini-2.5 models are closed to new keys, so this uses GEMINI_MODEL (default gemini-3.5-flash).
const URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

export const MODEL = () => process.env.GEMINI_MODEL || 'gemini-3.5-flash';

export type Part =
  | { type: 'text'; text: string }
  | { type: 'video'; data: string; mime_type: string }
  | { type: 'function_result'; name: string; call_id: string; result: { type: 'text'; text: string }[] };

export interface Tool {
  type: 'function';
  name: string;
  description: string;
  parameters: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
}

export interface FunctionCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface Interaction {
  id: string;
  text: string;
  calls: FunctionCall[];
}

interface Body {
  input: string | Part[];
  system_instruction?: string;
  tools?: Tool[];
  previous_interaction_id?: string;
  thinking?: 'minimal' | 'low' | 'medium' | 'high';
  schema?: Record<string, unknown>;
}

// Free tier allows ~5 requests/min per model. Space calls out (GEMINI_RPM to raise it on a paid key).
let nextSlot = 0;
async function pace() {
  const gap = 60_000 / Number(process.env.GEMINI_RPM || 5);
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + gap;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

export async function interact(b: Body, timeoutMs = 120_000): Promise<Interaction> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const body: Record<string, unknown> = {
    model: MODEL(),
    input: b.input,
    generation_config: { thinking_level: b.thinking ?? 'low' },
  };
  if (b.system_instruction) body.system_instruction = b.system_instruction;
  if (b.tools) body.tools = b.tools;
  if (b.previous_interaction_id) body.previous_interaction_id = b.previous_interaction_id;
  if (b.schema) body.response_format = { type: 'text', mime_type: 'application/json', schema: b.schema };

  let last: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await pace();
      const res = await fetch(URL, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json', 'Api-Revision': '2026-05-20' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const json = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: { message?: string };
        steps?: { type: string; content?: { type: string; text?: string }[]; id?: string; name?: string; arguments?: Record<string, unknown> }[];
      };
      if (res.status === 429) {
        // rate limited: wait as long as Google asks, then try again
        const wait = Number(json.error?.message?.match(/retry in ([\d.]+)s/i)?.[1] ?? 20);
        nextSlot = Date.now() + (wait + 1) * 1000;
        last = new Error(`Gemini 429: ${json.error?.message ?? ''}`);
        continue;
      }
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${json.error?.message ?? 'request failed'}`);
      const steps = json.steps ?? [];
      return {
        id: json.id ?? '',
        text: steps
          .filter((s) => s.type === 'model_output')
          .flatMap((s) => s.content ?? [])
          .map((c) => c.text ?? '')
          .join(''),
        calls: steps
          .filter((s) => s.type === 'function_call')
          .map((s) => ({ id: s.id ?? '', name: s.name ?? '', arguments: s.arguments ?? {} })),
      };
    } catch (e) {
      last = e;
      if (/40[0134]/.test(String((e as Error).message))) break; // bad request / auth: don't retry
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw last;
}

/** Ask for JSON matching `schema` and parse it. */
export async function json<T>(input: string | Part[], schema: Record<string, unknown>, thinking: Body['thinking'] = 'minimal'): Promise<T> {
  const r = await interact({ input, schema, thinking });
  return JSON.parse(r.text.replace(/^```(?:json)?\s*|\s*```$/g, '')) as T;
}
