export type GameId = 'cs2' | 'valorant' | 'fortnite' | 'apex' | 'r6';

export interface OnboardingData {
  game: GameId | null;
  gamertag: string;
  twitch: string;
  youtube: string;
  psn: string;
  xbox: string;
}

export type StepId = 'intro' | 'game' | 'gamertag' | 'streaming' | 'console' | 'review';

export interface StepMeta {
  id: StepId;
  label: string;
  required: boolean;
}

export type StepStatus = 'done' | 'skipped' | 'current' | 'pending';

export const STEPS: StepMeta[] = [
  { id: 'intro', label: 'Start', required: false },
  { id: 'game', label: 'Game', required: true },
  { id: 'gamertag', label: 'Gamertag', required: true },
  { id: 'streaming', label: 'Stream', required: false },
  { id: 'console', label: 'Console', required: false },
  { id: 'review', label: 'Lock in', required: false },
];

export interface GameOption {
  id: GameId;
  code: string;
  name: string;
  live: boolean;
}

export const GAMES: GameOption[] = [
  { id: 'cs2', code: 'CS2', name: 'Counter-Strike 2', live: true },
  { id: 'valorant', code: 'VAL', name: 'Valorant', live: false },
  { id: 'fortnite', code: 'FN', name: 'Fortnite', live: false },
  { id: 'apex', code: 'APX', name: 'Apex Legends', live: false },
  { id: 'r6', code: 'R6S', name: 'Rainbow Six Siege', live: false },
];

export const EMPTY_DATA: OnboardingData = {
  game: null,
  gamertag: '',
  twitch: '',
  youtube: '',
  psn: '',
  xbox: '',
};
