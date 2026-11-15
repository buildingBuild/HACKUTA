import type { Clip, Comment, Community, Envelope, Sort, Thread, WatchRoom, PollResult, Pulse } from './types';
export function createCommunityApi(userId: string | undefined, base = '/api') {
  async function request<T>(path: string, body?: unknown): Promise<Envelope<T>> {
    const response = await fetch(`${base}${path}`, {
      credentials: 'same-origin',
      headers: { ...(userId ? { 'x-user-id': userId } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
    });
    const result = await response.json().catch(() => { throw new Error('Community API is unavailable. Please retry when the server is connected.'); });
    if (!response.ok) throw new Error(result.error || 'Community request failed');
    return result as Envelope<T>;
  }
  return {
    pulse: () => request<Pulse>('/community/pulse'),
    rooms: () => request<WatchRoom[]>('/community/watch/rooms'),
    room: (id: string) => request<WatchRoom>(`/community/watch/rooms/${encodeURIComponent(id)}`),
    poll: (id: string, option: number) => request<PollResult>(`/community/watch/rooms/${encodeURIComponent(id)}/poll`, { option }),
    thread: (id: string) => request<Thread>(`/threads/${encodeURIComponent(id)}`),
    boards: () => request<Community[]>('/communities'),
    threads: (slug: string, sort: Sort) => request<Thread[]>(`/communities/${encodeURIComponent(slug)}/threads?sort=${sort}`),
    create: (slug: string, body: { title: string; body: string; clip_id: string | null; type: 'post' | 'challenge' }) => request<Thread>(`/communities/${encodeURIComponent(slug)}/threads`, body),
    comments: (id: string) => request<Comment[]>(`/threads/${encodeURIComponent(id)}/comments`),
    comment: (id: string, body: { body: string; parent_id: string | null; clip_id: string | null }) => request<Comment>(`/threads/${encodeURIComponent(id)}/comments`, body),
    vote: (target_type: 'thread' | 'comment', target_id: string, value: number) => request<{ score: number; viewer_vote: number }>('/votes', { target_type, target_id, value }),
    report: (target_type: 'thread' | 'comment', target_id: string, reason: string) => request<{ message: string }>('/community/reports', { target_type, target_id, reason }),
  };
}
export type CommunityApi = ReturnType<typeof createCommunityApi>;
export type { Clip };
