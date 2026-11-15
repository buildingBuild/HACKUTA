// Effect name -> step sequence. A new effect cancels the running one. When an effect ends the board returns to
// the base (dim FaZe red while a clip plays) or, with the base off, switches off.
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
  round_loss: [{ do: (l) => l.off(), ms: 1000 }], // blackout against the dim-red base
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
  private baseOn = false;
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
    if (my === this.gen) this.rest();
    return true;
  }

  /** Base on: rest on dim red between effects. Off: lights off. Either way a running effect stops now. */
  setBase(on: boolean): void {
    this.gen++;
    this.baseOn = on;
    this.rest();
  }

  private rest(): void {
    if (this.baseOn) this.lights.base();
    else this.lights.off();
  }

  stop(): void {
    this.gen++;
  }
}
