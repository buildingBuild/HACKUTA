// Scout report summary: LLM-written from real stats + best clips, with a
// deterministic template fallback so the threshold moment never fails on stage.
import { generateText, withTimeout } from './gemini.js';

export interface ScoutInput {
  handle: string;
  displayName?: string | null;
  region?: string | null;
  metrics: Record<string, number | null>;
  topClips: { title: string | null; map: string | null; overall_score: number; summary: string | null }[];
}

const fmt = (v: number | null | undefined, d = 2) => (v == null ? 'n/a' : Number.isInteger(v) ? String(v) : v.toFixed(d));

export function templateSummary(i: ScoutInput): string {
  const m = i.metrics;
  const best = i.topClips[0];
  return [
    `${i.displayName || i.handle} just cleared the FaZe player-track bar${i.region ? ` out of ${i.region}` : ''}.`,
    `FACEIT level ${fmt(m.faceit_level, 0)} at ${fmt(m.elo, 0)} ELO, with a ${fmt(m.kd)} K/D, ${fmt(m.hs_pct, 0)}% headshots and ${fmt(m.adr, 0)} ADR over the last 20 matches.`,
    best
      ? `Their best clip${best.map ? ` on ${best.map}` : ''} scored ${best.overall_score}: ${best.summary ?? 'strong overall execution'}`
      : `Average AI clip score is ${fmt(m.avg_clip_score, 0)}.`,
    `Recommend a review for FaZe Up Next.`,
  ].join(' ');
}

export async function writeScoutReport(i: ScoutInput): Promise<{ summary: string; source: 'llm' | 'template' }> {
  if (process.env.COACHING_MODE === 'cache' || !process.env.GEMINI_API_KEY) {
    return { summary: templateSummary(i), source: 'template' };
  }
  const prompt = `You are a FaZe Clan CS2 talent scout writing a short briefing for a recruiter. It will also be read aloud, so write in plain spoken sentences, no lists, no markdown, no emojis.

Write 3 to 4 sentences: who the player is, the headline stats, what the clips show (strength + one thing to watch), and a recommendation. Only use the facts below; do not invent stats.

Player: ${i.displayName || i.handle} (@${i.handle})${i.region ? `, region ${i.region}` : ''}
Stats (last 20 matches): ${JSON.stringify(i.metrics)}
Top clips: ${JSON.stringify(i.topClips)}`;
  try {
    const summary = await withTimeout(generateText(prompt), 20_000, 'scout report');
    return { summary, source: 'llm' };
  } catch (e) {
    console.warn('[scoutReport] LLM failed, using template:', (e as Error).message);
    return { summary: templateSummary(i), source: 'template' };
  }
}
