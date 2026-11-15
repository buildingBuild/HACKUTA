// Scout report summary: a deterministic template built from real stats (no LLM since the V3 pivot).
export interface ScoutInput {
  handle: string;
  displayName?: string | null;
  region?: string | null;
  metrics: Record<string, number | null>;
}

const fmt = (v: number | null | undefined, d = 2) => (v == null ? 'n/a' : Number.isInteger(v) ? String(v) : v.toFixed(d));

export function templateSummary(i: ScoutInput): string {
  const m = i.metrics;
  const winRate = m.win_rate != null ? ` and a ${fmt(m.win_rate, 0)}% win rate` : '';
  return [
    `${i.displayName || i.handle} just cleared the FaZe player-track bar${i.region ? ` out of ${i.region}` : ''}.`,
    `FACEIT level ${fmt(m.faceit_level, 0)} at ${fmt(m.elo, 0)} ELO, with a ${fmt(m.kd)} K/D, ${fmt(m.hs_pct, 0)}% headshots and ${fmt(m.adr, 0)} ADR over the last 20 matches${winRate}.`,
    `Recommend a review for FaZe Up Next.`,
  ].join(' ');
}
