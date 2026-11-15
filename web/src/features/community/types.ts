export interface User { id: string; handle: string; display_name: string; avatar_url?: string | null }
export interface Community { id: string; slug: string; name: string; description: string }
export interface Clip { id: string; title: string; blob_url: string; game?: string; user_id?: string; handle?: string }
export interface Thread { id: string; community_id: string; user_id: string; type: 'post' | 'challenge'; title: string; body: string; clip_id: string | null; score: number; created_at: string; author: User; comment_count: number; viewer_vote: number; clip?: Clip | null }
export interface Comment { id: string; thread_id: string; parent_id: string | null; user_id: string; body: string; clip_id: string | null; score: number; created_at: string; author: User; viewer_vote: number; clip?: Clip | null }
export type Sort = 'hot' | 'new' | 'top';
export interface Envelope<T> { data: T; mode: 'database' | 'demo' }
export type WatchCategory = 'Esports' | 'Podcasts & Commentary' | 'FaZe Legacy' | 'Community';
export interface PollResult { question: string; options: {label: string; votes: number}[]; total: number; selection: number | null }
export interface WatchRoom { id: string; thread_id: string; title: string; category: WatchCategory; source: string; media_url: string; status: 'Replay' | 'Sample' | 'Live' | 'Scheduled'; description: string; poll: {question: string; options: string[]}; poll_result?: PollResult; scheduled_at?: string }
export interface Pulse { title: string; provider: 'curated' | 'deterministic'; generated_at: string; window_days: number; overview: string; topics: string[]; highlights: {thread_id:string; title:string; description:string; score:number; comment_count:number; topic:string}[]; perspectives:{comment_id:string; thread_id:string; author:string; excerpt:string}[]; question:{text:string; thread_id:string}|null }
