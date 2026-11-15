import { authHeaders } from '../../components/session';
import type { AnalyzeResponse, CoachingReport, ScoutProgress } from './types';

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

export interface ClipRow {
  id: string;
  user_id: string;
  blob_url: string;
  thumbnail_url: string | null;
  map: string | null;
  side: string | null;
  title: string | null;
  status: 'uploaded' | 'analyzing' | 'done' | 'failed';
  created_at: string;
  handle: string;
  display_name: string | null;
  overall_score: number | null;
}

// Clip reads go through Joe's /api/clips contract (REQUIREMENTS.md §7.4).
export const getClip = (clipId: string) => api<ClipRow>(`/api/clips/${clipId}`);
export const listClips = (userId: string) => api<{ clips: ClipRow[] }>(`/api/clips?userId=${encodeURIComponent(userId)}`);

export const startVoiceSession = (clipId: string) =>
  api<{ signedUrl: string | null; dynamicVariables: Record<string, string | number>; fallbackAudioUrl: string | null; error?: string }>(
    '/api/voice/session',
    { method: 'POST', body: JSON.stringify({ clipId }) },
  );
