// Effect name -> step sequence. A new effect cancels the running one. When an effect ends the board returns to
// the base (dim FaZe red while a clip plays) or, with the base off, switches off.
// Other lighting apps (Armoury Crate's own rainbow) repaint the keyboard behind our back, so the current state is
// re-applied every `keepAliveMs` while idle on the base or holding a long step.
import type { Lights } from './aura.ts';

export type EffectName = 'kill' | 'round_win' | 'round_loss' | 'ace' | 'clutch' | 'match_win' | 'match_start';
/** `rest` returns the board to its resting state (dim-red base, or off). */
export type Step = { do: (l: Lights, rest: () => void) => void; ms: number };

const RED = [255, 0, 0] as const;
const WHITE = [255, 255, 255] as const;
const strobe = (n: number): Step[] =>
  Array.from({ length: n }, () => [
    { do: (l: Lights) => l.color(...WHITE), ms: 125 },
    { do: (l: Lights) => l.color(...RED), ms: 125 },
  ]).flat();
// Full red against a full blackout: the round-win flash, exaggerated for a stage demo.
const flash: Step[] = Array.from({ length: 5 }, () => [
  { do: (l: Lights) => l.color(...RED), ms: 200 },
  { do: (l: Lights) => l.off(), ms: 120 },
]).flat();

export const EFFECTS: Record<EffectName, Step[]> = {
  // A FaZe kill: a white punch, then full red, then back to the base.
  kill: [
    { do: (l) => l.color(...WHITE), ms: 100 },
    { do: (l) => l.color(...RED), ms: 400 },
  ],
  round_win: [...flash, { do: (l) => l.color(...RED), ms: 600 }],
  round_loss: [{ do: (l) => l.off(), ms: 1000 }], // blackout against the dim-red base
  ace: strobe(12),
  clutch: strobe(12),
  match_win: [...strobe(12), { do: (l) => l.color(...RED), ms: 1500 }],
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
  private running = false;
  private keepAlive: ReturnType<typeof setInterval> | null = null;
  constructor(
    private lights: Lights,
    private sleep: (ms: number) => Promise<void> = realSleep,
    private keepAliveMs = 1000,
  ) {}

  /** Play an effect; resolves false for unknown names. Superseded effects stop without turning lights off. */
  async play(name: string): Promise<boolean> {
    if (!isEffect(name)) return false;
    const my = ++this.gen;
    const rest = () => this.rest();
    this.running = true;
    for (const step of EFFECTS[name]) {
      if (my !== this.gen) return true;
      step.do(this.lights, rest);
      // Hold the step, re-applying it in keepAliveMs slices so nothing else can repaint mid-effect.
      for (let left = step.ms; left > 0; ) {
        const slice = Math.min(left, this.keepAliveMs);
        await this.sleep(slice);
        left -= slice;
        if (my !== this.gen) return true;
        if (left > 0) step.do(this.lights, rest);
      }
    }
    if (my === this.gen) {
      this.running = false;
      this.rest();
    }
    return true;
  }

  /** Base on: rest on dim red between effects. Off: lights off. Either way a running effect stops now. */
  setBase(on: boolean): void {
    this.gen++;
    this.running = false;
    this.baseOn = on;
    this.rest();
    this.clearKeepAlive();
    if (on) {
      this.keepAlive = setInterval(() => {
        if (!this.running && this.baseOn) this.lights.base();
      }, this.keepAliveMs);
      this.keepAlive.unref?.();
    }
  }

  private clearKeepAlive(): void {
    if (this.keepAlive) clearInterval(this.keepAlive);
    this.keepAlive = null;
  }

  private rest(): void {
    if (this.baseOn) this.lights.base();
    else this.lights.off();
  }

  stop(): void {
    this.gen++;
    this.running = false;
    this.clearKeepAlive();
  }
}
