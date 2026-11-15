// Local HTTP API for the /rgb page. Binds to 127.0.0.1 only (see index.ts).
//   GET  /status          -> { ok: true, device: boolean }
//   POST /effect {type}   -> { played: boolean }   (always 200; 400 on bad JSON)
//   POST /base {on}       -> { ok: true }          dim-red resting state while the clip plays; off when false
import http from 'node:http';
import type { Lights } from './aura.ts';
import { isEffect, Player } from './effects.ts';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-private-network': 'true',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};

export function createServer(opts: { lights: Lights | null; reopen?: () => Lights | null }) {
  let l = opts.lights;
  let device = l !== null;
  // Every driver call goes through here: a USB error marks the keyboard gone instead of crashing the server.
  const guard = (fn: () => void) => {
    if (!device) return;
    try {
      fn();
    } catch (e) {
      device = false;
      console.warn('[companion] keyboard error, disabling:', (e as Error).message);
      try {
        l?.off(); // don't leave the keyboard stuck lit
      } catch {
        /* really gone */
      }
    }
  };
  // A lost keyboard (unplugged, sleep/resume) is retried on the next request.
  const revive = () => {
    if (device || !opts.reopen) return;
    try {
      l = opts.reopen();
      device = l !== null;
    } catch {
      device = false;
    }
  };
  const safe: Lights = {
    off: () => guard(() => l?.off()),
    base: () => guard(() => l?.base()),
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
    revive();
    if (req.method === 'GET' && req.url === '/status') return send(res, 200, { ok: true, device });
    if (req.method === 'POST' && (req.url === '/effect' || req.url === '/base')) {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        let body: { type?: unknown; on?: unknown };
        try {
          body = JSON.parse(raw) ?? {};
        } catch {
          return send(res, 400, { error: 'invalid JSON' });
        }
        if (req.url === '/base') {
          player.setBase(body.on === true);
          return send(res, 200, { ok: true });
        }
        const type = body.type;
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
        l?.off();
      } catch {
        /* keyboard already gone */
      }
    },
  };
}
