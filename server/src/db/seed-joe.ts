// Joe's demo seed: a crowd of everyday fans so leaderboards fill a real top 20, plus meme/anime
// profile pictures for everyone (files live in web/public/avatars, so no external image calls).
// Additive and idempotent: only touches the handles listed here. Fans only have ELO + follower
// history (no K/D, HS%, matches), so none of them can trip the scouting rules.
import type { Pool } from 'pg';

type Fan = {
  handle: string;
  name: string;
  elo: number;
  /** ELO gained over the last ~4 weeks (Most improved) */
  gain: number;
  region: string;
  bio: string;
  avatar: string;
  /** follower history for Creator growth: [platform, 4 weeks ago, today] */
  social?: [platform: 'youtube' | 'twitch', from: number, to: number];
};

const FANS: Fan[] = [
  { handle: 'notasmurf', name: 'definitely not a smurf', elo: 2950, gain: 410, region: 'EU', bio: 'First account. Promise.', avatar: 'meme-evilkermit.jpg' },
  { handle: 'awper_hand', name: 'AWPer Hand', elo: 2705, gain: 120, region: 'NA', bio: 'One shot, one kill, one coffee.', avatar: 'anime-kaito.svg', social: ['youtube', 3200, 4100] },
  { handle: 'headclicker99', name: 'HeadClicker99', elo: 2480, gain: 95, region: 'NA', bio: 'Crosshair placement is a lifestyle.', avatar: 'meme-gru.jpg', social: ['twitch', 860, 1290] },
  { handle: 'xx_n0sc0p3_xx', name: 'xX_N0Sc0p3_Xx', elo: 2310, gain: 180, region: 'NA', bio: 'Trickshot era never ended for me.', avatar: 'meme-cheems.jpg', social: ['youtube', 15400, 16100] },
  { handle: 'twistzz_fan_acc', name: 'twistzz fan acc', elo: 2140, gain: 60, region: 'NA', bio: 'Copying his settings did not make me Twistzz.', avatar: 'anime-haru.svg', social: ['twitch', 410, 980] },
  { handle: 'tryhard_tyler', name: 'TryHard Tyler', elo: 2055, gain: 230, region: 'NA', bio: 'Practice mode 6 hours a day.', avatar: 'meme-kalm.jpg' },
  { handle: 'flashbang_fiona', name: 'Flashbang Fiona', elo: 1940, gain: 145, region: 'EU', bio: 'Pop flash specialist. Sorry in advance.', avatar: 'anime-yuki.svg', social: ['youtube', 2200, 3050] },
  { handle: 'rushb_nostop', name: 'RUSH B NO STOP', elo: 1880, gain: -40, region: 'EU', bio: 'Strategy is overrated.', avatar: 'meme-panik.jpg' },
  { handle: 'lurkgod', name: 'lurkgod', elo: 1795, gain: 75, region: 'EU', bio: 'You will not hear me coming.', avatar: 'anime-nao.svg' },
  { handle: 'faze_wannabe2009', name: 'FaZe Wannabe 2009', elo: 1720, gain: 260, region: 'NA', bio: 'Been sending montages since 2012. Still waiting.', avatar: 'meme-thisisfine.jpg', social: ['youtube', 640, 1450] },
  { handle: 'spray_n_pray', name: 'Spray n Pray', elo: 1610, gain: 30, region: 'SA', bio: 'Recoil control? Never met her.', avatar: 'meme-spongebob.jpg' },
  { handle: 'im_not_tilted', name: 'im not tilted', elo: 1540, gain: -85, region: 'NA', bio: 'I am fine. This is fine.', avatar: 'meme-thisisfine.jpg', social: ['twitch', 120, 135] },
  { handle: 'decoy_dan', name: 'Decoy Dan', elo: 1475, gain: 55, region: 'OCE', bio: 'Throwing decoys since 2014.', avatar: 'meme-monkey.jpg' },
  { handle: 'eco_round_enjoyer', name: 'eco round enjoyer', elo: 1390, gain: 110, region: 'EU', bio: 'P250 and a dream.', avatar: 'anime-sakura.svg', social: ['youtube', 90, 410] },
  { handle: 'knife_only_kyle', name: 'Knife Only Kyle', elo: 1320, gain: 15, region: 'NA', bio: 'Guns are for people who miss.', avatar: 'meme-pikachu.jpg' },
  { handle: 'gamer_mike', name: 'Mike', elo: 1260, gain: 70, region: 'NA', bio: 'Just a guy who likes CS.', avatar: 'anime-akira.svg' },
  { handle: 'silver_forever', name: 'Silver Forever', elo: 1185, gain: 140, region: 'EU', bio: 'Climbing. Slowly. Very slowly.', avatar: 'meme-kermit.jpg' },
  { handle: 'mom_says_dinner', name: 'mom says dinner in 5', elo: 1120, gain: 35, region: 'NA', bio: 'Have to go after this round.', avatar: 'meme-smudge.jpg', social: ['twitch', 45, 60] },
  { handle: 'alex2011', name: 'alex', elo: 1060, gain: 90, region: 'EU', bio: 'hi', avatar: 'anime-rin.svg' },
  { handle: 'chicken_killer', name: 'ChickenKiller', elo: 990, gain: -20, region: 'SA', bio: 'Every chicken on Inferno knows my name.', avatar: 'meme-pooh.jpg' },
  { handle: 'bot_kevin', name: 'Bot Kevin', elo: 940, gain: 160, region: 'NA', bio: 'Named after my aim.', avatar: 'meme-buffdoge.jpg' },
  { handle: 'just_sam', name: 'Sam', elo: 905, gain: 45, region: 'EU', bio: 'New here. FaZe since Antwerp.', avatar: 'anime-mika.svg' },
];

