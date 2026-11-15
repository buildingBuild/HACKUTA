// FaZe Live (owner: Yao). REQUIREMENTS.md §7.3.
//   GET /api/live   -> LiveSnapshot { status, counters }
// Phase 1 serves the clock-driven mock; Phase 2 serves the event bus state (same shape) and also
// pushes it over socket.io, so UI components don't change.
import { Router } from 'express';
import type { LiveSnapshot } from '../../../shared/types.js';
import { liveCounters, mockStatus } from '../lib/live/mock.js';
import type { Db } from '../lib/yao-deps.js';

export function createLiveRouter({ db }: { db: Db }): Router {
  const r = Router();
  r.get('/', async (_req, res) => {
    const body: LiveSnapshot = { status: mockStatus(), counters: await liveCounters(db) };
    res.set('Cache-Control', 'no-store').json(body);
  });
  return r;
}
