import { Router, type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

type Row = Record<string, any>;
interface Queryable { query(text: string, values?: unknown[]): Promise<{ rows: Row[] }> }
interface Client extends Queryable { release(): void }
export interface CommunityOptions {
  /** Pass the shared pg Pool. Omit only for explicitly labeled, volatile demo mode. */
  db?: Queryable & { connect(): Promise<Client> };
  /** Adapter for the team's shared login. Defaults to the MVP x-user-id header. */
  getUserId?: (req: Request) => string | undefined;
  demoUsers?: Row[];
  /** Existing Joe-owned clips only; this module never creates clip records. */
  demoClips?: Row[];
  /** Hook for a future shared moderation inbox; no schema changes required. */
  report?: (report: Row) => Promise<void>;
  blockedWords?: string[];
}
const boardSeeds = [
  ['faze-cs2', 'FaZe CS2', 'Round talk, utility ideas, and the global CS2 community.'],
  ['clips', 'Clips', 'Clutches, highlights, and the moments worth another look.'],
  ['talent-watch', 'Talent Watch', 'Discuss emerging CS2 players and creators.'],
  ['faze-history', 'FaZe History', 'Share your memories. Help new fans discover the legacy.'],
  ['events', 'Events', 'Watch together, predict together, discuss every round.'],
];
/** Historical context is sourced; all conversations/events are seeded demo discussions. */
export const COMMUNITY_STARTERS: [number, string, string, 'post' | 'challenge'][] = [
  [0, 'What makes a good CS2 teammate?', 'DEMO DISCUSSION · Tell us about a call, flash, or trade that won your round. Fans from every region are welcome.', 'post'],
  [0, 'Mirage CT side: what is your default?', 'DEMO DISCUSSION · How do you share information when mid gets pressured? Describe your utility and fallback plan.', 'post'],
  [1, 'Your cleanest clutch this week', 'DEMO DISCUSSION · Share an existing CS2 clip and explain the decision that made the difference.', 'post'],
  [2, 'Who should we be watching?', 'DEMO DISCUSSION · Spotlight an emerging CS2 player. Explain what stands out; this is fan discussion, not an official scouting decision.', 'post'],
  [3, '2010 · The beginning of the montage legacy', 'DEMO DISCUSSION · FaZe’s official history dates its beginnings to 2010. Which montage introduced you to the community? Share a memory or an original source. Source: https://fazeclan.com/pages/about', 'post'],
  [3, '2016 · The Counter-Strike chapter', 'DEMO DISCUSSION · FaZe’s official history includes its 2016 Counter-Strike chapter. How did competitive Counter-Strike change the way you followed FaZe? Historical context, not CS2 gameplay. Source: https://fazeclan.com/pages/about', 'post'],
  [3, '2022 · Remembering Antwerp', 'DEMO DISCUSSION · FaZe won PGL Major Antwerp in 2022, during the CS:GO era. Which moment do you remember, and what would you like today’s CS2 fans to discover? Source: https://fazeclan.com/pages/team', 'post'],
  [4, 'Community watch party: pre-match predictions', 'DEMO EVENT · No scheduled fixture or opponent is implied. What map would you like to see, and what should we watch for?', 'post'],
  [4, 'Post-match desk: your turning point', 'DEMO EVENT · Use this practice thread to discuss a hypothetical CS2 match. Which calls would you review?', 'post'],
  [1, 'Recreate the Classic: the one-tap', 'DEMO CHALLENGE · Capture a clean, stationary CS2 one-tap. Submit an existing clip as a top-level comment and describe your setup. One submission per person. Community votes rank submissions here only. No prizes or official affiliation.', 'challenge'],
];

/** Additive, repeatable seed; only creates boards and missing starter discussions. */
export async function seedCommunity(db: Queryable) {
  const authors = (await db.query("SELECT id FROM users WHERE role='user' ORDER BY handle LIMIT 3")).rows;
  if (!authors.length) throw new Error('Seed shared users before community discussions');
  for (const [slug, name, description] of boardSeeds) {
    await db.query('INSERT INTO communities (slug,name,description) VALUES ($1,$2,$3) ON CONFLICT (slug) DO NOTHING', [slug,name,description]);
  }
  for (const [index, title, body, type] of COMMUNITY_STARTERS) {
    await db.query(`INSERT INTO threads (community_id,user_id,type,title,body)
      SELECT c.id,$2,$3,$4,$5 FROM communities c WHERE c.slug=$1
      AND NOT EXISTS (SELECT 1 FROM threads t WHERE t.community_id=c.id AND t.title=$4)`,
      [boardSeeds[index][0], authors[index % authors.length].id, type,title,body]);
  }
}

class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
function fail(status: number, message: string): never { throw new HttpError(status, message); }
const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res)).catch(next); };

