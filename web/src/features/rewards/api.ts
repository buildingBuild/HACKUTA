// FaZe Points API (owner: Omar). Server: server/src/routes/rewards.ts
import { api } from '../../components/api';

export interface Challenge {
  id: string;
  title: string;
  blurb: string;
  metric: string;
  target: number;
  points: number;
  period: 'daily' | 'weekly';
  resets_at: string;
  value: number;
  progress: number;
  claimed: boolean;
  claimable: boolean;
}

export interface Reward {
  id: string;
  kind: 'merch' | 'coaching';
  name: string;
  blurb: string | null;
  cost: number;
  stock: number | null;
  options: string[];
  art: string | null;
}

export interface Redemption {
  id: string;
  reward_id: string;
  name: string;
  kind: 'merch' | 'coaching';
  art: string | null;
  cost: number;
  option: string | null;
  status: 'requested' | 'fulfilled' | 'used' | 'cancelled';
  created_at: string;
}

export interface PointEvent {
  time: string;
  delta: number;
  kind: string;
  reason: string;
}

export interface PointsMe {
  signed_in: boolean;
  balance: number | null;
  day_resets_at: string;
  week_resets_at: string;
  /** Best-case points per week if every challenge is finished. */
  weekly_potential: number;
  challenges: Challenge[];
  history: PointEvent[];
  redemptions: Redemption[];
  coaching_credits: number;
}

export const fetchMe = () => api<PointsMe>('/api/rewards/me');
export const fetchCatalog = () => api<{ rewards: Reward[] }>('/api/rewards/catalog').then((r) => r.rewards);
export const claimChallenge = (id: string) =>
  api<{ claimed: string; points: number; balance: number }>(`/api/rewards/challenges/${encodeURIComponent(id)}/claim`, { method: 'POST' });
export const redeem = (reward_id: string, option?: string) =>
  api<{ redemption: { id: string; name: string; kind: string }; balance: number }>('/api/rewards/redeem', {
    method: 'POST',
    body: JSON.stringify({ reward_id, option }),
  });
