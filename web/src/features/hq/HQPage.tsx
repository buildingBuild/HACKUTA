// FaZe HQ page (Joe): ONE profile used everywhere: Home (/ for you), /u/:handle (everyone else),
// and where onboarding lands after "FaZe up". Built around the AI highlight reel, with Omar's fan
// profile pieces (bio, badges, activity, FACEIT, share card, scout celebration) reused as-is.
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../components/api';
import { FazeLogo } from '../../components/FazeLogo';
import { useSessionUser } from '../../components/session';
import { platformOf, type RealClip } from '../clips/api';
import { REAL_TABS, RealClipCard, type RealTab } from '../clips/ClipReel';
import { WEEKS, activityGrid } from '../onboarding/ProfilePreview';
import { fetchProfile } from '../profile/api';
import { Avatar, LevelBadge, StateBox } from '../profile/components';
import { FaceitLink } from '../profile/FaceitLink';
import { ActivityPanel, BioEditor, FanBadges, joinedLabel } from '../profile/FanSections';
import { fmtNum } from '../profile/format';
import { RecruiterLens } from '../profile/RecruiterLens';
import { ScoutCelebration, useScoutCelebration } from '../profile/ScoutCelebration';
import { ShareCard } from '../profile/ShareCard';
import type { Profile } from '../profile/types';
import { usePolling } from '../profile/usePolling';
import { TimelineTeaser } from '../timeline';
import '../profile/profile.css';
import './hq.css';

const SRC_ICON: Record<string, string> = {
  twitch: '/brand/social/twitch.svg',
  youtube: '/brand/social/youtube.svg',
  folder: '/brand/social/folder.svg',
  faceit: '/brand/social/faceit.svg',
  psn: '/brand/social/playstation.svg',
  xbox: '/brand/social/xbox.svg',
};
const SRC_LABEL: Record<string, string> = { twitch: 'Twitch', youtube: 'YouTube', folder: 'Your folder', faceit: 'FACEIT', psn: 'PSN', xbox: 'Xbox', steam: 'Steam' };
const CAT_LABEL: Record<string, string> = { pro: 'Pro play', funny: 'Funny moment', content: 'Content' };

// accounts without a picture get one of the HQ avatars, picked by handle (display only)
const AVATARS = ['meme-buffdoge.jpg', 'meme-cheems.jpg', 'meme-pikachu.jpg', 'meme-monkey.jpg', 'meme-gru.jpg', 'meme-pooh.jpg', 'meme-kalm.jpg', 'meme-smudge.jpg', 'anime-ren.svg', 'anime-kaito.svg', 'anime-yuki.svg', 'anime-hikari.svg', 'anime-sora.svg', 'anime-nao.svg'];
const avatarFor = (handle: string, url: string | null) =>
  url ?? `/avatars/${AVATARS[[...handle].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATARS.length]}`;

const STAT_TILES = [
  { key: 'elo', label: 'ELO', digits: 0 },
  { key: 'kd', label: 'K/D', digits: 2 },
  { key: 'hs_pct', label: 'HS%', digits: 0 },
  { key: 'adr', label: 'ADR', digits: 0 },
  { key: 'win_rate', label: 'Win %', digits: 0 },
] as const;

function usePoints(enabled: boolean) {
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    api<{ balance: number | null }>('/api/rewards/me')
      .then((r) => live && setBalance(r.balance))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [enabled]);
  return balance;
}

function useClips(handle: string) {
  const [clips, setClips] = useState<RealClip[] | null>(null);
  useEffect(() => {
    let live = true;
    api<{ clips: RealClip[] }>(`/api/clips?handle=${encodeURIComponent(handle)}`)
      .then((r) => live && setClips(r.clips.filter((c) => c.category).sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0))))
      .catch(() => live && setClips([]));
    return () => {
      live = false;
    };
  }, [handle]);
  return clips;
}

