// Fan-hub demo content (V3, drafted by Yao for Phase 1). Called from seed.ts after seedCommunity.
// Gives every board believable activity: backdated threads, nested comments and real votes, so
// hot/new/top sorting, Pulse and the Home community strip have something to show.
// Safe to re-run: it removes only the threads it created (matched by title) before inserting.
// All discussions are seeded demo content; history references are well-known public FaZe milestones.
import type { Db } from '../lib/yao-deps.js';

interface SeedComment { by: string; body: string; hoursAfter: number; up?: string[]; replies?: SeedComment[] }
interface SeedThread { board: string; by: string; title: string; body: string; hoursAgo: number; up: string[]; down?: string[]; comments?: SeedComment[] }

const THREADS: SeedThread[] = [
  // ---------- FaZe CS2 ----------
  {
    board: 'faze-cs2', by: 'og_fan', hoursAgo: 5, title: 'Match thread energy: who is your MVP pick tonight?',
    body: 'Calling it now: the AWP is going to decide this one. Drop your MVP pick and one round you think swings the series.',
    up: ['kairo', 'nyx', 'vyper', 'drift', 'mochi', 'tempo', 'new_fan'],
    comments: [
      { by: 'kairo', hoursAfter: 0.5, body: 'Twistzz on the entry. When his opening duels land the whole T side opens up.', up: ['vyper', 'nyx', 'og_fan'],
        replies: [{ by: 'vyper', hoursAfter: 0.8, body: 'Agree, but watch the mid-round calls. That is where FaZe have been winning close maps.', up: ['kairo'] }] },
      { by: 'new_fan', hoursAfter: 1.2, body: 'First match I am watching live with the lights synced. Hype.', up: ['og_fan', 'tempo'] },
      { by: 'drift', hoursAfter: 2, body: 'Pistol rounds. Win both and it is over early.', up: ['mochi'] },
    ],
  },
  {
    board: 'faze-cs2', by: 'nyx', hoursAgo: 20, title: 'Mirage A executes: smoke the stairs or flash over palace?',
    body: 'Seen both work this week. Stairs smoke buys the walk-out, palace flash wins the duel. What do you run in pugs?',
    up: ['vyper', 'kairo', 'rook', 'pixel'],
    comments: [
      { by: 'vyper', hoursAfter: 1, body: 'Both. Stairs smoke first, palace pop-flash 2 seconds later. Timing is everything.', up: ['nyx', 'rook'] },
      { by: 'pixel', hoursAfter: 3, body: 'Level 5 here, we just run in and pray. Saving this.', up: ['og_fan'] },
    ],
  },
  {
    board: 'faze-cs2', by: 'mochi', hoursAgo: 46, title: 'Best FaZe CS roster of all time? Make your case',
    body: 'Rules: one roster, one sentence. Go.',
    up: ['og_fan', 'kairo', 'drift', 'tempo', 'new_fan', 'rook'], down: ['pixel'],
    comments: [
      { by: 'og_fan', hoursAfter: 0.4, body: 'The 2022 Antwerp Major lineup. Trophy talks.', up: ['kairo', 'mochi', 'drift', 'tempo'],
        replies: [
          { by: 'tempo', hoursAfter: 1, body: 'The 2017 superteam had more firepower on paper though.', up: ['mochi'] },
          { by: 'og_fan', hoursAfter: 1.5, body: 'On paper. Antwerp is in the trophy cabinet.', up: ['kairo', 'nyx'] },
        ] },
      { by: 'new_fan', hoursAfter: 4, body: 'New here. Where do I watch old matches?', up: [],
        replies: [{ by: 'mochi', hoursAfter: 5, body: 'FaZe History board has the timeline threads. Start there.', up: ['new_fan'] }] },
    ],
  },
  // ---------- FaZe History ----------
  {
    board: 'faze-history', by: 'og_fan', hoursAgo: 30, title: 'The sniping montage era: what was your first FaZe video?',
    body: 'FaZe started in 2010 as a Call of Duty trickshot crew on YouTube. Mine was an ILLCAMS episode on a school laptop. Yours?',
    up: ['mochi', 'drift', 'new_fan', 'tempo', 'kairo'],
    comments: [
      { by: 'drift', hoursAfter: 1, body: 'ILLCAMS. Watched every episode twice. The editing was ahead of its time.', up: ['og_fan', 'mochi'] },
      { by: 'new_fan', hoursAfter: 2, body: 'Never saw these. Going down the rabbit hole tonight.', up: ['og_fan'],
        replies: [{ by: 'og_fan', hoursAfter: 2.5, body: 'Welcome to the family. FaZe Guessr is going to be a nightmare for you, then a dream.', up: ['new_fan', 'drift'] }] },
    ],
  },
  {
    board: 'faze-history', by: 'tempo', hoursAgo: 70, title: '#FaZe5: 211,000+ applicants in 2020. Did anyone here apply?',
    body: 'The 2020 #FaZe5 challenge pulled over 211k applicants. Curious who in here sent a clip.',
    up: ['og_fan', 'vyper', 'nyx'],
    comments: [
      { by: 'vyper', hoursAfter: 2, body: 'Sent a CS clip. Did not make it. Still grinding FACEIT.', up: ['tempo', 'kairo', 'nyx'] },
    ],
  },
  {
    board: 'faze-history', by: 'kairo', hoursAgo: 96, title: '2022: the Antwerp Major run, round by round memories',
    body: 'FaZe lifted the PGL Major in Antwerp in 2022. What is the one round you still think about?',
    up: ['og_fan', 'mochi', 'drift', 'rook'],
    comments: [
      { by: 'mochi', hoursAfter: 3, body: 'The crowd noise alone. Best atmosphere I have heard on a stream.', up: ['kairo'] },
    ],
  },
  // ---------- Events ----------
  {
    board: 'events', by: 'og_fan', hoursAgo: 3, title: 'Watch party: lights red on every round win',
    body: 'Hosting a watch-along tonight. Bring your predictions. If you have RGB Sync running, post a pic of your setup when FaZe takes a round.',
    up: ['new_fan', 'kairo', 'tempo', 'mochi', 'pixel'],
    comments: [
      { by: 'pixel', hoursAfter: 0.3, body: 'Predicting 13-9 on the first map.', up: ['og_fan'] },
      { by: 'kairo', hoursAfter: 0.6, body: 'Keyboard and desk lamp synced. Ready.', up: ['og_fan', 'new_fan', 'tempo'] },
    ],
  },
  {
    board: 'events', by: 'drift', hoursAgo: 28, title: 'Post-match desk: which call won the decider?',
    body: 'Rewatching the last map. The force-buy at 10-10 looked crazy live but it worked. Was it the right call?',
    up: ['vyper', 'nyx'],
    comments: [
      { by: 'nyx', hoursAfter: 1, body: 'Right call. Their economy was broken too, and FaZe had the utility advantage.', up: ['drift', 'vyper'] },
    ],
  },
  // ---------- Clips ----------
  {
    board: 'clips', by: 'vyper', hoursAgo: 9, title: '1v3 clutch on A site, Mirage. Rate it',
    body: 'Last round of the half. Played off the bomb and waited for them to come to me. Be honest.',
    up: ['kairo', 'nyx', 'og_fan', 'drift', 'mochi', 'tempo', 'rook', 'new_fan'],
    comments: [
      { by: 'kairo', hoursAfter: 0.5, body: 'Patience on the defuse fake was the whole clip. 9/10.', up: ['vyper', 'nyx'] },
      { by: 'rook', hoursAfter: 2, body: 'How are you this calm at 1v3', up: ['vyper'] },
    ],
  },
  {
    board: 'clips', by: 'pixel', hoursAgo: 40, title: 'My first FACEIT ace (Ancient)',
    body: 'Level 5 and I finally hit one. Not clean, but it counts.',
    up: ['og_fan', 'new_fan', 'tempo', 'mochi'],
    comments: [
      { by: 'og_fan', hoursAfter: 1, body: 'An ace is an ace. FAZE UP.', up: ['pixel', 'new_fan'] },
    ],
  },
  // ---------- Talent Watch ----------
  {
    board: 'talent-watch', by: 'mochi', hoursAgo: 15, title: 'Who is the most improved player on the leaderboards this month?',
    body: 'The improvement board has some wild ELO gains. Fan discussion only, not an official FaZe scouting pick.',
    up: ['tempo', 'drift'],
    comments: [
      { by: 'tempo', hoursAfter: 1, body: 'Vyper has been on a heater. Consistency is the scary part.', up: ['mochi', 'vyper'] },
    ],
  },
];

