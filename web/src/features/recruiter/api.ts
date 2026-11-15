import { api } from '../coaching/api';
import type { CoachingNote, ScoutProgress } from '../coaching/types';

export type ProspectStatus = 'new' | 'reviewing' | 'contacted' | 'passed';
export const STATUSES: ProspectStatus[] = ['new', 'reviewing', 'contacted', 'passed'];

export interface Prospect {
  id: string;
  user_id: string;
  track: 'player' | 'creator';
  rule_id: string;
  summary: string;
  status: ProspectStatus;
  audio_url: string | null;
  created_at: string;
  score: number | null;
  metrics: Record<string, number | null> | null;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  region: string | null;
  faceit_level: number | null;
  faceit_elo: number | null;
  faceit_nickname: string | null;
}

export interface ProspectDetailData {
  report: Prospect & { evidence: { score?: number; criteria?: ScoutProgress['rules'][number]['criteria']; summary_source?: string } };
  trend: ({ day: string } & Record<string, number | string>)[];
  topClips: {
    id: string; title: string | null; map: string | null; side: string | null; blob_url: string;
    overall_score: number; notes: CoachingNote[]; summary: string | null; created_at: string;
  }[];
  progress: ScoutProgress;
}

export interface ProspectFilters { track?: string; status?: string; region?: string; minLevel?: number }

export function listProspects(f: ProspectFilters = {}) {
  const q = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => v !== undefined && v !== '' && q.set(k, String(v)));
  return api<{ prospects: Prospect[] }>(`/api/scouting/prospects${q.size ? `?${q}` : ''}`);
}

export const getProspect = (id: string) => api<ProspectDetailData>(`/api/scouting/prospects/${id}`);

export const setProspectStatus = (id: string, status: ProspectStatus) =>
  api<{ id: string; status: ProspectStatus }>(`/api/scouting/prospects/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });

export interface RuleCriterion { metric: string; op: string; value: number; label?: string }
export interface Rule { id: string; track: 'player' | 'creator'; enabled: boolean; label?: string; window?: string; all: RuleCriterion[] }
export interface RulesFile { version: number; rules: Rule[] }

export const getRules = () => api<RulesFile>('/api/scouting/rules');
export const saveRules = (rules: Rule[]) => api<RulesFile>('/api/scouting/rules', { method: 'PUT', body: JSON.stringify({ rules }) });

/** Generates (or returns cached) ElevenLabs briefing audio. On 503 the error body carries `text` for browser TTS. */
export const getBriefing = (reportId: string) =>
  api<{ audio_url: string; text: string; cached: boolean }>(`/api/voice/briefing/${reportId}`, { method: 'POST' });
