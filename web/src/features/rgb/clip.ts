// The FaZe clip RGB Sync plays, and its moments (seconds into the video).
// Kill times were read off the broadcast HUD frame by frame (a player's row turns red the instant they die).
// Fine-tune with marking mode on /rgb (K/W/A/L/M/C/S), then paste the copied JSON into `cues`.
import type { Cue } from './cues';

export const CLIP: { videoId: string; title: string; opponent: string; event: string; cues: Cue[] } = {
  videoId: 'fZk3WFybVG0',
  title: 'FaZe Broky insane AWP 1v3 to fend off Eternal Fire - IEM Katowice 2025 (Triple OT)',
  opponent: 'Eternal Fire',
  event: 'IEM Katowice 2025 · Broky 1v3 AWP clutch, triple overtime',
  cues: [
    { t: 3.2, type: 'kill' }, // Broky kills Jottaaa
    { t: 15.1, type: 'kill' }, // Broky kills MAJ3R
    { t: 19.2, type: 'clutch' }, // Broky kills XANTARES: 1v3 won
    { t: 22.6, type: 'round_win' }, // crowd erupts
  ],
};
