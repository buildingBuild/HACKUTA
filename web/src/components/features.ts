// Feature registry: one source for the nav "Features" menu, Home cards and placeholder pages. SHARED.
// When a Phase 2 feature ships, flip `status` to 'live' and route its path to the real page in App.tsx.

export interface FeatureInfo {
  slug: 'hud' | 'rgb' | 'guessr' | 'wall';
  path: string;
  name: string;
  short: string; // nav label
  tagline: string; // one-liner (REQUIREMENTS.md §5.2)
  cta: string;
  mark: string; // big glyph on cards / placeholder
  status: 'soon' | 'live';
  bullets: string[];
}

export const FEATURES: FeatureInfo[] = [
  {
    slug: 'hud',
    path: '/hud',
    name: 'Broadcast HUD',
    short: 'HUD',
    tagline: 'Every CS2 streamer gets a pro tournament broadcast HUD for free, and it’s FaZe branded.',
    cta: 'Get the HUD',
    mark: 'HUD',
    status: 'soon',
    bullets: [
      'Drop one config file in CS2. Game State Integration is official and read-only.',
      'Add the overlay to OBS as a browser source: kill feed, multi-kill stingers, round banners.',
      'A big FAZE UP stinger when you hit an ace.',
    ],
  },
  {
    slug: 'rgb',
    path: '/rgb',
    name: 'RGB Sync',
    short: 'RGB Sync',
    tagline: 'When FaZe wins a round, every gamer’s RGB setup turns red.',
    cta: 'Sync your setup',
    mark: 'RGB',
    status: 'soon',
    bullets: [
      'Keyboard, mouse and room lights react live during FaZe matches.',
      'Red pulse on a round win, strobe on an ace, a crest sweep on a match win.',
      'Works with OpenRGB, Razer Chroma, Philips Hue and Govee.',
    ],
  },
  {
    slug: 'guessr',
    path: '/guessr',
    name: 'FaZe Guessr',
    short: 'Guessr',
    tagline: 'GeoGuessr, but every location is a legendary FaZe play.',
    cta: 'Play today’s',
    mark: '?',
    status: 'soon',
    bullets: [
      'One screenshot a day from a famous FaZe moment. Click where it happened on the map.',
      'Score by distance, bonus for naming the event.',
      'Reveal the clip, share your result, climb the daily board.',
    ],
  },
  {
    slug: 'wall',
    path: '/wall',
    name: 'The Wall',
    short: 'The Wall',
    tagline: 'r/place, but FaZe’s live results control how fast you can paint.',
    cta: 'Place a pixel',
    mark: '▦',
    status: 'soon',
    bullets: [
      'One shared canvas, one pixel per cooldown.',
      'Every FaZe round win starts hype mode: cooldowns drop for a minute.',
      'An ace gives everyone a free pixel. Timelapse after the match.',
    ],
  },
];

export const featureByPath = (path: string) => FEATURES.find((f) => f.path === path);