export async function seedFanHub(db: Db) {
  const users = await db.query<{ id: string; handle: string }>(`SELECT id, handle FROM users WHERE role = 'user'`);
  const idOf = new Map(users.rows.map((u) => [u.handle, u.id]));
  const boards = await db.query<{ id: string; slug: string }>(`SELECT id, slug FROM communities`);
  const boardId = new Map(boards.rows.map((b) => [b.slug, b.id]));

  await db.query(`DELETE FROM threads WHERE title = ANY($1::text[])`, [THREADS.map((t) => t.title)]);

  let threads = 0, comments = 0, votes = 0;
  const now = Date.now();
  for (const t of THREADS) {
    const author = idOf.get(t.by);
    const board = boardId.get(t.board);
    if (!author || !board) continue;
    const created = new Date(now - t.hoursAgo * 3600_000);
    const ups = t.up.filter((h) => idOf.has(h) && h !== t.by);
    const downs = (t.down ?? []).filter((h) => idOf.has(h) && h !== t.by);
    const { rows: [th] } = await db.query<{ id: string }>(
      `INSERT INTO threads (community_id, user_id, type, title, body, score, created_at) VALUES ($1, $2, 'post', $3, $4, $5, $6) RETURNING id`,
      [board, author, t.title, t.body, ups.length - downs.length, created],
    );
    threads++;
    for (const h of ups) { await db.query(`INSERT INTO votes (user_id, target_type, target_id, value) VALUES ($1, 'thread', $2, 1) ON CONFLICT DO NOTHING`, [idOf.get(h), th.id]); votes++; }
    for (const h of downs) { await db.query(`INSERT INTO votes (user_id, target_type, target_id, value) VALUES ($1, 'thread', $2, -1) ON CONFLICT DO NOTHING`, [idOf.get(h), th.id]); votes++; }

    const addComment = async (c: SeedComment, parent: string | null) => {
      const by = idOf.get(c.by);
      if (!by) return;
      const cUps = (c.up ?? []).filter((h) => idOf.has(h) && h !== c.by);
      const { rows: [cm] } = await db.query<{ id: string }>(
        `INSERT INTO comments (thread_id, parent_id, user_id, body, score, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [th.id, parent, by, c.body, cUps.length, new Date(created.getTime() + c.hoursAfter * 3600_000)],
      );
      comments++;
      for (const h of cUps) { await db.query(`INSERT INTO votes (user_id, target_type, target_id, value) VALUES ($1, 'comment', $2, 1) ON CONFLICT DO NOTHING`, [idOf.get(h), cm.id]); votes++; }
      for (const r of c.replies ?? []) await addComment(r, cm.id);
    };
    for (const c of t.comments ?? []) await addComment(c, null);
  }
  console.log(`✓ fan hub community (${threads} threads, ${comments} comments, ${votes} votes)`);
}
