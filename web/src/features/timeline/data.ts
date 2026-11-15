// FaZe timeline content: the main moments from "FaZe Clan: A Timeline, 2010–2026" (provided by FaZe for the challenge),
// condensed and paraphrased for the tree. Owner: Omar.

export type Kind = 'content' | 'esports' | 'trophy' | 'people' | 'culture' | 'setback';
export type PathId = 'returning' | 'new';

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  blurb: string;
  more?: string;
  kind: Kind;
  /** Filled in from PATH_IDS below. */
  paths?: PathId[];
  /** Crest star number (1-5) when this win put a star on the badge. */
  star?: number;
  source?: string;
  sourceLinks?: { label: string; url: string }[];
}

export interface Era {
  id: string;
  num: string;
  years: string;
  title: string;
  tagline: string;
  /** Oldest first. The tree renders newest at the top of each era. */
  events: TimelineEvent[];
}

export const KIND_LABEL: Record<Kind, string> = {
  content: 'Content',
  esports: 'Esports',
  trophy: 'Trophy',
  people: 'Roster',
  culture: 'Culture',
  setback: 'Setback',
};

export const PATHS: { id: PathId | 'all'; label: string; hint: string }[] = [
  { id: 'all', label: 'Everything', hint: 'The whole tree' },
  { id: 'returning', label: 'I was there', hint: 'The nostalgia run' },
  { id: 'new', label: "I'm new here", hint: 'The essential story' },
];

