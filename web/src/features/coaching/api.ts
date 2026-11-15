import type { AnalyzeResponse, CoachingReport, ScoutProgress } from './types';

/**
 * Demo auth: the login picker stores the user id; send it as x-user-id.
 * TODO(merge): switch to the shell's shared fetch/auth helper once Joe's scaffold exists.
 */
export function authHeaders(): Record<string, string> {
  try {
    const id = localStorage.getItem('demo_user_id');
    return id ? { 'x-user-id': id } : {};
  } catch {
    return {};
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || `HTTP ${res.status}`), { status: res.status, body });
  return body as T;
}

export const getCoaching = (clipId: string) =>
  api<{ clip_id: string; status: 'uploaded' | 'analyzing' | 'done' | 'failed'; report: CoachingReport | null }>(`/api/coaching/${clipId}`);

export const analyzeClip = (clipId: string, force = false) =>
  api<AnalyzeResponse>(`/api/coaching/analyze/${clipId}${force ? '?force=1' : ''}`, { method: 'POST' });

export const getScoutProgress = (userId: string) => api<ScoutProgress>(`/api/scouting/progress/${userId}`);

export const startVoiceSession = (clipId: string) =>
  api<{ signedUrl: string | null; dynamicVariables: Record<string, string | number>; fallbackAudioUrl: string | null; error?: string }>(
    '/api/voice/session',
    { method: 'POST', body: JSON.stringify({ clipId }) },
  );
