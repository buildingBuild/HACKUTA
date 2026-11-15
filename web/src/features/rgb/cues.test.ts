import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sendEffect } from './companion';
import { crossed, type Cue } from './cues';

const cues: Cue[] = [
  { t: 10, type: 'round_win' },
  { t: 20, type: 'ace' },
  { t: 30, type: 'match_win' },
];

test('a cue fires when normal playback crosses it', () => {
  assert.deepEqual(crossed(9.9, 10.1, cues), [cues[0]]);
});

test('a cue already behind the playhead does not fire again', () => {
  assert.deepEqual(crossed(10.1, 10.2, cues), []);
});

test('seeking forward past several cues fires none of them', () => {
  assert.deepEqual(crossed(5, 40, cues), []);
});

test('seeking backward fires nothing', () => {
  assert.deepEqual(crossed(40, 5, cues), []);
});

test('a paused playhead (no movement) fires nothing', () => {
  assert.deepEqual(crossed(10, 10, cues), []);
});

test('sendEffect resolves false when the companion is unreachable', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch;
  try {
    assert.equal(await sendEffect('round_win'), false);
  } finally {
    globalThis.fetch = real;
  }
});

import { autoConnect } from './companion';

test('the companion is only probed automatically on a local dev host', () => {
  assert.equal(autoConnect('localhost'), true);
  assert.equal(autoConnect('127.0.0.1'), true);
  assert.equal(autoConnect('fazehq.up.railway.app'), false);
});