export function createCommunityRouter(options: CommunityOptions = {}) {
  const router = Router();
  const mode = options.db ? 'database' : 'demo';
  const users: Row[] = options.demoUsers ?? [
    { id: 'demo-fan', handle: 'smokecheck', display_name: 'SmokeCheck', avatar_url: null },
    { id: 'demo-returning-fan', handle: 'rewind', display_name: 'Rewind', avatar_url: null },
    { id: 'demo-prospect', handle: 'nextup', display_name: 'NextUp', avatar_url: null },
  ];
  if (users.length === 0) throw new Error('Community demo requires at least one shared demo user');
  const communities: Row[] = boardSeeds.map(([slug, name, description]) => ({ id: `demo-${slug}`, slug, name, description }));
  const clips = options.demoClips ?? [];
  const threads: Row[] = [];
  const comments: Row[] = [];
  const votes = new Map<string, number>();
  const reports = new Map<string, Row>();
  const seed = (board: number, title: string, body: string, type = 'post') => threads.push({ id: randomUUID(), community_id: communities[board].id, user_id: users[board % users.length]?.id, type, title, body, clip_id: null, score: 0, created_at: new Date(Date.now() - (board + 1) * 3600000).toISOString() });
  for (const [board, title, body, type] of COMMUNITY_STARTERS) seed(board, title, body, type);
  if (users.length) comments.push({ id: randomUUID(), thread_id: threads[0].id, parent_id: null, user_id: users[0].id, body: 'Demo comment · A clear call and a flash for your teammate can change the whole round.', clip_id: null, score: 0, created_at: new Date().toISOString() });
  const text = (value: unknown, name: string, max: number) => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(400, `${name} must be 1–${max} characters`);
    const result = (value as string).trim();
    if ((options.blockedWords ?? ['doxxing', 'swatting']).some(word => result.toLowerCase().includes(word.toLowerCase()))) fail(400, 'Please revise language flagged by the community filter');
    return result;
  };
  const id = (value: unknown): string => { if (typeof value !== 'string' || !/^[\w-]{1,100}$/.test(value)) fail(400, 'Invalid reference'); return value as string; };
  const query = async (sql: string, args: unknown[] = []) => (await options.db!.query(sql, args)).rows;
  const userId = async (req: Request) => {
    const value = options.getUserId ? options.getUserId(req) : req.get('x-user-id');
    if (!value) fail(401, 'Choose a shared demo account to participate');
    id(value);
    const found = options.db ? (await query('SELECT id FROM users WHERE id::text = $1', [value]))[0] : users.find(u => u.id === value);
    if (!found) fail(401, 'Unknown account');
    return value as string;
  };
  const viewer = (req: Request) => options.getUserId ? options.getUserId(req) : req.get('x-user-id');
  const lookup = async (table: 'threads' | 'comments' | 'clips', value: string): Promise<Row> => {
    const row = options.db ? (await query(`SELECT * FROM ${table} WHERE id::text = $1`, [value]))[0] : ({ threads, comments, clips }[table]).find(x => x.id === value);
    return row ?? fail(404, `${table.slice(0, -1)} not found`);
  };
  const checkClip = async (value: unknown, owner: string) => {
    if (value === undefined || value === null || value === '') return null;
    const clip = await lookup('clips', id(value));
    if (clip.game !== 'cs2') fail(400, 'Only CS2 clips can be attached');
    if (clip.user_id !== owner) fail(403, 'Attach a clip from your own portfolio');
    return clip.id;
  };
  const decorate = (row: Row, target: 'thread' | 'comment', uid?: string) => ({ ...row, author: users.find(u => u.id === row.user_id), clip: clips.find(c => c.id === row.clip_id) ?? null, viewer_vote: votes.get(`${uid}:${target}:${row.id}`) ?? 0, ...(target === 'thread' ? { comment_count: comments.filter(c => c.thread_id === row.id).length } : {}) });
  const select = (table: 'threads' | 'comments') => `SELECT t.*, json_build_object('id',u.id,'handle',u.handle,'display_name',u.display_name,'avatar_url',u.avatar_url) AS author, CASE WHEN c.id IS NULL THEN NULL ELSE row_to_json(c) END AS clip, COALESCE(v.value,0) AS viewer_vote ${table === 'threads' ? ', (SELECT count(*)::int FROM comments WHERE thread_id = t.id) AS comment_count' : ''} FROM ${table} t JOIN users u ON u.id=t.user_id LEFT JOIN clips c ON c.id=t.clip_id LEFT JOIN votes v ON v.target_id=t.id AND v.target_type='${table === 'threads' ? 'thread' : 'comment'}' AND v.user_id::text=$1`;
  const send = (res: Response, data: unknown, status = 200) => res.status(status).json({ data, mode });
  router.get('/communities', wrap(async (_req, res) => send(res, options.db ? await query('SELECT * FROM communities ORDER BY name') : communities)));
  router.get('/communities/:slug/threads', wrap(async (req, res) => {
    const sort = req.query.sort ?? 'hot';
    if (!['hot', 'new', 'top'].includes(sort as string)) fail(400, 'Sort must be hot, new, or top');
    const board = options.db ? (await query('SELECT * FROM communities WHERE slug=$1', [req.params.slug]))[0] : communities.find(c => c.slug === req.params.slug);
    if (!board) fail(404, 'Community not found');
    const order = sort === 'new' ? 't.created_at DESC' : sort === 'top' ? 't.score DESC, t.created_at DESC' : '(t.score / power(2 + greatest(0, extract(epoch FROM (now()-t.created_at))/3600), 1.5)) DESC, t.created_at DESC';
    if (options.db) return send(res, await query(`${select('threads')} WHERE t.community_id=$2 ORDER BY ${order} LIMIT 100`, [viewer(req) ?? null, board.id]));
    const hot = (t: Row) => t.score / Math.pow(2 + Math.max(0, (Date.now() - Date.parse(t.created_at)) / 3600000), 1.5);
    const rows = threads.filter(t => t.community_id === board.id).sort((a,b) => (sort === 'new' ? 0 : sort === 'top' ? b.score-a.score : hot(b)-hot(a)) || Date.parse(b.created_at)-Date.parse(a.created_at));
    return send(res, rows.slice(0,100).map(t => decorate(t, 'thread', viewer(req))));
  }));
  router.post('/communities/:slug/threads', wrap(async (req, res) => {
    const uid = await userId(req), body = req.body ?? {};
    const title = text(body.title, 'Title', 180), content = text(body.body, 'Body', 10000);
    const type = body.type ?? 'post';
    if (!['post', 'challenge'].includes(type)) fail(400, 'Invalid thread type');
    const clipId = await checkClip(body.clip_id, uid);
    const board = options.db ? (await query('SELECT id FROM communities WHERE slug=$1', [req.params.slug]))[0] : communities.find(c => c.slug === req.params.slug);
    if (!board) fail(404, 'Community not found');
    const row = { id: randomUUID(), community_id: board.id, user_id: uid, type, title, body: content, clip_id: clipId, score: 0, created_at: new Date().toISOString() };
    if (options.db) { await query('INSERT INTO threads (id,community_id,user_id,type,title,body,clip_id,score,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', Object.values(row)); return send(res, (await query(`${select('threads')} WHERE t.id=$2`, [uid,row.id]))[0], 201); }
    threads.push(row); return send(res, decorate(row, 'thread', uid), 201);
  }));
  router.get('/threads/:id/comments', wrap(async (req, res) => {
    const tid = id(req.params.id); await lookup('threads', tid);
    send(res, options.db ? await query(`${select('comments')} WHERE t.thread_id=$2 ORDER BY t.created_at LIMIT 1000`, [viewer(req) ?? null, tid]) : comments.filter(c => c.thread_id === tid).map(c => decorate(c, 'comment', viewer(req))));
  }));
  router.post('/threads/:id/comments', wrap(async (req, res) => {
    const uid = await userId(req), tid = id(req.params.id), thread = await lookup('threads', tid), body = req.body ?? {};
    const content = text(body.body, 'Comment', 4000);
    const parent = body.parent_id == null ? null : await lookup('comments', id(body.parent_id));
    if (parent && parent.thread_id !== tid) fail(400, 'Reply must belong to this thread');
    const clipId = await checkClip(body.clip_id, uid);
    if (thread.type === 'challenge' && !parent && !clipId) fail(400, 'Challenge submissions require an existing CS2 clip');
    const row = { id: randomUUID(), thread_id: tid, parent_id: parent?.id ?? null, user_id: uid, body: content, clip_id: clipId, score: 0, created_at: new Date().toISOString() };
    if (options.db) {
      const client = await options.db.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT id FROM threads WHERE id=$1 FOR UPDATE', [tid]);
        if (thread.type === 'challenge' && !parent && (await client.query('SELECT id FROM comments WHERE thread_id=$1 AND user_id=$2 AND parent_id IS NULL AND clip_id IS NOT NULL', [tid,uid])).rows.length) fail(409, 'You already submitted to this challenge');
        await client.query('INSERT INTO comments (id,thread_id,parent_id,user_id,body,clip_id,score,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', Object.values(row));
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
      return send(res, (await query(`${select('comments')} WHERE t.id=$2`, [uid,row.id]))[0], 201);
    }
    if (thread.type === 'challenge' && !parent && comments.some(c => c.thread_id === tid && c.user_id === uid && c.parent_id === null && c.clip_id)) fail(409, 'You already submitted to this challenge');
    comments.push(row); return send(res, decorate(row, 'comment', uid), 201);
  }));
  router.post('/votes', wrap(async (req, res) => {
    const uid = await userId(req), body = req.body ?? {}, target = body.target_type;
    if (!['thread','comment'].includes(target) || ![-1,0,1].includes(body.value)) fail(400, 'Vote requires thread/comment and value -1, 0, or 1');
    const tid = id(body.target_id), table = target === 'thread' ? 'threads' : 'comments';
    if (options.db) {
      const client = await options.db.connect();
      try {
        await client.query('BEGIN');
        const row = (await client.query(`SELECT score FROM ${table} WHERE id::text=$1 FOR UPDATE`, [tid])).rows[0];
        if (!row) fail(404, 'Vote target not found');
        const previous = (await client.query('SELECT value FROM votes WHERE user_id=$1 AND target_type=$2 AND target_id=$3', [uid,target,tid])).rows[0]?.value ?? 0;
        await client.query('DELETE FROM votes WHERE user_id=$1 AND target_type=$2 AND target_id=$3', [uid,target,tid]);
        if (body.value) await client.query('INSERT INTO votes (user_id,target_type,target_id,value) VALUES ($1,$2,$3,$4)', [uid,target,tid,body.value]);
        const updated = (await client.query(`UPDATE ${table} SET score=score+$1 WHERE id::text=$2 RETURNING score`, [body.value-previous,tid])).rows[0];
        await client.query('COMMIT'); return send(res, { score: updated.score, viewer_vote: body.value });
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    }
    const row = await lookup(table, tid), key = `${uid}:${target}:${tid}`, previous = votes.get(key) ?? 0;
    row.score += body.value - previous;
    if (body.value) votes.set(key, body.value); else votes.delete(key);
    return send(res, { score: row.score, viewer_vote: body.value });
  }));
  router.post('/community/reports', wrap(async (req, res) => {
    const uid = await userId(req), body = req.body ?? {};
    if (!['thread','comment'].includes(body.target_type)) fail(400, 'Invalid report target');
    const tid = id(body.target_id), reason = text(body.reason, 'Reason', 500);
    await lookup(body.target_type === 'thread' ? 'threads' : 'comments', tid);
    if (!options.report && options.db) fail(503, 'Moderation inbox is not connected yet');
    const key = `${uid}:${body.target_type}:${tid}`;
    if (reports.has(key)) fail(409, 'You already reported this content');
    if (options.report) await options.report({ user_id: uid, target_type: body.target_type, target_id: tid, reason });
    else if (reports.size >= 1000) fail(503, 'Demo report buffer is full');
    reports.set(key, { user_id: uid, target_type: body.target_type, target_id: tid, reason });
    return send(res, { message: options.report ? 'Report sent to moderators' : 'Demo report recorded in memory; no moderator inbox is connected' }, 201);
  }));
  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const known = error instanceof HttpError;
    res.status(known ? error.status : 503).json({ error: known ? error.message : 'Community storage is unavailable. Please retry.' });
  });
  return router;
}
export default createCommunityRouter;
