import { authHeaders, signIn } from "../../components/session";
import type { Leaderboard, LeaderboardType, Profile } from "./types";

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { Accept: "application/json", ...authHeaders(), ...init?.headers } });
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
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
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

// ---------- onboarding -> profile ----------

/** The fields onboarding collects (structurally matches Joe's OnboardingData). */
export type OnboardingAnswers = {
  game: string | null;
  gamertag: string;
  twitch?: string;
  youtube?: string;
  psn?: string;
  xbox?: string;
};

export type CreatedProfile = {
  user: { id: string; handle: string; display_name: string; role: string };
  created: boolean;
  profile_url: string;
};

/**
 * Save onboarding answers as a real player, sign them in as that player, and return
 * where to send them. Re-running it as the same player updates their links.
 * Throws ApiError (409 = tag taken, 400 = invalid) with a user-facing message.
 *
 * Usage at the final onboarding step:
 *   const { profile_url } = await saveOnboardingProfile(data);
 *   window.location.assign(profile_url);
 */
export async function saveOnboardingProfile(answers: OnboardingAnswers): Promise<CreatedProfile> {
  const out = await getJson<CreatedProfile>("/api/profiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(answers),
  });
  await signIn(out.user.id).catch(() => undefined); // session cookie for the new player
  return out;
}

// ---------- FACEIT link ----------

export type FaceitSyncResult = {
  source: "faceit" | "mock" | "seed";
  nickname: string | null;
  stats: Record<string, number | null | undefined>;
  error?: string;
  scouting?: { created: { id: string; rule_id: string }[] } | null;
};

/** Save the nickname (Omar's route), then pull stats via Yao's sync route. */
export async function linkFaceit(handle: string, nickname: string): Promise<FaceitSyncResult> {
  const { user_id } = await getJson<{ user_id: string }>(`/api/profiles/${encodeURIComponent(handle)}/faceit`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ faceit_nickname: nickname }),
  });
  return syncFaceit(user_id);
}

export const syncFaceit = (userId: string) =>
  getJson<FaceitSyncResult>(`/api/players/${encodeURIComponent(userId)}/sync`, { method: "POST" });

/** Live availability check for the gamertag step. `handle` is the URL-safe version of the tag. */
export const checkHandle = (gamertag: string) =>
  getJson<{ handle: string; available: boolean; mine?: boolean; reason?: string }>(`/api/handles/${encodeURIComponent(gamertag)}`);
