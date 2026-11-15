// The FaZe clip RGB Sync plays, and its moments (seconds into the video).
// Fine-tune with marking mode on /rgb (W/A/L/M/C/S), then paste the copied JSON into `cues`.
import type { Cue } from './cues';

export const CLIP: { videoId: string; title: string; opponent: string; event: string; cues: Cue[] } = {
  videoId: 'keH4506gXfk',
  title: 'QUARTER-FINAL! FaZe vs TheMongolz - Official Highlights - BLAST Premier Bounty S2 2026',
  opponent: 'The MongolZ',
  event: 'BLAST Premier Bounty S2 2026 · Quarter-final',
  cues: [
    { t: 5, type: 'match_start' },
    { t: 15, type: 'round_win' },
    { t: 25, type: 'ace' },
  ],
};
