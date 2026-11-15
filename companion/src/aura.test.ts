import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openAura } from './aura.ts';

const device = { vendorId: 0x0b05, productId: 0x19b6, usagePage: 0xff31, usage: 0x79, path: 'x' };

test('openAura returns null instead of throwing when the device cannot be opened', () => {
  const hid = {
    devices: () => [device],
    HID: class { constructor() { throw new Error('access denied'); } },
  };
  assert.equal(openAura(hid as never), null);
});

test('openAura returns null when no keyboard is present', () => {
  assert.equal(openAura({ devices: () => [], HID: class {} } as never), null);
});
