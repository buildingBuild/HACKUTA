// Cross-cutting contracts (REQUIREMENTS.md §7.3). SHARED FILE: additive changes only, team check first.
// Dependency-free TS, imported by relative path from web (Vite) and server (tsx). Keep it to types + tiny constants.

export type Role = 'user' | 'recruiter' | 'admin';
export const STAFF_ROLES: readonly Role[] = ['recruiter', 'admin'];

export type Game = 'cs2' | 'r6' | 'cod';

/** One thing that happened in FaZe's live match. Logged to the `live_events` hypertable (Phase 2). */
export type LiveEventType =
  | 'match_start'
  | 'round_win'
  | 'round_loss'
  | 'ace'
  | 'clutch'
  | 'match_win'
  | 'match_loss'
  | 'match_end';

export const LIVE_EVENT_TYPES: readonly LiveEventType[] = [
  'match_start',
  'round_win',
  'round_loss',
  'ace',
  'clutch',
  'match_win',
  'match_loss',
  'match_end',
];

export type LiveEvent = {
  id: string;
  type: LiveEventType;
  game: Game;
  opponent: string;
  score: { faze: number; opp: number };
  ts: number; // server time, ms
};

/** Current match state shown in the Home live banner. `live: false` means show the next match, if any. */
export type LiveStatus = {
  live: boolean;
  game: Game;
  opponent: string | null;
  event: string | null; // tournament name, e.g. "IEM Cologne"
  score: { faze: number; opp: number };
  startedAt: number | null; // ms
  nextMatchAt: number | null; // ms, when not live
  lastEvent: LiveEvent | null;
  source: 'mock' | 'director' | 'feed';
};

/** Home page live counters. */
export type LiveCounters = {
  pixelsToday: number;
  setupsSynced: number;
  guessersToday: number;
  fansOnline: number;
};

/** GET /api/live */
export type LiveSnapshot = { status: LiveStatus; counters: LiveCounters };
