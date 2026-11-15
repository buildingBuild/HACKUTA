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

export interface NewClip {
  blob_url: string;
  title?: string;
  map?: string;
  side?: 'T' | 'CT';
}
/** Registers a clip by URL (Joe's real flow uploads to blob storage first, then calls this). */
export const createClip = (clip: NewClip) => api<ClipRow>('/api/clips', { method: 'POST', body: JSON.stringify(clip) });

// ---------- player stats + FACEIT ----------

export interface PlayerStats {
  user_id: string;
  latest: Record<string, number>;
  trend: ({ day: string } & Record<string, number | string>)[];
}
export interface GameAccount {
  faceit_nickname: string | null;
  faceit_player_id: string | null;
  region: string | null;
  faceit_level: number | null;
  faceit_elo: number | null;
}

export const getPlayerStats = (userId: string, days = 30) => api<PlayerStats>(`/api/players/${userId}/stats?days=${days}`);
export const getAccount = (userId: string) => api<{ account: GameAccount | null }>(`/api/players/${userId}/account`);
export const linkFaceit = (userId: string, nickname: string) =>
  api<{ account: GameAccount }>(`/api/players/${userId}/faceit`, { method: 'PUT', body: JSON.stringify({ nickname }) });
export const syncFaceit = (userId: string) =>
  api<{ source: 'faceit' | 'mock' | 'seed'; nickname: string | null; new_matches?: number; error?: string; scouting: AnalyzeResponse['scouting'] }>(
    `/api/players/${userId}/sync`,
    { method: 'POST' },
  );

export const isYouTube = (url: string) => /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(url);
export function youTubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}?enablejsapi=1&rel=0` : null;
}

export const startVoiceSession = (clipId: string) =>
  api<{ signedUrl: string | null; dynamicVariables: Record<string, string | number>; fallbackAudioUrl: string | null; error?: string }>(
    '/api/voice/session',
    { method: 'POST', body: JSON.stringify({ clipId }) },
  );
