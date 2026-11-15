import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import type { Lights } from './aura.ts';
import { createServer } from './server.ts';

class FakeLights implements Lights {
  calls: string[] = [];
  off() { this.calls.push('off'); }
  base() { this.calls.push('base'); }
  color() { this.calls.push('color'); }
  mode() { this.calls.push('mode'); }
}
class BrokenLights implements Lights {
  off() { throw new Error('usb gone'); }
  base() { throw new Error('usb gone'); }
  color() { throw new Error('usb gone'); }
  mode() { throw new Error('usb gone'); }
}

async function start(lights: Lights | null) {
  const app = createServer({ lights });
  await new Promise<void>((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  return { app, base, close: () => { app.shutdown(); app.server.close(); } };
}
const post = (url: string, body: unknown) =>
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('status without a keyboard reports device:false with private-network CORS', async () => {
  const s = await start(null);
  const r = await fetch(`${s.base}/status`);
  assert.deepEqual(await r.json(), { ok: true, device: false });
  assert.equal(r.headers.get('access-control-allow-private-network'), 'true');
  s.close();
});

test('OPTIONS preflight returns 204 with allow-origin *', async () => {
  const s = await start(null);
  const r = await fetch(`${s.base}/effect`, { method: 'OPTIONS' });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  s.close();
});

test('POST /effect plays on the keyboard', async () => {
  const l = new FakeLights();
  const s = await start(l);
  const r = await post(`${s.base}/effect`, { type: 'match_win' });
  assert.deepEqual(await r.json(), { played: true });
  assert.equal(l.calls[0], 'color');
  s.close();
});

test('a driver error returns played:false and flips status to device:false', async () => {
  const s = await start(new BrokenLights());
  const r = await post(`${s.base}/effect`, { type: 'round_win' });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { played: false });
  assert.deepEqual(await (await fetch(`${s.base}/status`)).json(), { ok: true, device: false });
  s.close();
});

test('bad JSON is a 400, unknown path a 404', async () => {
  const s = await start(null);
  const bad = await fetch(`${s.base}/effect`, { method: 'POST', body: '{nope' });
  assert.equal(bad.status, 400);
  assert.equal((await fetch(`${s.base}/nope`)).status, 404);
  s.close();
});

test('shutdown turns the lights off', () => {
  const l = new FakeLights();
  createServer({ lights: l }).shutdown();
  assert.deepEqual(l.calls, ['off']);
});

class FailsAfterFirst implements Lights {
  calls: string[] = [];
  private n = 0;
  off() { this.calls.push('off'); }
  base() { this.calls.push('base'); }
  color() { if (this.n++ > 0) throw new Error('usb hiccup'); this.calls.push('color'); }
  mode() { this.calls.push('mode'); }
}

test('after a mid-session HID error the server still tries to turn the lights off', async () => {
  const l = new FailsAfterFirst();
  const s = await start(l);
  try {
    await post(`${s.base}/effect`, { type: 'match_win' });
    await post(`${s.base}/effect`, { type: 'match_win' }); // this one throws
    assert.equal(l.calls.at(-1), 'off');
  } finally {
    s.close();
  }
});

test('a lost keyboard is reopened on the next status check', async () => {
  const fresh = new FakeLights();
  const app = createServer({ lights: new BrokenLights(), reopen: () => fresh });
  await new Promise<void>((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  try {
    await post(`${base}/effect`, { type: 'round_win' });
    assert.deepEqual(await (await fetch(`${base}/status`)).json(), { ok: true, device: true });
    assert.deepEqual(await (await post(`${base}/effect`, { type: 'ace' })).json(), { played: true });
  } finally {
    app.shutdown();
    app.server.close();
  }
});

test('POST /base turns the dim-red base on and off', async () => {
  const l = new FakeLights();
  const s = await start(l);
  try {
    assert.deepEqual(await (await post(`${s.base}/base`, { on: true })).json(), { ok: true });
    assert.deepEqual(await (await post(`${s.base}/base`, { on: false })).json(), { ok: true });
    assert.deepEqual(l.calls, ['base', 'off']);
  } finally {
    s.close();
  }
});

test('POST /effect accepts a kill', async () => {
  const s = await start(new FakeLights());
  try {
    assert.deepEqual(await (await post(`${s.base}/effect`, { type: 'kill' })).json(), { played: true });
  } finally {
    s.close();
  }
});