/** Profile pictures for the existing demo accounts (handles owned by Yao/Dahiya's seeds). */
const EXISTING_AVATARS: Record<string, string> = {
  drift: 'anime-akira.svg',
  faze_admin: 'anime-kenji.svg',
  faze_recruiter: 'anime-mika.svg',
  iofd: 'meme-smudge.jpg',
  kairo: 'meme-buffdoge.jpg',
  mochi: 'anime-sakura.svg',
  new_fan: 'meme-pikachu.jpg',
  nyx: 'anime-hikari.svg',
  og_fan: 'meme-pooh.jpg',
  pixel: 'anime-rin.svg',
  rook: 'meme-kermit.jpg',
  tamed: 'anime-sora.svg',
  tempo: 'meme-monkey.jpg',
  vyper: 'anime-ren.svg',
};

const level = (elo: number) =>
  elo > 2000 ? 10 : elo > 1750 ? 9 : elo > 1530 ? 8 : elo > 1350 ? 7 : elo > 1200 ? 6 : elo > 1050 ? 5 : elo > 900 ? 4 : 3;

export async function seedJoe(db: Pool) {
  const handles = FANS.map((f) => f.handle);
  await db.query(`DELETE FROM users WHERE handle = ANY($1::text[])`, [handles]); // cascades stats + accounts

  for (const [i, f] of FANS.entries()) {
    const {
      rows: [u],
    } = await db.query<{ id: string }>(
      `INSERT INTO users (handle, display_name, role, avatar_url, bio, created_at)
       VALUES ($1, $2, 'user', $3, $4, now() - make_interval(days => $5)) RETURNING id`,
      [f.handle, f.name, `/avatars/${f.avatar}`, f.bio, 30 + i * 9],
    );
    await db.query(
      `INSERT INTO game_accounts (user_id, game, faceit_nickname, region, faceit_level, faceit_elo) VALUES ($1, 'cs2', $2, $3, $4, $5)`,
      [u.id, f.handle, f.region, level(f.elo), f.elo],
    );
    // ELO history: 4 points across the last 4 weeks ending at today's ELO (feeds "Most improved")
    const pts = [27, 18, 9, 1].map((d, k) => [d, Math.round(f.elo - f.gain + (f.gain * k) / 3)] as const);
    await db.query(
      `INSERT INTO player_stats (time, user_id, game, metric, value)
       SELECT now() - make_interval(days => d), $1, 'cs2', 'elo', v FROM unnest($2::int[], $3::float8[]) AS t(d, v)`,
      [u.id, pts.map((p) => p[0]), pts.map((p) => p[1])],
    );
    if (f.social) {
      const [platform, from, to] = f.social;
      await db.query(`INSERT INTO social_accounts (user_id, platform, handle) VALUES ($1, $2, $3)`, [u.id, platform, f.handle]);
      await db.query(
        `INSERT INTO social_stats (time, user_id, platform, followers, views)
         SELECT now() - make_interval(days => d), $1, $2, fol, fol * 12 FROM unnest($3::int[], $4::bigint[]) AS t(d, fol)`,
        [u.id, platform, [27, 14, 1], [from, Math.round((from + to) / 2), to]],
      );
    }
  }

  // profile pictures for everyone else (only replaces empty, generated, or earlier local avatars)
  for (const [handle, file] of Object.entries(EXISTING_AVATARS)) {
    await db.query(
      `UPDATE users SET avatar_url = $2 WHERE handle = $1
         AND (avatar_url IS NULL OR avatar_url LIKE 'https://api.dicebear.com/%' OR avatar_url LIKE '/avatars/%')`,
      [handle, `/avatars/${file}`],
    );
  }
  console.log(`✓ joe: ${FANS.length} leaderboard fans + avatars`);
}
