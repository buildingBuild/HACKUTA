// FaZe Points seed (owner: Omar): the store catalog, plus ~12 weeks of challenge history for the Returning Fan.
// Economy: challenges pay at most ~565 points a week (most fans earn ~200-250), so a coaching session or
// premium merch takes a couple of months of regular play. Safe to re-run: the catalog is upserted
// (stock resets) and only og_fan's points rows are rewritten.
import type pg from 'pg';

const CATALOG = [
  { id: 'sticker-pack', kind: 'merch', name: 'Sticker pack', blurb: 'Six vinyl stickers: crest, stars and era logos.', cost: 500, stock: null, options: [], art: 'stickers', sort: 1 },
  { id: 'snapback', kind: 'merch', name: 'Classic snapback', blurb: 'Black snapback, red embroidered mark.', cost: 2500, stock: null, options: [], art: 'cap', sort: 2 },
  { id: 'tee', kind: 'merch', name: 'FaZe HQ tee', blurb: 'Heavyweight black tee.', cost: 3500, stock: null, options: ['S', 'M', 'L', 'XL'], art: 'tee', sort: 3 },
  { id: 'desk-mat', kind: 'merch', name: 'XL desk mat', blurb: '900 x 400 mm, stitched edges.', cost: 4500, stock: null, options: [], art: 'deskmat', sort: 4 },
  { id: 'hoodie', kind: 'merch', name: 'Founders hoodie', blurb: 'Limited drop. Five stars on the sleeve.', cost: 7500, stock: 25, options: ['S', 'M', 'L', 'XL'], art: 'hoodie', sort: 5 },
  { id: 'jersey', kind: 'merch', name: '2026 pro jersey', blurb: 'The jersey the roster wears. Ten made.', cost: 12000, stock: 10, options: ['S', 'M', 'L', 'XL'], art: 'jersey', sort: 6 },
  { id: 'vod-review', kind: 'coaching', name: 'VOD review', blurb: '30 minutes with a real coach going through one of your matches.', cost: 6000, stock: null, options: [], art: 'vod', sort: 10 },
  { id: 'coaching-1on1', kind: 'coaching', name: '1:1 coaching session', blurb: 'One hour, live, with a pro coach. Bring your demos.', cost: 10000, stock: null, options: [], art: 'coach', sort: 11 },
];

/** Deterministic "random" so the seeded history is the same every run. */
const pick = (n: number, salt: number) => ((Math.sin(n * 12.9898 + salt * 78.233) + 1) / 2) % 1;

export async function seedRewards(pool: pg.Pool) {
  for (const r of CATALOG) {
    await pool.query(
      `INSERT INTO rewards (id, kind, name, blurb, cost, stock, options, art, sort, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, true)
       ON CONFLICT (id) DO UPDATE SET kind = $2, name = $3, blurb = $4, cost = $5, stock = $6, options = $7::jsonb, art = $8, sort = $9, active = true`,
      [r.id, r.kind, r.name, r.blurb, r.cost, r.stock, JSON.stringify(r.options), r.art, r.sort],
    );
  }

  // Returning Fan: a regular in Community for ~12 weeks (comments and threads, no clips).
  const u = await pool.query(`SELECT id FROM users WHERE handle = 'og_fan'`);
  const id = u.rows[0]?.id;
  if (id) {
    await pool.query(`DELETE FROM point_events WHERE user_id = $1`, [id]);
    await pool.query(`DELETE FROM challenge_claims WHERE user_id = $1`, [id]);
    await pool.query(`DELETE FROM redemptions WHERE user_id = $1`, [id]);

    const rows: [number, string, string, number][] = [[50, 'bonus', 'Welcome to FaZe HQ', 85]]; // [delta, kind, reason, days ago]
    rows.push([2000, 'bonus', 'Day-one fan bonus (since the ILLCAMS days)', 84]); // seeded so the demo can afford one mid-tier item
    for (let day = 84; day >= 2; day--) {
      if (pick(day, 1) < 0.7) rows.push([10, 'challenge', 'Leave 3 comments', day]);
      if (pick(day, 2) < 0.3) rows.push([10, 'challenge', 'Start a thread', day]);
      if (day % 7 === 0) {
        rows.push([30, 'challenge', 'Leave 15 comments', day]);
        if (pick(day, 3) < 0.5) rows.push([30, 'challenge', 'Start 3 threads', day]);
      }
    }
    for (const [delta, kind, reason, ago] of rows) {
      await pool.query(
        `INSERT INTO point_events (time, user_id, delta, kind, reason) VALUES (now() - ($5 || ' days')::interval + interval '3 hours', $1, $2, $3, $4)`,
        [id, delta, kind, reason, String(ago)],
      );
    }
    // a sticker pack she already redeemed along the way
    const d = await pool.query(
      `INSERT INTO redemptions (user_id, reward_id, cost, status, created_at) VALUES ($1, 'sticker-pack', 500, 'fulfilled', now() - interval '30 days') RETURNING id`,
      [id],
    );
    await pool.query(
      `INSERT INTO point_events (time, user_id, delta, kind, reason, ref) VALUES (now() - interval '30 days', $1, -500, 'redeem', 'Redeemed: Sticker pack', $2)`,
      [id, String(d.rows[0].id)],
    );
  }
  console.log(`✓ rewards (${CATALOG.length} store items, og_fan 12-week points history)`);
}
