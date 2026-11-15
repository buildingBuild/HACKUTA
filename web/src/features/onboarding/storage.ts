import { EMPTY_DATA, type OnboardingData } from './types';

// Browser copy of the answers. The real save is saveOnboardingProfile (POST /api/profiles) at FaZe Up.
const KEY = 'fazehq.onboarding.v1';

export function loadOnboarding(): OnboardingData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY_DATA };
    return { ...EMPTY_DATA, ...(JSON.parse(raw) as Partial<OnboardingData>) };
  } catch {
    return { ...EMPTY_DATA };
  }
}

export function saveOnboarding(data: OnboardingData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage full or blocked: not fatal */
  }
}

/** Turn a pasted URL like https://twitch.tv/name or youtube.com/@name into just the handle. */
export function toHandle(value: string): string {
  const v = value.trim();
  const match = v.match(/(?:twitch\.tv|youtube\.com)\/(?:c\/|channel\/|user\/)?@?([^/?#\s]+)/i);
  if (match) return match[1];
  return v.replace(/^@/, '');
}
