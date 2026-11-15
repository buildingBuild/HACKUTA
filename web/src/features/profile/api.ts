import type { Leaderboard, LeaderboardType, Profile } from "./types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* not JSON */
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export const profileUrl = (handle: string) => `/u/${encodeURIComponent(handle)}`;
export const cardUrl = (handle: string) => `/api/profiles/${encodeURIComponent(handle)}/card.svg`;

export const fetchProfile = (handle: string) => getJson<Profile>(`/api/profiles/${encodeURIComponent(handle)}`);

export const fetchLeaderboard = (type: LeaderboardType, opts: { limit?: number; window?: number } = {}) => {
  const q = new URLSearchParams();
  if (opts.limit) q.set("limit", String(opts.limit));
  if (opts.window) q.set("window", String(opts.window));
  const qs = q.toString();
  return getJson<Leaderboard>(`/api/leaderboards/${type}${qs ? `?${qs}` : ""}`);
};
