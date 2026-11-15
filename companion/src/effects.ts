// Effect name -> step sequence. Every effect ends with the lights off; a new effect cancels the running one.
import type { Lights } from './aura.ts';

export type EffectName = 'round_win' | 'round_loss' | 'ace' | 'clutch' | 'match_win' | 'match_start';
export type Step = { do: (l: Lights) => void; ms: number };

const RED = [255, 0, 0] as const;
const WHITE = [255, 255, 255] as const;
const strobe: Step[] = Array.from({ length: 8 }, () => [
  { do: (l: Lights) => l.color(...WHITE), ms: 125 },
  { do: (l: Lights) => l.color(...RED), ms: 125 },
]).flat();

export const EFFECTS: Record<EffectName, Step[]> = {
  round_win: [{ do: (l) => l.mode(1, ...RED, 'slow'), ms: 2000 }],
  round_loss: [{ do: (l) => l.color(60, 0, 0), ms: 1000 }],
  ace: strobe,
  clutch: strobe,
  match_win: [{ do: (l) => l.mode(2, ...RED, 'fast'), ms: 4000 }],
  match_start: [
    { do: (l) => l.color(...WHITE), ms: 400 },
    { do: (l) => l.color(...RED), ms: 600 },
  ],
};

export const isEffect = (name: string): name is EffectName => Object.hasOwn(EFFECTS, name);
const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class Player {
  private gen = 0;
  constructor(
    private lights: Lights,
    private sleep: (ms: number) => Promise<void> = realSleep,
  ) {}

  /** Play an effect; resolves false for unknown names. Superseded effects stop without turning lights off. */
  async play(name: string): Promise<boolean> {
    if (!isEffect(name)) return false;
    const my = ++this.gen;
    for (const step of EFFECTS[name]) {
      if (my !== this.gen) return true;
      step.do(this.lights);
      await this.sleep(step.ms);
    }
    if (my === this.gen) this.lights.off();
    return true;
  }

  stop(): void {
    this.gen++;
  }
}
