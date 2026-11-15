// Shared JSON fetch helper. SHARED (all features): sends the demo session (cookie + x-user-id header)
// and throws `Error & { status, body }` on non-2xx so callers can branch on 401/403.
import { authHeaders } from './session';

export type ApiError = Error & { status?: number; body?: Record<string, unknown> };

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || `HTTP ${res.status}`), { status: res.status, body }) as ApiError;
  return body as T;
}
