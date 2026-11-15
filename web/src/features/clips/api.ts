// Clip analysis API (Joe). Server: server/src/routes/clips.ts + server/src/lib/media.
import { api } from '../../components/api';

export interface ClipJob {
  id: string;
  source: string;
  platform: 'twitch' | 'youtube' | 'folder';
  title: string | null;
  status: 'queued' | 'running' | 'done' | 'failed';
  stage: string | null;
  progress: number;
  error: string | null;
  clip_count: number;
}

/** Queue analysis for a video URL, a channel URL (newest `limit` videos) or a local folder path. */
export const startAnalysis = (source: string, limit = 3) =>
  api<{ jobs: { id: string; source: string; title: string | null }[] }>('/api/clips/analyze', {
    method: 'POST',
    body: JSON.stringify({ source, limit }),
  });

export const listJobs = () => api<{ jobs: ClipJob[] }>('/api/clips/jobs');

/** Everything a fresh profile linked during onboarding: Twitch + YouTube channels, local clips folder. */
export function analyzeOnboarding(a: { twitch: string; youtube: string; folder: string }) {
  const sources = [
    a.twitch && `https://www.twitch.tv/${a.twitch}`,
    a.youtube && `https://www.youtube.com/@${a.youtube.replace(/^@/, '')}`,
    (a.folder ?? '').trim(),
  ].filter(Boolean) as string[];
  return Promise.allSettled(sources.map((s) => startAnalysis(s, s.startsWith('http') ? 3 : 10)));
}

export interface RealClip {
  created_at?: string;
  id: string;
  title: string | null;
  category: 'pro' | 'funny' | 'content' | null;
  ai_score: number | null;
  ai_reason: string | null;
  ai_rules: string[] | null;
  blob_url: string;
  thumbnail_url: string | null;
  source_url: string | null;
  social_post_url: string | null;
  start_s: number | null;
  end_s: number | null;
}

export const userClips = (userId: string) =>
  api<{ clips: RealClip[] }>(`/api/clips?userId=${encodeURIComponent(userId)}`).then((r) =>
    r.clips.filter((c) => c.category).sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0)),
  );

export const platformOf = (c: RealClip) =>
  /twitch\.tv/.test(c.source_url ?? '') ? 'twitch' : /youtu/.test(c.source_url ?? '') ? 'youtube' : 'folder';
