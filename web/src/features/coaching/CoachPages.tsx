// Coaching pages wired into the app shell:
//   /clips/:id  clip + video + AI coach report + scout progress (Joe can swap in his clip
//               detail page later and just embed <CoachingReportPanel clipId onSeek />)
//   /coach      the signed-in player's clips
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchProfile, ScoutProgressBar, type ScoutProgress } from '../profile';
import '../profile/profile.css';
import { getClip, listClips, type ClipRow } from './api';
import { CoachingReportPanel } from './CoachingReportPanel';
import type { SessionUser } from '../../components/session';
import './coaching.css';

function useScout(handle: string | undefined) {
  const [scout, setScout] = useState<ScoutProgress | null>(null);
  const refresh = useCallback(() => {
    if (!handle) return;
    fetchProfile(handle).then((p) => setScout(p.scout), () => setScout(null));
  }, [handle]);
  useEffect(refresh, [refresh]);
  return { scout, refresh };
}

export function ClipCoachPage({ clipId }: { clipId: string }) {
  const [clip, setClip] = useState<ClipRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const { scout, refresh } = useScout(clip?.handle);

  useEffect(() => {
    getClip(clipId).then(setClip, (e: Error) => setError(e.message));
  }, [clipId]);

  if (error) return <div className="yao-page"><p className="yao-error">{error}</p></div>;
  if (!clip) return <div className="yao-page"><p className="yao-muted">Loading clip…</p></div>;

  return (
    <div className="yao-page">
      <p className="yao-eyebrow">
        <a href={`/u/${clip.handle}`}>@{clip.handle}</a> · {clip.map ?? 'CS2'} · {clip.side ?? '—'}
      </p>
      <h1 className="yao-title">{clip.title ?? 'Untitled clip'}</h1>

      {scout && (
        <div className="pf-root yao-scout">
          <ScoutProgressBar scout={scout} />
        </div>
      )}

      <div className="yao-clip-grid">
        <div className="yao-video">
          {videoError ? (
            <div className="yao-video__missing">
              <strong>Video file not found</strong>
              <span>Drop <code>{clip.blob_url.split('/').pop()}</code> into <code>server/demo-clips/</code> to play it.</span>
            </div>
          ) : (
            <video ref={video} src={clip.blob_url} controls playsInline onError={() => setVideoError(true)} />
          )}
        </div>
        <CoachingReportPanel
          clipId={clip.id}
          onSeek={(s) => {
            if (!video.current) return;
            video.current.currentTime = s;
            void video.current.play().catch(() => {});
          }}
          onAnalyzed={refresh}
        />
      </div>
    </div>
  );
}

export function MyClipsPage({ user }: { user: SessionUser | null }) {
  const [clips, setClips] = useState<ClipRow[] | null>(null);
  const { scout } = useScout(user?.handle);

  useEffect(() => {
    if (user) listClips(user.id).then((r) => setClips(r.clips), () => setClips([]));
  }, [user]);

  if (!user) return <div className="yao-page"><p className="yao-muted">Pick a player in <b>Demo login</b> (try <b>Vyper</b>).</p></div>;

  return (
    <div className="yao-page">
      <p className="yao-eyebrow">AI Coach</p>
      <h1 className="yao-title">Your clips</h1>
      {scout && (
        <div className="pf-root yao-scout">
          <ScoutProgressBar scout={scout} />
        </div>
      )}
      {clips === null ? (
        <p className="yao-muted">Loading…</p>
      ) : clips.length === 0 ? (
        <p className="yao-muted">No clips yet. Upload one to get coached.</p>
      ) : (
        <ul className="yao-cliplist">
          {clips.map((c) => (
            <li key={c.id}>
              <a className="yao-cliprow" href={`/clips/${c.id}`}>
                <span className="yao-cliprow__map">{(c.map ?? 'cs2').slice(0, 3)}</span>
                <span className="yao-cliprow__title">
                  <strong>{c.title ?? 'Untitled clip'}</strong>
                  <span className="yao-muted">{c.map ?? '—'} · {c.side ?? '—'} · {new Date(c.created_at).toLocaleDateString()}</span>
                </span>
                {c.overall_score != null ? (
                  <span className="yao-cliprow__score">{c.overall_score}</span>
                ) : (
                  <span className="yao-cliprow__cta">Get coached →</span>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
