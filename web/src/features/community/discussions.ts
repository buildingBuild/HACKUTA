import type { Community, Sort, Thread } from './types';
export const TOPICS = ['CS2', 'Talent Watch', 'FaZe History', 'Trickshots', 'General', 'Events', 'Challenges'] as const;
export type Topic = typeof TOPICS[number];
export const TOPIC_BOARD: Record<Topic, string> = { CS2: 'faze-cs2', 'Talent Watch': 'talent-watch', 'FaZe History': 'faze-history', Trickshots: 'clips', General: 'faze-cs2', Events: 'events', Challenges: 'clips' };
export function threadTopic(thread: Thread, boards: Community[]): Topic {
  if (thread.type === 'challenge') return 'Challenges';
  const explicit = TOPICS.find(topic => thread.body?.startsWith(`#${topic}\n\n`));
  if (explicit) return explicit;
  const slug = boards.find(b => b.id === thread.community_id)?.slug;
  return TOPICS.find(topic => TOPIC_BOARD[topic] === slug) ?? 'General';
}
export function sortThreads(threads: Thread[], sort: Sort, now = Date.now()): Thread[] {
  const hot = (t: Thread) => t.score / Math.pow(2 + Math.max(0, (now - Date.parse(t.created_at)) / 3600000), 1.5);
  return [...threads].sort((a,b) => (sort === 'new' ? 0 : sort === 'top' ? b.score-a.score : hot(b)-hot(a)) || Date.parse(b.created_at)-Date.parse(a.created_at) || a.id.localeCompare(b.id));
}
