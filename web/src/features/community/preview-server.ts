/** Explicit memory-only preview adapter. Uses the shared login/clip API response shapes.
 * Does not replace production auth, upload, or storage. Run with npx tsx .../preview-server.ts.
 */
import express from 'express';
import { createCommunityRouter } from '../../../../server/src/routes/community';
const users = [
  { id: 'demo-fan', handle: 'smokecheck', display_name: 'SmokeCheck', role: 'user', avatar_url: null },
  { id: 'demo-returning-fan', handle: 'rewind', display_name: 'Rewind', role: 'user', avatar_url: null },
  { id: 'demo-prospect', handle: 'nextup', display_name: 'NextUp', role: 'user', avatar_url: null },
];
const app = express();
app.use(express.json({ limit: '64kb' }));
app.get('/api/auth/demo-users', (_req, res) => res.json({ users, mode: 'demo' }));
app.get('/api/auth/me', (req, res) => res.json({ user: users.find(u => u.id === req.get('x-user-id')) ?? null, mode: 'demo' }));
// No invented CS2 videos. The real shared clip service supplies uploaded records in normal mode.
app.get('/api/clips', (_req, res) => res.json({ clips: [], mode: 'demo' }));
app.use('/api', createCommunityRouter({ demoUsers: users }));
app.use('/api', (_req, res) => res.status(404).json({ error: 'This service is not connected in the memory-only Community preview' }));
const server = app.listen(Number(process.env.PORT || 3001), '127.0.0.1', () => console.log('Community DEMO API: http://127.0.0.1:3001 · memory only · no video fixtures'));
process.on('SIGTERM', () => server.close());
