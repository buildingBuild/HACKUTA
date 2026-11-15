// Talks to the local RGB companion (companion/, `npm start`). Optional: every call fails soft.
import type { EffectName } from './cues';

export const COMPANION = 'http://127.0.0.1:7777';
const TIMEOUT_MS = 400;

/**
 * Probe the companion automatically only on a local dev host. On the deployed site the probe would trigger
 * Chrome's local-network permission prompt for every visitor, so there it waits for a "Connect" click.
 */
export function autoConnect(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

export async function companionStatus(): Promise<boolean> {
  try {
    const r = await fetch(`${COMPANION}/status`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body = (await r.json()) as { device?: boolean };
    return r.ok && body.device === true;
  } catch {
    return false;
  }
}

export async function sendEffect(type: EffectName): Promise<boolean> {
  try {
    const r = await fetch(`${COMPANION}/effect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await r.json()) as { played?: boolean };
    return body.played === true;
  } catch {
    return false;
  }
}
