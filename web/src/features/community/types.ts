export interface User { id: string; handle: string; display_name: string; avatar_url?: string | null }
export interface Community { id: string; slug: string; name: string; description: string }
export interface Clip { id: string; title: string; blob_url: string; game?: string; user_id?: string }
export interface Thread { id: string; community_id: string; user_id: string; type: 'post' | 'challenge'; title: string; body: string; clip_id: string | null; score: number; created_at: string; author: User; comment_count: number; viewer_vote: number; clip?: Clip | null }
export interface Comment { id: string; thread_id: string; parent_id: string | null; user_id: string; body: string; clip_id: string | null; score: number; created_at: string; author: User; viewer_vote: number; clip?: Clip | null }
export type Sort = 'hot' | 'new' | 'top';
export interface Envelope<T> { data: T; mode: 'database' | 'demo' }