/** Big player for the featured clip: muted autoplay, click for sound. */
function Featured({ clip }: { clip: RealClip }) {
  const [sound, setSound] = useState(false);
  const src = platformOf(clip);
  return (
    <div className="hqp-feature">
      <div className="hqp-feature__media">
        <video key={clip.id} src={clip.blob_url} poster={clip.thumbnail_url ?? undefined} autoPlay loop playsInline muted={!sound} controls={sound} />
        {!sound && (
          <button type="button" className="hqp-feature__sound" onClick={() => setSound(true)}>
            🔈 Play with sound
          </button>
        )}
        <span className={`hqp-cat hqp-cat--${clip.category}`}>{CAT_LABEL[clip.category ?? ''] ?? clip.category}</span>
      </div>
      <div className="hqp-feature__info">
        <div className="hqp-feature__score">
          <b>{clip.ai_score}</b>
          <span>AI score</span>
        </div>
        <div className="hqp-feature__text">
          <h3>{clip.title}</h3>
          <p>{clip.ai_reason}</p>
          <div className="hqp-feature__meta">
            <span className="hqp-src">
              <img src={SRC_ICON[src]} alt="" /> {SRC_LABEL[src]}
            </span>
            {clip.ai_rules?.map((r) => (
              <span key={r} className="hqp-rule">
                {r.replace('_', ' ')}
              </span>
            ))}
            {clip.social_post_url && (
              <a href={clip.social_post_url} target="_blank" rel="noopener noreferrer">
                Original moment ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HQPage({ handle }: { handle: string }) {
  const { data, error, loading, refresh } = usePolling(() => fetchProfile(handle), [handle], 15_000);
  if (loading && !data) return <div className="pf-root"><StateBox kind="loading">Loading HQ…</StateBox></div>;
  if (!data) return <div className="pf-root"><StateBox kind="error">Couldn't load @{handle}. {error?.message}</StateBox></div>;
  return <HQView p={data} refresh={() => void refresh(true)} />;
}

function HQView({ p, refresh }: { p: Profile; refresh: () => void }) {
  const { user: viewer } = useSessionUser();
  const isMe = viewer?.id === p.user.id;
  const isStaff = viewer?.role === 'recruiter' || viewer?.role === 'admin';
  const [bio, setBio] = useState<string | null>(p.user.bio);
  const clips = useClips(p.user.handle);
  const points = usePoints(isMe);
  const celebration = useScoutCelebration(p.scout);
  const [tab, setTab] = useState<RealTab>('all');
  const [featuredId, setFeaturedId] = useState<string | null>(null);

  const name = p.user.display_name;
  const level = p.game?.faceit_level ?? null;
  const reel = clips ?? [];
  const has = reel.length > 0;
  const featured = reel.find((c) => c.id === featuredId) ?? reel[0];
  const picks = useMemo(
    () => (['pro', 'funny', 'content'] as const).map((cat) => reel.find((c) => c.category === cat)).filter((c): c is RealClip => !!c),
    [reel],
  );
  const shown = reel.filter((c) => tab === 'all' || c.category === tab);
  const avg = has ? Math.round(reel.reduce((a, c) => a + (c.ai_score ?? 0), 0) / reel.length) : 0;
  const sources = [...new Set(reel.map(platformOf))];
  const activity = useMemo(() => activityGrid(p.user.handle), [p.user.handle]);
  const hasStats = Object.keys(p.stats).length > 0;
  const mosaic = reel.filter((c) => c.thumbnail_url).slice(0, 8);

  return (
    <div className="hqp">
      {celebration.show && <ScoutCelebration handle={p.user.handle} displayName={name} isMe={isMe} onClose={celebration.dismiss} />}

      {/* ---------- hero ---------- */}
      <header className={`hqp-hero ${mosaic.length ? 'hqp-hero--mosaic' : ''}`}>
        {mosaic.length > 0 && (
          <div className="hqp-hero__mosaic" aria-hidden="true">
            {[...mosaic, ...mosaic].slice(0, 12).map((c, i) => (
              <img key={`${c.id}-${i}`} src={c.thumbnail_url!} alt="" style={{ ['--i' as string]: i }} />
            ))}
          </div>
        )}
        <FazeLogo className="hqp-hero__mark" />
        <div className="hqp-hero__inner">
          <div className="hqp-hero__avatar">
            <Avatar name={name} url={avatarFor(p.user.handle, p.user.avatar_url)} size={132} />
            {level !== null && <LevelBadge level={level} size="md" />}
          </div>
          <div className="hqp-hero__id">
            <p className="hqp-kicker">
              <span /> {isMe ? 'Your HQ' : 'FaZe HQ'} · {joinedLabel(p.user.created_at)}
            </p>
            <h1>
              {name}
              <em>.</em>
            </h1>
            <p className="hqp-hero__handle">@{p.user.handle}</p>
            <div className="hqp-chips">
              {p.linked_accounts.map((a) => {
                const chip = (
                  <>
                    {SRC_ICON[a.platform] && <img src={SRC_ICON[a.platform]} alt="" />}
                    {SRC_LABEL[a.platform] ?? a.platform} · {a.handle}
                  </>
                );
                return a.url ? (
                  <a key={`${a.platform}${a.handle}`} className="hqp-chip" href={a.url} target="_blank" rel="noopener noreferrer">
                    {chip}
                  </a>
                ) : (
                  <span key={`${a.platform}${a.handle}`} className="hqp-chip">
                    {chip}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="hqp-hero__side">
            {isMe && points !== null && (
              <a className="hqp-points" href="/rewards">
                <b>{fmtNum(points)}</b>
                <span>FaZe Points →</span>
              </a>
            )}
            {isMe && (
              <a className="hqp-btn hqp-btn--ghost" href="/join">
                + Link more clips
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ---------- stats ---------- */}
      <section className="hqp-stats">
        <div className="hqp-stat">
          <span>Clips analyzed</span>
          <b>{reel.length}</b>
          <small>{has ? `from ${sources.map((s) => SRC_LABEL[s]).join(' + ')}` : 'link Twitch, YouTube or a folder'}</small>
        </div>
        <div className="hqp-stat">
          <span>Avg AI score</span>
          <b>{has ? avg : '–'}</b>
          <small>pro + funny + content</small>
        </div>
        <div className="hqp-stat">
          <span>Top play</span>
          <b className="is-red">{has ? reel[0].ai_score : '–'}</b>
          <small>{has ? reel[0].title : 'no clips yet'}</small>
        </div>
        <div className="hqp-stat">
          <span>Karma</span>
          <b>{fmtNum(p.karma)}</b>
          <small>
            {p.activity.thread_count} threads · {p.activity.comment_count} replies
          </small>
        </div>
        <div className="hqp-stat hqp-stat--graph">
          <span>Activity</span>
          <div className="act" role="img" aria-label={`Active on ${activity.active} days over the last ${WEEKS} weeks`}>
            {activity.cells.map((lvl, i) => (
              <span key={i} className={`act__cell act__cell--${lvl}`} style={{ ['--i' as string]: i }} />
            ))}
          </div>
          <small>
            {activity.active} active days · best streak {activity.streak}
          </small>
        </div>
      </section>

      {isStaff && (
        <div className="pf-root hqp-embed">
          <RecruiterLens scout={p.scout} displayName={name} />
        </div>
      )}

      {/* ---------- featured ---------- */}
      {has && featured && (
        <section className="hqp-section">
          <div className="hqp-section__head">
            <div>
              <p className="hqp-kicker">
                <span /> Featured · picked by AI
              </p>
              <h2>Top play</h2>
            </div>
          </div>
          <div className="hqp-featured">
            <Featured clip={featured} />
            <aside className="hqp-picks">
              <p className="hqp-picks__label">Best in each category</p>
              {picks.map((c) => (
                <button key={c.id} type="button" className={`hqp-pick ${c.id === featured.id ? 'is-on' : ''}`} onClick={() => setFeaturedId(c.id)}>
                  <img src={c.thumbnail_url ?? ''} alt="" />
                  <span>
                    <em className={`hqp-cat hqp-cat--${c.category}`}>{CAT_LABEL[c.category ?? '']}</em>
                    <b>{c.title}</b>
                  </span>
                  <i>{c.ai_score}</i>
                </button>
              ))}
            </aside>
          </div>
        </section>
      )}

      {/* ---------- reel + sidebar ---------- */}
      <div className="hqp-main">
        <section className="hqp-section hqp-reel">
          <div className="hqp-section__head">
            <div>
              <p className="hqp-kicker">
                <span /> Highlight reel · sorted by AI
              </p>
              <h2>Every clip</h2>
            </div>
            {has && (
              <nav className="hqp-tabs" aria-label="Clip categories">
                {REAL_TABS.map((t) => (
                  <button key={t.id} type="button" className={tab === t.id ? 'is-on' : ''} onClick={() => setTab(t.id)}>
                    {t.label}
                    <span>{t.id === 'all' ? reel.length : reel.filter((c) => c.category === t.id).length}</span>
                  </button>
                ))}
              </nav>
            )}
          </div>
          {clips === null ? (
            <div className="hqp-skel" />
          ) : has ? (
            <div key={tab} className="rc-grid hqp-grid">
              {shown.map((c, i) => (
                <RealClipCard key={c.id} clip={c} i={i} />
              ))}
            </div>
          ) : (
            <div className="hqp-empty">
              <FazeLogo className="hqp-empty__mark" />
              <h3>{isMe ? 'Your reel is empty.' : 'No clips yet.'}</h3>
              <p>
                {isMe
                  ? 'Link your Twitch, YouTube or a folder of recordings. Our AI finds your best moments and sorts them into pro plays, funny moments and content.'
                  : `When @${p.user.handle} links their videos, their best moments show up here.`}
              </p>
              {isMe && (
                <a className="hqp-btn" href="/join">
                  Bring your highlights →
                </a>
              )}
            </div>
          )}
        </section>

        <aside className="pf-root hqp-side">
          <section className="pf-card hqp-bio">
            <p className="pf-label">About</p>
            <BioEditor handle={p.user.handle} bio={bio} canEdit={isMe} onSaved={setBio} />
          </section>
          {hasStats && (
            <section className="pf-card hqp-game">
              <p className="pf-label">CS2 stats · FACEIT{p.elo_rank ? ` · #${p.elo_rank.rank} of ${p.elo_rank.total}` : ''}</p>
              <div className="hqp-game__grid">
                {STAT_TILES.map((t) => (
                  <div key={t.key}>
                    <b>{p.stats[t.key] ? fmtNum(p.stats[t.key]!.value, t.digits) : '–'}</b>
                    <span>{t.label}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
          <FanBadges profile={p} />
          {isMe && <FaceitLink handle={p.user.handle} userId={p.user.id} nickname={p.game?.faceit_nickname ?? null} onSynced={refresh} compact />}
          <ActivityPanel activity={p.activity} isMe={isMe} karma={p.karma} />
          <ShareCard handle={p.user.handle} displayName={name} />
        </aside>
      </div>

      <div className="hqp-tree">
        <TimelineTeaser />
      </div>
    </div>
  );
}
