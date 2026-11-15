// Express app. index.ts creates the HTTP server (Phase 2 attaches socket.io there).
// SHARED FILE: add your router below, additive only.
import express from 'express';
import { createCommunityRouter } from './routes/community.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db/client.js';
import { createAuth } from './lib/auth.js';
import { profileScoutProgress } from './lib/scouting/profileProgress.js';
import { createAdminRouter } from './routes/admin.js';
import { createAuthRouter } from './routes/auth.js';
import { createClipsRouter } from './routes/clips.js';
import { createLiveRouter } from './routes/live.js';
import { createPlayersRouter } from './routes/players.js';
import { createProfilesRouter } from './routes/profiles.js';
import { createScoutingRouter } from './routes/scouting.js';

const db = pool;
const auth = createAuth(db);

export const app = express();
app.use(express.json({ limit: '1mb' })); // never video: clips go straight to blob storage

app.get('/api/health', async (_req, res) => {
  try {
    const r = await db.query('SELECT now() AS now');
    res.json({ ok: true, db: r.rows[0].now, faceit_mode: process.env.FACEIT_MODE || 'mock' });
  } catch (e) {
    res.status(503).json({ ok: false, error: (e as Error).message });
  }
});

app.use('/api/auth', createAuthRouter({ db, auth }));
app.use('/api/admin', createAdminRouter({ db, auth })); // Yao (Phase 2 director console)
app.use('/api/live', createLiveRouter({ db })); // Yao (FaZe Live: mock now, event bus in Phase 2)
app.use('/api/clips', createClipsRouter({ db, auth })); // Joe (placeholder)
app.use('/api/players', createPlayersRouter({ db, auth })); // Yao
app.use('/api/scouting', createScoutingRouter({ db, auth })); // Yao
app.use('/api', auth.identify, createCommunityRouter({ db, getUserId: req => req.user?.id })); // Dahiya
app.use('/api', auth.identify, createProfilesRouter({ db, scoutProgress: profileScoutProgress })); // Omar

// Local demo clips (server/demo-clips/*.mp4) until real blob storage is wired.
app.use('/demo-clips', express.static(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../demo-clips')));

app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }));
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[api] unhandled:', err);
  res.status(500).json({ error: 'internal error' });
});
