// Demo session (REQUIREMENTS.md §7.5). SHARED: the demo login picker stores the user id;
// API calls send it as `x-user-id` (see authHeaders) and a cookie for plain fetches.
import { useEffect, useState } from 'react';

const KEY = 'demo_user_id';

export interface SessionUser {
  id: string;
  handle: string;
  display_name: string | null;
  role: 'user' | 'recruiter' | 'admin';
  avatar_url?: string | null;
  faceit_level?: number | null;
  faceit_elo?: number | null;
}

export function getDemoUserId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setDemoUserId(id: string | null): void {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: header auth just won't persist */
  }
  document.cookie = id ? `fazehq_user=${encodeURIComponent(id)}; path=/; SameSite=Lax` : 'fazehq_user=; path=/; max-age=0';
}

export function authHeaders(): Record<string, string> {
  const id = getDemoUserId();
  return id ? { 'x-user-id': id } : {};
}

/** Current demo user, or null when signed out. */
export function useSessionUser(): { user: SessionUser | null; loading: boolean } {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!getDemoUserId()) {
      setLoading(false);
      return;
    }
    fetch('/api/auth/me', { headers: authHeaders() })
      .then((r) => r.json())
      .then((b: { user: SessionUser | null }) => setUser(b.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);
  return { user, loading };
}
