// TEMPORARY sandbox server: mounts ONLY Yao's routers with a stub db + auth, the
// same way Joe's server/src/app.ts will:
//   app.use('/api/coaching', createCoachingRouter({ db, auth }))
import express, { type RequestHandler } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';
import type { AuthDeps, Role } from '../server/src/lib/yao-deps.js';
import { createCoachingRouter } from '../server/src/routes/coaching.js';
import { createPlayersRouter } from '../server/src/routes/players.js';
import { createScoutingRouter } from '../server/src/routes/scouting.js';
import { createVoiceRouter } from '../server/src/routes/voice.js';

const db = pool;

// Stub auth: demo login picker sends `x-user-id` (or ?as=<handle> for quick curl tests).
const identify: RequestHandler = async (req, _res, next) => {
  if (req.user) return next();
  const id = req.header('x-user-id');
  const handle = typeof req.query.as === 'string' ? req.query.as : null;
  if (!id && !handle) return next();
  try {
    const r = await db.query<{ id: string; role: Role }>(
      id ? `SELECT id, role FROM users WHERE id::text = $1` : `SELECT id, role FROM users WHERE handle = $1`,
      [id ?? handle],
    );
    if (r.rows[0]) req.user = { id: String(r.rows[0].id), role: r.rows[0].role };
  } catch {
    /* bad id -> anonymous */
  }
  next();
};
const auth: AuthDeps = {
  identify,
  requireRole: (...roles) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'sign in required' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
    next();
  },
};

const app = express();
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  const r = await db.query('SELECT now() AS now');
  res.json({ ok: true, db: r.rows[0].now, coaching_mode: process.env.COACHING_MODE || 'auto' });
});

// Sandbox-only helpers (Joe owns real users/clips routes).
app.get('/api/sandbox/users', async (_req, res) => {
  const r = await db.query(
    `SELECT u.id, u.handle, u.display_name, u.role, g.faceit_level, g.faceit_elo
       FROM users u LEFT JOIN game_accounts g ON g.user_id = u.id ORDER BY u.role DESC, g.faceit_elo DESC NULLS LAST`,
  );
  res.json(r.rows);
});
app.get('/api/sandbox/clips', async (req, res) => {
  const r = await db.query(
    `SELECT c.id, c.user_id, c.title, c.map, c.side, c.blob_url, c.status, c.created_at, u.handle
       FROM clips c JOIN users u ON u.id = c.user_id
      ${req.query.userId ? 'WHERE c.user_id = $1' : ''} ORDER BY c.created_at DESC`,
    req.query.userId ? [req.query.userId] : [],
  );
  res.json(r.rows);
});
// Local demo clips (sandbox/demo-clips/*.mp4, not committed).
app.use('/demo-clips', express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), 'demo-clips')));

app.use('/api/coaching', createCoachingRouter({ db, auth }));
app.use('/api/players', createPlayersRouter({ db, auth }));
app.use('/api/scouting', createScoutingRouter({ db, auth }));
app.use('/api/voice', createVoiceRouter({ db, auth }));

const port = Number(process.env.SANDBOX_PORT || 3001);
app.listen(port, () => console.log(`yao sandbox api on http://localhost:${port} (COACHING_MODE=${process.env.COACHING_MODE || 'auto'})`));