export const ERAS: Era[] = [
  {
    id: 'era-1',
    num: '01',
    years: '2010–11',
    title: 'The seed',
    tagline: 'Three kids, one Intervention, and the clips that changed Call of Duty YouTube.',
    events: [
      {
        id: 'founded',
        date: 'May 2010',
        title: 'FaZe Sniping is born',
        blurb: 'ClipZ, House Cat and Resistance start a trickshot crew on YouTube. The first upload goes live May 31.',
        kind: 'people',
        source: 'Wikipedia · FaZe Clan YouTube',
        sourceLinks: [{"label": "Wikipedia", "url": "https://en.wikipedia.org/wiki/FaZe_Clan"}, {"label": "FaZe Clan YouTube", "url": "https://www.youtube.com/watch?v=BvpbYhQWEDA"}],
      },
      {
        id: 'temperrr',
        date: 'Aug 2010',
        title: 'Temperrr joins at 16',
        blurb: 'He brings the logo idea — the reversed F over a C — and invents a shot so iconic it carries his name.',
        more: '“How to Temperrr Shot” does 5.75M views and teaches a generation of Xbox 360 players.',
        kind: 'people',
        source: 'FaZe Clan YouTube · Tubefilter',
        sourceLinks: [{"label": "FaZe Clan YouTube", "url": "https://www.youtube.com/watch?v=oYiMzAoGx1Y"}, {"label": "Tubefilter", "url": "https://www.tubefilter.com/2018/04/26/what-is-faze-clan-gaming-youtube-twitch/"}],
      },
      {
        id: 'our-war',
        date: 'Dec 16, 2010',
        title: '“Our War” — the first teamtage',
        blurb: 'The whole roster’s best clips cut to one track and dropped like an album. Around fifty more follow.',
        kind: 'content',
        source: 'FaZe Clan YouTube',
        sourceLinks: [{"label": "FaZe Clan YouTube", "url": "https://www.youtube.com/watch?v=WeFjqjCtGt8"}],
      },
      {
        id: 'community-montage',
        date: '2011',
        title: 'The scene grows around FaZe',
        blurb: 'Community montages, ILLCAMS and Top 5 Trickshots turn fans’ clips into FaZe content. 100K subscribers in eleven months.',
        kind: 'content',
        source: 'FaZe Clan YouTube',
        sourceLinks: [{"label": "FaZe Clan YouTube", "url": "https://www.youtube.com/watch?v=4IzDJtYhVto"}],
      },
    ],
  },
  {
    id: 'era-2',
    num: '02',
    years: '2012–13',
    title: 'The golden era',
    tagline: 'The biggest channel in Call of Duty, and the first step into competition.',
    events: [
      {
        id: '1m-teamtage',
        date: 'Oct 8, 2012',
        title: 'The 1 Million Teamtage',
        blurb: '12.1 million views. Still the biggest video FaZe has ever made.',
        kind: 'content',
        source: 'FaZe Clan YouTube',
        sourceLinks: [{"label": "FaZe Clan YouTube", "url": "https://www.youtube.com/watch?v=CBM-NZdWyk4"}],
      },
      {
        id: 'bo2',
        date: 'Nov 2012',
        title: 'FaZe owns Black Ops 2',
        blurb: 'Pamaj’s sniper montage hits 8M and Apex lands the first BO2 trickshot killcam — all within 48 hours of launch.',
        kind: 'content',
        source: 'FaZe Clan YouTube',
        sourceLinks: [{"label": "FaZe Clan YouTube", "url": "https://www.youtube.com/watch?v=r5hZ7K11ldg"}],
      },
      {
        id: 'rug',
        date: 'Jan 2013',
        title: 'FaZe Rug joins',
        blurb: 'The future face of FaZe on YouTube, and a 13-year run.',
        kind: 'people',
        source: 'Wikipedia',
        sourceLinks: [{"label": "Wikipedia", "url": "https://en.wikipedia.org/wiki/FaZe_Rug"}],
      },
      {
        id: 'faze5-2013',
        date: '2013',
        title: '#FAZE5 and the OpTic rivalry',
        blurb: 'Fans earn roster spots by sending clips — and FaZe meets OpTic for the first time, starting CoD’s defining rivalry.',
        kind: 'esports',
        source: 'FaZe Clan YouTube · Dot Esports',
        sourceLinks: [{"label": "FaZe Clan YouTube", "url": "https://www.youtube.com/watch?v=ZNEyvdELj8U"}, {"label": "Dot Esports", "url": "https://dotesports.com/call-of-duty/news/optic-gaming-vs-faze-clan-call-of-duty-11056"}],
      },
    ],
  },
  {
    id: 'era-3',
    num: '03',
    years: '2014–17',
    title: 'Channel to culture',
    tagline: 'The first FaZe house, trophies off OpTic, and a Counter-Strike superteam.',
    events: [
      {
        id: 'plainview',
        date: '2014',
        title: 'The first FaZe house',
        blurb: 'Plainview, New York. A trickshot channel becomes a lifestyle brand.',
        kind: 'culture',
        source: 'Wikipedia',
        sourceLinks: [{"label": "Wikipedia", "url": "https://en.wikipedia.org/wiki/FaZe_Clan"}],
      },
      {
        id: 'optic-double',
        date: 'Aug–Sep 2015',
        title: 'Two trophies, both off OpTic',
        blurb: 'Gfinity Summer Championship 4–3, then MLG Pro League 4–1. The rivalry becomes finals.',
        kind: 'trophy',
        source: 'Liquipedia',
        sourceLinks: [{"label": "Liquipedia", "url": "https://liquipedia.net/callofduty/FaZe_Clan"}],
      },
      {
        id: 'superteam',
        date: '2016–17',
        title: 'The Counter-Strike superteam',
        blurb: 'FaZe buys into CS, then signs NiKo, GuardiaN and olofmeister next to rain and karrigan.',
        kind: 'esports',
        source: 'Liquipedia · HLTV',
        sourceLinks: [{"label": "Liquipedia", "url": "https://liquipedia.net/counterstrike/FaZe_Clan/History"}, {"label": "HLTV", "url": "https://www.hltv.org/news/19821/faze-secure-the-services-of-niko"}],
      },
      {
        id: 'eleague',
        date: 'Oct 2017',
        title: 'ELEAGUE Premier champions',
        blurb: 'Astralis beaten 2–0 for $500K. FaZe is now a Counter-Strike power.',
        kind: 'trophy',
        source: 'Wikipedia',
        sourceLinks: [{"label": "Wikipedia", "url": "https://en.wikipedia.org/wiki/FaZe_Clan"}],
      },
    ],
  },
  {
    id: 'era-4',
    num: '04',
    years: '2018–20',
    title: 'Going mainstream',
    tagline: 'Fortnite, Hollywood mansions, and crowds big enough to shut down New York.',
    events: [
      {
        id: 'r6',
        date: 'Jan 2018',
        title: 'Into Rainbow Six',
        blurb: 'FaZe signs Brazil’s Team Fontt — the branch that would one day carry two stars.',
        kind: 'esports',
        source: 'PCGamesN',
        sourceLinks: [{"label": "PCGamesN", "url": "https://www.pcgamesn.com/rainbow-six-siege/rainbow-six-siege-faze-clan-team-fontt-six-invitational"}],
      },
      {
        id: 'tfue',
        date: 'Apr 2018',
        title: 'Tfue joins FaZe',
        blurb: 'Fortnite’s rising star becomes the biggest streamer on the roster.',
        kind: 'people',
        source: 'Wikipedia',
        sourceLinks: [{"label": "Wikipedia", "url": "https://en.wikipedia.org/wiki/Tfue"}],
      },
      {
        id: 'lawsuit',
        date: 'May 2019',
        title: 'Tfue sues FaZe',
        blurb: 'Its biggest streamer calls his contract “grossly oppressive.” FaZe countersues, and esports’ first big player-contract fight settles in 2020.',
        kind: 'setback',
        source: 'Forbes · ESPN',
        sourceLinks: [{"label": "Forbes", "url": "https://www.forbes.com/sites/davidthier/2019/05/21/tfue-is-suing-faze-clan-in-an-explosive-lawsuit-thats-rocking-the-esports-world/"}, {"label": "ESPN", "url": "https://www.espn.com/gaming/story/_/id/27304886/faze-countersues-tfue-files-suit-new-york"}],
      },
      {
        id: 'nyc',
        date: 'Jul 2019',
        title: 'FaZe shuts down New York',
        blurb: '10,000+ fans line up for a pop-up during the Fortnite World Cup and the NYPD has to close it. Gaming’s first rockstar crowd.',
        kind: 'culture',
        source: 'Newsweek',
        sourceLinks: [{"label": "Newsweek", "url": "https://www.newsweek.com/faze-clan-pop-store-fortnite-tfue-1452227"}],
      },
      {
        id: 'billion',
        date: '2019–20',
        title: 'Bigger than the Yankees',
        blurb: 'Forbes ranks FaZe #4 in esports, with more social followers than the Cowboys and Yankees combined. The channel passes a billion views.',
        kind: 'culture',
        source: 'Forbes',
        sourceLinks: [{"label": "Forbes", "url": "https://www.forbes.com/sites/christinasettimi/2019/11/05/awful-business-or-the-new-gold-rush-the-most-valuable-companies-in-esports-are-surging/"}],
      },
    ],
  },
  {
    id: 'era-5',
    num: '05',
    years: '2021–23',
    title: 'Champions of the world',
    tagline: 'Magazine covers, Nasdaq, and the first three stars.',
    events: [
      {
        id: 'si-cover',
        date: 'Jun 2021',
        title: 'The Sports Illustrated cover',
        blurb: 'The first esports org ever on the cover: Nickmercs, Swagg, Rug and Temperrr next to Kyler Murray and Bronny James.',
        kind: 'culture',
        source: 'Businesswire',
        sourceLinks: [{"label": "Businesswire", "url": "https://www.businesswire.com/news/home/20210610005834/en/FaZe-Clan-Reaches-Beyond-World-of-Esports-Onto-Cover-of-Sports-Illustrated%E2%80%99s-July-Issue"}],
      },
      {
        id: 'save-the-kids',
        date: 'Jul 2021',
        title: 'Save the Kids',
        blurb: 'Members promote a crypto token that crashes within days. FaZe fires Kay and suspends three others.',
        kind: 'setback',
        source: 'CoinDesk',
        sourceLinks: [{"label": "CoinDesk", "url": "https://www.coindesk.com/markets/2021/07/02/esports-organization-faze-clan-drops-1-member-suspends-3-following-alleged-crypto-scam"}],
      },
      {
        id: 'cdl-2021',
        date: 'Aug 22, 2021',
        title: 'Call of Duty world champions',
        blurb: 'Atlanta FaZe win the CDL Championship — a world title in the game where it all started.',
        kind: 'trophy',
        star: 1,
        source: 'Dot Esports',
        sourceLinks: [{"label": "Dot Esports", "url": "https://dotesports.com/call-of-duty/news/atlanta-faze-win-cod-champs-2021"}],
      },
      {
        id: 'antwerp',
        date: 'May 22, 2022',
        title: 'Counter-Strike Major champions',
        blurb: 'PGL Antwerp, 2–0 over NAVI — the first mixed-nationality roster ever to win a Major. HLTV’s Team of the Year.',
        more: 'The same run takes Katowice, Pro League and Cologne, then the Intel Grand Slam in 2023.',
        kind: 'trophy',
        star: 2,
        source: 'HLTV',
        sourceLinks: [{"label": "HLTV", "url": "https://www.hltv.org/news/33882/faze-defeat-navi-2-0-to-win-pgl-major-antwerp"}],
      },
      {
        id: 'nasdaq',
        date: 'Jul 2022',
        title: '$FAZE hits Nasdaq',
        blurb: 'A trickshot crew from Long Island goes public, listed next to the biggest companies in the world.',
        kind: 'culture',
        source: 'CNBC',
        sourceLinks: [{"label": "CNBC", "url": "https://www.cnbc.com/2022/07/20/faze-clan-goes-public-in-725-million-spac-a-deal-for-creator-economy.html"}],
      },
      {
        id: 'crash',
        date: '2022–23',
        title: 'From $1B to under $1',
        blurb: 'Shares unlock, the stock collapses, layoffs follow and the CEO is fired. Then GameSquare buys FaZe for ~$17M and the founders take back the wheel.',
        kind: 'setback',
        source: 'Kotaku · Bloomberg',
        sourceLinks: [{"label": "Kotaku", "url": "https://kotaku.com/faze-clan-stock-rain-apex-banks-rug-swagg-esports-1850268478"}, {"label": "Bloomberg", "url": "https://www.bloomberg.com/news/articles/2023-10-20/faze-clan-is-being-acquired-by-a-company-backed-by-jerry-jones"}],
      },
      {
        id: 'halo',
        date: 'Oct 15, 2023',
        title: 'Halo world champions',
        blurb: 'Through the lower bracket, then a 4–0 sweep of OpTic in the final.',
        kind: 'trophy',
        star: 3,
        source: 'Halo Waypoint',
        sourceLinks: [{"label": "Halo Waypoint", "url": "https://www.halowaypoint.com/news/halowc2023"}],
      },
    ],
  },
  {
    id: 'era-6',
    num: '06',
    years: '2024–26',
    title: 'A crest full of stars',
    tagline: 'The founders back in charge, and the most decorated run in FaZe history.',
    events: [
      {
        id: 'founding-fathers',
        date: 'May 30, 2024',
        title: 'The Founding Fathers LAN',
        blurb: 'FaZe, OpTic and 100 Thieves back on Xbox 360s — fourteen years to the day after the first upload.',
        kind: 'content',
        source: 'Dexerto',
        sourceLinks: [{"label": "Dexerto", "url": "https://www.dexerto.com/call-of-duty/faze-banks-humiliates-nadeshot-in-rust-sniping-1v1-final-result-2752701/"}],
      },
      {
        id: 'si-2025',
        date: 'Feb 2025',
        title: 'Six Invitational champions',
        blurb: 'Down 0–2, then five straight elimination wins to take Rainbow Six’s world title.',
        kind: 'trophy',
        star: 4,
        source: 'EsportsInsider',
        sourceLinks: [{"label": "EsportsInsider", "url": "https://esportsinsider.com/2025/02/faze-clan-r6-six-invitational-2025-champions"}],
      },
      {
        id: 'exodus',
        date: 'Dec 2025',
        title: 'The Christmas exodus',
        blurb: 'Adapt, Rug, Apex, Swagg and more walk out in four days after stalled contract talks — the biggest roster exit in FaZe history. Esports, run separately, keeps winning.',
        kind: 'setback',
        source: 'Tubefilter · Dexerto',
        sourceLinks: [{"label": "Tubefilter", "url": "https://www.tubefilter.com/2025/12/27/faze-clan-creators-quit-contract-terms/"}, {"label": "Dexerto", "url": "https://www.dexerto.com/entertainment/whats-happened-to-faze-members-suddenly-quit-faze-clan-lacy-silky-adapt-and-more-3298059/"}],
      },
      {
        id: 'si-2026',
        date: 'Feb 2026',
        title: 'Back-to-back',
        blurb: 'The first org ever to defend the Six Invitational. A fifth star goes on the crest the next day.',
        kind: 'trophy',
        star: 5,
        source: 'Gamereactor',
        sourceLinks: [{"label": "Gamereactor", "url": "https://www.gamereactor.eu/faze-clan-crowned-six-invitational-2026-champions-1675483/"}],
      },
      {
        id: 'cdl-2026',
        date: 'Jul 2026',
        title: 'FaZe Vegas win the CDL',
        blurb: '5–2 over OpTic Texas for a second Call of Duty League title. The rivalry is still FaZe’s.',
        kind: 'trophy',
        source: 'Liquipedia',
        sourceLinks: [{"label": "Liquipedia", "url": "https://liquipedia.net/callofduty/FaZe_Vegas"}],
      },
      {
        id: 'ewc-2026',
        date: 'Aug 2026',
        title: 'The R6 triple crown',
        blurb: 'Esports World Cup champions. Major, Six Invitational and EWC — a sweep no org had ever held.',
        kind: 'trophy',
        source: 'GameSquare IR',
        sourceLinks: [{"label": "GameSquare IR", "url": "https://investors.gamesquare.com/news/news-details/2026/FaZe-Esports-a-GameSquare-Company-Wins-Rainbow-Six-Championship-at-2026-Esports-World-Cup/default.aspx"}],
      },
    ],
  },
];

