export type GameId = 'cs2' | 'cod' | 'r6' | 'valorant' | 'fortnite' | 'apex';

export interface OnboardingData {
  game: GameId | null;
  gamertag: string;
  twitch: string;
  youtube: string;
  psn: string;
  xbox: string;
}

export type StepId = 'intro' | 'game' | 'gamertag' | 'accounts' | 'review';

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
  { id: 'accounts', label: 'Highlights', required: false },
  { id: 'review', label: 'Lock in', required: false },
];

export interface RosterPlayer {
  /** In-game name. Leave empty for an unknown slot (shows a silhouette). */
  name: string;
  /** e.g. '/games/cs2/roster/name.jpg'. Falls back to a silhouette if missing. */
  photo?: string;
}

export interface GameOption {
  id: GameId;
  code: string;
  name: string;
  /** Team name shown in the caption, e.g. "FaZe Vegas" */
  team: string;
  /** Set when FaZe no longer fields a team: label for the last lineup, e.g. "Former roster · 2023" */
  former?: string;
  live: boolean;
  /** Files live in web/public. Missing files fall back gracefully. */
  logo: string;
  cover: string;
  roster: RosterPlayer[];
}

// Rosters from HLTV / Liquipedia (Nov 2026). Games with no active FaZe team have an empty roster.
// Photos: transparent cutouts saved locally so the demo works offline.
const roster = (game: GameId, names: string[], ext = 'png'): RosterPlayer[] =>
  names.map((name) => ({ name, photo: `/games/${game}/roster/${name.toLowerCase()}.${ext}` }));

export const GAMES: GameOption[] = [
  {
    id: 'cs2',
    code: 'CS2',
    name: 'Counter-Strike 2',
    team: 'FaZe CS2',
    live: true,
    logo: '/games/cs2/logo.svg',
    cover: '/games/cs2/cover.jpg',
    roster: roster('cs2', ['Twistzz', 'frozen', 'Neityu', 'jcobbb', 'JBOEN'], 'webp'),
  },
  {
    id: 'valorant',
    code: 'VAL',
    name: 'Valorant',
    team: 'FaZe Valorant',
    former: 'Former roster · 2023',
    live: false,
    logo: '/games/valorant/logo.svg',
    cover: '',
    // only babybay + Rossy have photos; the rest show by name
    roster: [
      { name: 'babybay', photo: '/games/valorant/roster/babybay.png' },
      { name: 'dicey' },
      { name: 'supamen' },
      { name: 'POISED' },
      { name: 'Rossy', photo: '/games/valorant/roster/rossy.png' },
    ],
  },
  {
    id: 'r6',
    code: 'R6S',
    name: 'Rainbow Six Siege',
    team: 'FaZe R6',
    live: false,
    logo: '/games/r6/logo.svg',
    cover: '/games/r6/cover.jpg',
    roster: roster('r6', ['VITAKING', 'Cyber', 'Soulz1', 'Handyy', 'KDS']),
  },
  {
    id: 'cod',
    code: 'COD',
    name: 'Call of Duty',
    team: 'FaZe Vegas',
    live: false,
    logo: '/games/cod/logo.svg',
    cover: '/games/cod/cover.jpg',
    roster: roster('cod', ['Simp', 'Alluka', 'HyDra', 'Scrap']),
  },
  {
    id: 'fortnite',
    code: 'FN',
    name: 'Fortnite',
    team: 'FaZe Fortnite',
    former: 'Former roster · disbanded Dec 2025',
    live: false,
    logo: '/games/fortnite/logo.svg',
    cover: '',
    roster: [{ name: 'EpikWhale' }, { name: 'Replays' }],
  },
  {
    id: 'apex',
    code: 'APX',
    name: 'Apex Legends',
    team: 'FaZe Apex',
    former: 'Former roster · 2026',
    live: false,
    logo: '/games/apex/logo.svg',
    cover: '',
    roster: [{ name: 'Sinetic' }, { name: 'Zaine' }, { name: 'Naghz' }],
  },
];

export const EMPTY_DATA: OnboardingData = {
  game: null,
  gamertag: '',
  twitch: '',
  youtube: '',
  psn: '',
  xbox: '',
};
