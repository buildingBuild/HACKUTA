// HTTP entry. Phase 2 attaches socket.io to `server` (same origin as the API + web build).
import { createServer } from 'node:http';
import { app } from './app.js';

const port = Number(process.env.PORT || 3001);
export const server = createServer(app);
server.listen(port, () => {
  console.log(`FaZe HQ on http://localhost:${port} (FACEIT_MODE=${process.env.FACEIT_MODE || 'mock'})`);
});