/** Guided paths, walked oldest -> newest. */
const PATH_IDS: Record<PathId, string[]> = {
  returning: ['temperrr', 'our-war', 'community-montage', '1m-teamtage', 'bo2', 'faze5-2013', 'plainview', 'optic-double', 'nyc', 'founding-fathers'],
  new: ['founded', '1m-teamtage', 'rug', 'superteam', 'tfue', 'nyc', 'si-cover', 'cdl-2021', 'antwerp', 'crash', 'exodus', 'si-2026'],
};

for (const era of ERAS)
  for (const ev of era.events)
    ev.paths = (Object.keys(PATH_IDS) as PathId[]).filter((p) => PATH_IDS[p].includes(ev.id));

export const ALL_EVENTS: TimelineEvent[] = ERAS.flatMap((e) => e.events);

/** Crest stars: one per world championship. */
export const STARS: { n: number; label: string; event: string }[] = [
  { n: 1, label: 'CDL Championship 2021', event: 'cdl-2021' },
  { n: 2, label: 'PGL Major Antwerp 2022', event: 'antwerp' },
  { n: 3, label: 'Halo World Championship 2023', event: 'halo' },
  { n: 4, label: 'Six Invitational 2025', event: 'si-2025' },
  { n: 5, label: 'Six Invitational 2026', event: 'si-2026' },
];

