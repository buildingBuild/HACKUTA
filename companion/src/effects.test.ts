import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Lights } from './aura.ts';
import { EFFECTS, Player } from './effects.ts';

type Call = [string, ...unknown[]];
class FakeLights implements Lights {
  calls: Call[] = [];
  off() { this.calls.push(['off']); }
  base() { this.calls.push(['base']); }
  color(r: number, g: number, b: number) { this.calls.push(['color', r, g, b]); }
  mode(m: number, r: number, g: number, b: number, speed?: string) { this.calls.push(['mode', m, r, g, b, speed]); }
}
const instant = () => new Promise<void>((r) => setImmediate(r));

test('round_win flashes full red against the base and ends off', async () => {
  const l = new FakeLights();
  assert.equal(await new Player(l, instant).play('round_win'), true);
  assert.deepEqual(l.calls[0], ['color', 255, 0, 0]);
  assert.ok(l.calls.filter((c) => c[0] === 'color').length >= 3, 'several flashes');
  assert.deepEqual(l.calls.at(-1), ['off']);
});

test('unknown effect resolves false and touches nothing', async () => {
  const l = new FakeLights();
  assert.equal(await new Player(l, instant).play('nope'), false);
  assert.equal(l.calls.length, 0);
});

test('a new effect cancels the running one and lights still end off', async () => {
  const l = new FakeLights();
  const p = new Player(l, instant);
  const first = p.play('ace');
  const second = p.play('match_win');
  await Promise.all([first, second]);
  const winIdx = l.calls.findIndex((c) => c[0] === 'mode' && c[1] === 2);
  assert.ok(winIdx >= 0, 'match_win ran');
  const afterWin = l.calls.slice(winIdx + 1);
  assert.ok(!afterWin.some((c) => c[0] === 'color' && c[1] === 255 && c[2] === 255), 'no ace white flash after match_win started');
  assert.deepEqual(l.calls.at(-1), ['off']);
});

test('every effect ends with the lights off', async () => {
  for (const name of Object.keys(EFFECTS)) {
    const l = new FakeLights();
    await new Player(l, instant).play(name);
    assert.deepEqual(l.calls.at(-1), ['off'], name);
  }
});

test('with the base on, an effect returns to dim red instead of off', async () => {
  const l = new FakeLights();
  const p = new Player(l, instant);
  p.setBase(true);
  await p.play('round_win');
  assert.deepEqual(l.calls[0], ['base']);
  assert.deepEqual(l.calls.at(-1), ['base']);
});

test('turning the base off while idle switches the lights off', () => {
  const l = new FakeLights();
  const p = new Player(l, instant);
  p.setBase(true);
  p.setBase(false);
  assert.deepEqual(l.calls, [['base'], ['off']]);
});

test('turning the base off mid-effect ends that effect with the lights off', async () => {
  const l = new FakeLights();
  const p = new Player(l, instant);
  p.setBase(true);
  const run = p.play('ace');
  p.setBase(false);
  await run;
  assert.deepEqual(l.calls.at(-1), ['off']);
});

test('a round loss blacks the board out', async () => {
  const l = new FakeLights();
  const p = new Player(l, instant);
  p.setBase(true);
  await p.play('round_loss');
  assert.deepEqual(l.calls.slice(1), [['off'], ['base']]);
});

test('while the base is on and idle it is re-applied, so other lighting apps cannot repaint the board', async () => {
  const l = new FakeLights();
  const p = new Player(l, instant, 10);
  p.setBase(true);
  await new Promise((r) => setTimeout(r, 60));
  const bases = l.calls.filter((c) => c[0] === 'base').length;
  assert.ok(bases >= 3, `base re-applied (${bases})`);
  p.setBase(false);
  const n = l.calls.length;
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(l.calls.length, n, 'keep-alive stops once the base is off');
});

test('a long effect step is re-applied during its hold', async () => {
  const l = new FakeLights();
  await new Player(l, instant, 1000).play('match_win');
  assert.equal(l.calls.filter((c) => c[0] === 'mode' && c[1] === 2).length, 4);
});
