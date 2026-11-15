// Recruiter data for Omar's pipeline board + recruiter lens. Reads Yao's existing routes
// (server/src/routes/scouting.ts); no server changes.
import { authHeaders } from "../../components/session";

export type ProspectStatus = "new" | "reviewing" | "contacted" | "passed";
export const PROSPECT_STATUSES: ProspectStatus[] = ["new", "reviewing", "contacted", "passed"];

export type ProspectRow = {
  id: string;
  user_id: string;
  track: "player" | "creator";
  summary: string;
  status: ProspectStatus;
  created_at: string;
  score: number | null;
  metrics: Record<string, number | null> | null;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  region: string | null;
  faceit_level: number | null;
  faceit_elo: number | null;
};

export type ProspectReport = ProspectRow & {
  rule_id: string;
  evidence: { score?: number; rule_label?: string; summary_source?: string } | null;
};

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...authHeaders(), ...init.headers } });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw Object.assign(new Error(body.error || `HTTP ${res.status}`), { status: res.status, body });
  return body as T;
}

export type ProspectFilters = { track?: string; status?: string; region?: string; minLevel?: number };

export function listProspects(f: ProspectFilters = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== "") q.set(k, String(v));
  const qs = q.toString();
  return call<{ prospects: ProspectRow[] }>(`/api/scouting/prospects${qs ? `?${qs}` : ""}`);
}

export const getProspectReport = (id: string) => call<{ report: ProspectReport }>(`/api/scouting/prospects/${encodeURIComponent(id)}`);

export const setProspectStatus = (id: string, status: ProspectStatus) =>
  call<{ id: string; status: ProspectStatus }>(`/api/scouting/prospects/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) });
