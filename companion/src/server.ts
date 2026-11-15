// Local HTTP API for the /rgb page. Binds to 127.0.0.1 only (see index.ts).
//   GET  /status          -> { ok: true, device: boolean }
//   POST /effect {type}   -> { played: boolean }   (always 200; 400 on bad JSON)
import http from 'node:http';
import type { Lights } from './aura.ts';
import { isEffect, Player } from './effects.ts';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-private-network': 'true',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};

export function createServer(opts: { lights: Lights | null }) {
  let device = opts.lights !== null;
  // Every driver call goes through here: a USB error marks the keyboard gone instead of crashing the server.
  const guard = (fn: () => void) => {
    if (!device) return;
    try {
      fn();
    } catch (e) {
      device = false;
      console.warn('[companion] keyboard error, disabling:', (e as Error).message);
    }
  };
  const l = opts.lights;
  const safe: Lights = {
    off: () => guard(() => l?.off()),
    color: (r, g, b) => guard(() => l?.color(r, g, b)),
    mode: (m, r, g, b, s) => guard(() => l?.mode(m, r, g, b, s)),
  };
  const player = new Player(safe);

  const send = (res: http.ServerResponse, status: number, body?: unknown) => {
    res.writeHead(status, body === undefined ? CORS : { ...CORS, 'content-type': 'application/json' });
    res.end(body === undefined ? undefined : JSON.stringify(body));
  };

  const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') return send(res, 204);
    if (req.method === 'GET' && req.url === '/status') return send(res, 200, { ok: true, device });
    if (req.method === 'POST' && req.url === '/effect') {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        let type: unknown;
        try {
          type = JSON.parse(raw)?.type;
        } catch {
          return send(res, 400, { error: 'invalid JSON' });
        }
        if (!device || typeof type !== 'string' || !isEffect(type)) return send(res, 200, { played: false });
        // play() runs its first step synchronously, so a USB failure shows up in `device` right away.
        player.play(type).catch(() => {});
        send(res, 200, { played: device });
      });
      return;
    }
    send(res, 404, { error: 'not found' });
  });

  return {
    server,
    shutdown() {
      player.stop();
      try {
        opts.lights?.off();
      } catch {
        /* keyboard already gone */
      }
    },
  };
}
