// Clip moments and playhead-crossing detection for RGB Sync (owner: Yao).
import type { LiveEventType } from '../../../../shared/types';

export type EffectName = Extract<LiveEventType, 'round_win' | 'round_loss' | 'ace' | 'clutch' | 'match_win' | 'match_start'>;
export type Cue = { t: number; type: EffectName };

/** Max playhead advance (s) between two frames that still counts as normal playback, not a seek. */
const MAX_STEP = 1.5;

/** Cues the playhead passed between two frames: prev < t <= now. A seek or backward jump fires nothing. */
export function crossed(prev: number, now: number, cues: Cue[]): Cue[] {
  const step = now - prev;
  if (step <= 0 || step > MAX_STEP) return [];
  return cues.filter((c) => c.t > prev && c.t <= now);
}
