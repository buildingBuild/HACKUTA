// ASUS Aura laptop keyboard driver (tested on ROG Strix G16 G614JIR, USB 0B05:19B6).
// Protocol: 64-byte HID feature reports on the vendor interface (usage page 0xFF31, usage 0x79).
import HID from 'node-hid';

export type AuraMode = 0 | 1 | 2 | 10; // static, breathing, colour cycle, strobe (unverified)
export type Speed = 'slow' | 'med' | 'fast';

export interface Lights {
  off(): void;
  color(r: number, g: number, b: number): void;
  mode(m: AuraMode, r: number, g: number, b: number, speed?: Speed): void;
}

const VID = 0x0b05;
const PID = 0x19b6;
const SPEED: Record<Speed, number> = { slow: 0xe1, med: 0xeb, fast: 0xf5 };
const INIT = [0x5d, ...Buffer.from('ASUS Tech.Inc.')];

const report = (bytes: number[]) => {
  const buf = new Array<number>(64).fill(0);
  bytes.forEach((b, i) => (buf[i] = b));
  return buf;
};

type HidModule = Pick<typeof HID, 'devices' | 'HID'>;

/** Open the keyboard, or null if this machine has none or it can't be opened (busy, access denied). */
export function openAura(hid: HidModule = HID): Lights | null {
  try {
    return open(hid);
  } catch (e) {
    console.warn('[companion] could not open keyboard:', (e as Error).message);
    return null;
  }
}

function open(hid: HidModule): Lights | null {
  const info = hid.devices().find(
    (d) => d.vendorId === VID && d.productId === PID && d.usagePage === 0xff31 && d.usage === 0x79 && d.path,
  );
  if (!info?.path) return null;
  const dev = new hid.HID(info.path);
  const send = (bytes: number[]) => dev.sendFeatureReport(report(bytes));
  const brightness = (level: 0 | 1 | 2 | 3) => send([0x5d, 0xba, 0xc5, 0xc4, level]);

  const lights: Lights = {
    off: () => brightness(0),
    color: (r, g, b) => lights.mode(0, r, g, b),
    mode: (m, r, g, b, speed = 'med') => {
      brightness(3);
      send([0x5d, 0xb3, 0x00, m, r, g, b, SPEED[speed], 0x00, 0x00]);
      send([0x5d, 0xb4]);
    },
  };

  send(INIT);
  brightness(3);
  send([0x5d, 0xb5]);
  return lights;
}
