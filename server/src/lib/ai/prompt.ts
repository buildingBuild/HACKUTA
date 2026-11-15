// CS2 coaching prompt, grounded in the player's real context to limit hallucination.

export interface PlayerContext {
  handle?: string;
  faceit_level?: number | null;
  faceit_elo?: number | null;
  map?: string | null;
  side?: string | null; // 'T' | 'CT'
  title?: string | null;
  stats?: Partial<Record<'kd' | 'hs_pct' | 'adr' | 'win_rate', number>>;
}

export function buildCoachingPrompt(ctx: PlayerContext): string {
  const lines = [
    ctx.handle && `Player: ${ctx.handle}`,
    ctx.faceit_level != null && `FACEIT level: ${ctx.faceit_level}`,
    ctx.faceit_elo != null && `FACEIT ELO: ${ctx.faceit_elo}`,
    ctx.map && `Map: ${ctx.map}`,
    ctx.side && `Side: ${ctx.side}`,
    ctx.title && `Clip title: ${ctx.title}`,
    ctx.stats?.kd != null && `Recent K/D (last 20): ${ctx.stats.kd}`,
    ctx.stats?.hs_pct != null && `Recent HS%: ${ctx.stats.hs_pct}`,
    ctx.stats?.adr != null && `Recent ADR: ${ctx.stats.adr}`,
  ].filter(Boolean);

  return `You are an experienced Counter-Strike 2 coach reviewing a short gameplay clip for a player who wants to go pro.

Player context (use it to calibrate how strict you are: a FACEIT level 10 is judged against pro standards, a level 5 against solid-amateur standards):
${lines.length ? lines.join('\n') : 'No context provided.'}

Watch the whole clip. Score each category 0-100 and give an overall score 0-100:
- crosshair_placement: head level, pre-aiming common angles, not aiming at the floor/walls when clearing
- movement: counter-strafing before shooting, peek type (wide swing vs jiggle vs shoulder peek), not shooting while moving
- spray_control: recoil compensation, bursting vs spraying at range, resetting
- utility: smokes/flashes/molotovs/HE timing, using utility before entry, pop flashes
- positioning: isolated deaths, crossfires, tradeable spacing, refrags
- decision_making: rotations, economy awareness, clutch choices, info gathering

Rules:
- Give 3 to 5 notes. Each note's "t" is the mm:ss timestamp in THIS clip where it happens. Only describe things you can actually see; if a category isn't visible in the clip, score it near the player's level average and don't invent a note for it.
- Each note needs a concrete "fix" a player can practise.
- Give 1 or 2 drills using real CS2 practice resources (e.g. aim_botz, Yprac prefire maps, recoil master, refrag/aim_lab style routines, deathmatch with a specific constraint).
- "summary" is one sentence: their biggest strength and their biggest leak.
- Use CS2 terminology. Be direct, like a real coach. Return only JSON.`;
}

export function buildRepairPrompt(badOutput: string, error: string): string {
  return `Your previous answer did not match the required JSON schema.
Validation error: ${error}
Previous answer:
${badOutput.slice(0, 4000)}

Return the corrected JSON only, keeping the same coaching content.`;
}
