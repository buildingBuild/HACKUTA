// AI highlight reel (Joe): analyzed clips split into Pro / Funny / Content.
// Used by the onboarding profile preview and under the profile on Home + /u/:handle.
import { useEffect, useState } from 'react';
import { api } from '../../components/api';
import { platformOf, type RealClip } from './api';
import './clips.css';

export type RealTab = 'all' | 'pro' | 'funny' | 'content';
export const REAL_TABS: { id: RealTab; label: string }[] = [
  { id: 'all', label: 'All clips' },
  { id: 'pro', label: 'Pro plays' },
  { id: 'funny', label: 'Funny moments' },
  { id: 'content', label: 'Content' },
];
const SRC = {
  twitch: { icon: '/brand/social/twitch.svg', label: 'Twitch' },
  youtube: { icon: '/brand/social/youtube.svg', label: 'YouTube' },
  folder: { icon: '/brand/social/folder.svg', label: 'Your folder' },
};

/** One analyzed clip: plays muted on loop, AI category/score/reason, link to the exact moment. */
export function RealClipCard({ clip, i }: { clip: RealClip; i: number }) {
  const src = SRC[platformOf(clip)];
  return (
    <article className="rc rise" style={{ ['--i' as string]: Math.min(i, 8) }}>
      <div className="rc__media">
        <video src={clip.blob_url} poster={clip.thumbnail_url ?? undefined} muted loop autoPlay playsInline preload="metadata" />
        <span className={`rc__cat rc__cat--${clip.category}`}>{clip.category}</span>
        <span className="rc__score">{clip.ai_score}</span>
      </div>
      <div className="rc__body">
        <h3>{clip.title}</h3>
        <p>{clip.ai_reason}</p>
        <footer>
          <span className="rc__src"><img src={src.icon} alt="" /> {src.label}</span>
          {clip.social_post_url && <a href={clip.social_post_url} target="_blank" rel="noopener noreferrer">Original moment ↗</a>}
        </footer>
        {clip.ai_rules?.length ? <div className="rc__rules">{clip.ai_rules.map((r) => <span key={r}>{r.replace('_', ' ')}</span>)}</div> : null}
      </div>
    </article>
  );
}


/** Fetches a player's analyzed clips by handle and renders the categorized reel (nothing if they have none). */
export function ClipReel({ handle }: { handle: string }) {
  const [clips, setClips] = useState<RealClip[] | null>(null);
  const [tab, setTab] = useState<RealTab>('all');
  useEffect(() => {
    let live = true;
    api<{ clips: RealClip[] }>(`/api/clips?handle=${encodeURIComponent(handle)}`)
      .then((r) => live && setClips(r.clips.filter((c) => c.category).sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0))))
      .catch(() => live && setClips([]));
    return () => {
      live = false;
    };
  }, [handle]);
  if (!clips?.length) return null;
  const shown = clips.filter((c) => tab === 'all' || c.category === tab);
  const avg = Math.round(clips.reduce((a, c) => a + (c.ai_score ?? 0), 0) / clips.length);
  return (
    <section className="reel" aria-labelledby="reel-h">
      <header className="reel__head">
        <div>
          <p className="reel__kicker"><span /> AI highlight reel · {clips.length} clips · avg score {avg}</p>
          <h2 id="reel-h">Best moments</h2>
        </div>
        <nav className="reel__tabs" aria-label="Clip categories">
          {REAL_TABS.map((t) => (
            <button key={t.id} type="button" className={tab === t.id ? 'is-on' : ''} onClick={() => setTab(t.id)}>
              {t.label}
              <span>{t.id === 'all' ? clips.length : clips.filter((c) => c.category === t.id).length}</span>
            </button>
          ))}
        </nav>
      </header>
      <div key={tab} className="rc-grid">
        {shown.map((c, i) => (
          <RealClipCard key={c.id} clip={c} i={i} />
        ))}
      </div>
    </section>
  );
}
