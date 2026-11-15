// Demo session (REQUIREMENTS.md §7.5). SHARED.
// The server's httpOnly `fazehq_user` cookie is the source of truth (POST /api/auth/login).
// We also keep the id in localStorage so older callers that send `x-user-id` (authHeaders) stay in sync.
import { useEffect, useState } from 'react';
import type { Role } from '../../../shared/types';

const KEY = 'demo_user_id';

export interface SessionUser {
  id: string;
  handle: string;
  display_name: string | null;
  role: Role;
  avatar_url?: string | null;
  faceit_level?: number | null;
  faceit_elo?: number | null;
}

export const isStaff = (u: Pick<SessionUser, 'role'> | null | undefined) => u?.role === 'recruiter' || u?.role === 'admin';

export function getDemoUserId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function rememberId(id: string | null): void {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the cookie still carries the session */
  }
}

export function authHeaders(): Record<string, string> {
  const id = getDemoUserId();
  return id ? { 'x-user-id': id } : {};
}

let current: Promise<SessionUser | null> | null = null;

function fetchMe(): Promise<SessionUser | null> {
  current ??= fetch('/api/auth/me', { credentials: 'include', headers: authHeaders() })
    .then((r) => r.json())
    .then((b: { user: SessionUser | null }) => {
      rememberId(b.user?.id ?? null);
      return b.user;
    })
    .catch(() => null);
  return current;
}

/** Sign in as a demo user (sets the session cookie). Pass null to sign out. */
export async function signIn(id: string | null): Promise<SessionUser | null> {
  const res = await fetch(id ? '/api/auth/login' : '/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: id ? JSON.stringify({ userId: id }) : undefined,
  });
  const body = (await res.json().catch(() => ({}))) as { user?: SessionUser; error?: string };
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  rememberId(id ? (body.user?.id ?? id) : null);
  current = Promise.resolve(body.user ?? null);
  return body.user ?? null;
}

/** @deprecated use signIn (kept so older callers compile). */
export function setDemoUserId(id: string | null): void {
  void signIn(id).catch(() => rememberId(id));
}

/** Where a user lands after picking them in the demo login. */
export function homeFor(u: SessionUser | null): string {
  if (!u) return '/';
  if (u.role === 'admin') return '/admin';
  if (u.role === 'recruiter') return '/recruiting';
  return `/u/${encodeURIComponent(u.handle)}`;
}

/** Current demo user, or null when signed out. One request per page load, shared by every caller. */
export function useSessionUser(): { user: SessionUser | null; loading: boolean } {
  const [state, setState] = useState<{ user: SessionUser | null; loading: boolean }>({ user: null, loading: true });
  useEffect(() => {
    let live = true;
    fetchMe().then((user) => live && setState({ user, loading: false }));
    return () => {
      live = false;
    };
  }, []);
  return state;
}
