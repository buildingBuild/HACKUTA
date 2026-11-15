// The FaZe clip RGB Sync plays, and its moments (seconds into the video).
// Fine-tune with marking mode on /rgb (W/A/L/M/C/S), then paste the copied JSON into `cues`.
import type { Cue } from './cues';

export const CLIP: { videoId: string; title: string; opponent: string; event: string; cues: Cue[] } = {
  videoId: 'PLACEHOLDER',
  title: 'FaZe highlights',
  opponent: 'TBD',
  event: 'TBD',
  cues: [
    { t: 5, type: 'match_start' },
    { t: 15, type: 'round_win' },
    { t: 25, type: 'ace' },
  ],
};