export type Limb = 'esports' | 'content' | 'culture';

/** What FaZe branched into: drawn as the canopy tips. */
export const CANOPY: { label: string; year: number; limb: Limb }[] = [
  { label: 'Call of Duty', year: 2013, limb: 'esports' },
  { label: 'Counter-Strike', year: 2016, limb: 'esports' },
  { label: 'PUBG', year: 2017, limb: 'esports' },
  { label: 'Rainbow Six', year: 2018, limb: 'esports' },
  { label: 'Fortnite', year: 2018, limb: 'esports' },
  { label: 'Valorant', year: 2020, limb: 'esports' },
  { label: 'Halo', year: 2021, limb: 'esports' },
  { label: 'Warzone', year: 2026, limb: 'esports' },
  { label: 'Trickshots', year: 2010, limb: 'content' },
  { label: 'Teamtages', year: 2010, limb: 'content' },
  { label: '#FAZE5', year: 2013, limb: 'content' },
  { label: 'Vlogs', year: 2014, limb: 'content' },
  { label: 'Twitch', year: 2018, limb: 'content' },
  { label: 'Subathons', year: 2024, limb: 'content' },
  { label: 'G FUEL', year: 2012, limb: 'culture' },
  { label: 'Champion', year: 2018, limb: 'culture' },
  { label: 'Man City', year: 2019, limb: 'culture' },
  { label: 'NFL', year: 2020, limb: 'culture' },
  { label: 'Sports Illustrated', year: 2021, limb: 'culture' },
  { label: "McDonald's", year: 2021, limb: 'culture' },
  { label: 'Snoop Dogg', year: 2022, limb: 'culture' },
  { label: 'Nasdaq', year: 2022, limb: 'culture' },
];

