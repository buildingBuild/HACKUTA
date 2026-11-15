// FACEIT Data API v4 (https://open.faceit.com/data/v4). Server-side only.
const BASE = 'https://open.faceit.com/data/v4';

export class FaceitError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

async function get<T>(path: string, timeoutMs = 8000): Promise<T> {
  const key = process.env.FACEIT_API_KEY;
  if (!key) throw new FaceitError('FACEIT_API_KEY is not set');
  const res = await fetch(BASE + path, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new FaceitError(`FACEIT ${path} -> ${res.status}`, res.status);
  return (await res.json()) as T;
}

export interface FaceitPlayer {
  player_id: string;
  nickname: string;
  avatar?: string;
  country?: string;
  steam_id_64?: string;
  games?: { cs2?: { region?: string; skill_level?: number; faceit_elo?: number; game_player_id?: string } };
}

/** Lifetime block uses human-readable keys, e.g. "Average K/D Ratio". Values are strings. */
export interface FaceitLifetimeStats {
  player_id: string;
  lifetime: Record<string, string | string[] | undefined>;
}

/** One entry per match; `stats` keys like "K/D Ratio", "Headshots %", "ADR", "Result". */
export interface FaceitMatchStats {
  items: { stats: Record<string, string | number | undefined> }[];
}

export const getPlayerByNickname = (nickname: string) =>
  get<FaceitPlayer>(`/players?nickname=${encodeURIComponent(nickname)}&game=cs2`);

export const getLifetimeStats = (playerId: string) =>
  get<FaceitLifetimeStats>(`/players/${playerId}/stats/cs2`);

export const getRecentMatchStats = (playerId: string, limit = 20) =>
  get<FaceitMatchStats>(`/players/${playerId}/games/cs2/stats?limit=${limit}`);