export const LIMB_LABEL: Record<Limb, string> = {
  esports: 'Esports',
  content: 'Content',
  culture: 'Culture',
};

/** Roots: the people everything grew from. */
export const ROOTS: { label: string; note: string; main?: boolean }[] = [
  { label: 'ClipZ', note: 'co-founder', main: true },
  { label: 'House Cat', note: 'co-founder', main: true },
  { label: 'Resistance', note: 'co-founder', main: true },
  { label: 'Temperrr', note: '2010' },
  { label: 'Fakie', note: '2011' },
  { label: 'Apex', note: '2011' },
  { label: 'Spratt', note: '2011' },
  { label: 'Ramos', note: '2011' },
  { label: 'Pamaj', note: '2012' },
  { label: 'Rain', note: '2012' },
];

/**
 * Careers that grew on the tree. Photo order: /creators/<id>.webp if someone drops a cutout in web/public,
 * else the public avatar via unavatar.io, else a monogram.
 */
export const FALLEN: { id: string; name: string; from: number; to: number; known: string; avatar?: string; photo?: string }[] = [
  { id: 'apex', name: 'Apex', from: 2011, to: 2025, known: 'Joined at 14, became COO', avatar: 'x/FaZeApex' },
  { id: 'rain', name: 'Rain', from: 2012, to: 2024, known: 'King of the solo montage' },
  { id: 'rug', name: 'Rug', from: 2013, to: 2025, known: 'FaZe’s biggest YouTuber', avatar: 'x/FaZeRug' },
  { id: 'adapt', name: 'Adapt', from: 2014, to: 2025, known: '#FAZE5 pick to 1M on Twitch', avatar: 'twitch/adapt' },
  { id: 'jev', name: 'Jev', from: 2014, to: 2026, known: '5.4M subscribers', avatar: 'youtube/FaZeJev' },
  { id: 'cloakzy', name: 'Cloakzy', from: 2017, to: 2021, known: 'Fortnite-era fan favorite', avatar: 'twitch/cloakzy' },
  { id: 'tfue', name: 'Tfue', from: 2018, to: 2020, known: 'Fortnite’s biggest streamer', avatar: 'twitch/tfue' },
  { id: 'swagg', name: 'Swagg', from: 2020, to: 2025, known: 'Warzone and the Nuke Squad', avatar: 'twitch/swagg' },
  { id: 'scope', name: 'Scope', from: 2020, to: 2025, known: 'FaZe5 winner, elite sniper', avatar: 'youtube/FaZeScope' },
  { id: 'lacy', name: 'Lacy', from: 2024, to: 2025, known: 'Reboot-class streamer', avatar: 'twitch/lacy' },
  { id: 'jasontheween', name: 'JasonTheWeen', from: 2024, to: 2025, known: 'Reboot-class streamer', avatar: 'twitch/jasontheween' },
  { id: 'silky', name: 'Silky', from: 2024, to: 2025, known: 'Reboot-class streamer', avatar: 'twitch/silky' },
];
