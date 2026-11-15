import { useMemo, useState } from 'react';
import { ClipFrame } from './ClipFrame';
import { CATEGORIES, handleFor, linkedSources, makeClips, type ClipCategory } from './clips';
import { GAMES, type OnboardingData } from './types';
import './profile-preview.css';

/**
 * First look at the player's profile right after onboarding.
 * NOTE: the real public profile (/u/:handle) is Omar's feature in features/profile/.
 * This preview uses demo clips + mocked stats until clips, coaching and scouting are wired.
 */

type Tab = 'all' | ClipCategory;

interface Props {
  data: OnboardingData;
  onEdit: () => void;
  /** set once the player is saved (Omar's /u/:handle) */
  profileUrl?: string;
  saveError?: string | null;
}

export function ProfilePreview({ data, onEdit, profileUrl, saveError }: Props) {
  const clips = useMemo(() => makeClips(data), [data]);
  const sources = useMemo(() => linkedSources(data), [data]);
  const game = GAMES.find((g) => g.id === data.game);
  const [tab, setTab] = useState<Tab>('all');

  const shown = tab === 'all' ? clips : clips.filter((c) => c.category === tab);
  const plays = clips.filter((c) => c.category === 'highlights' || c.category === 'clutches');
  const avg = Math.round(plays.reduce((a, c) => a + c.score, 0) / Math.max(1, plays.length));
  const bestClip = plays.reduce((b, c) => (c.score > b.score ? c : b), plays[0] ?? clips[0]);
  const best = bestClip.score;
  // mocked until Yao's scouting score is available (reads, doesn't recompute)
  const scout = Math.min(96, Math.round(avg * 0.82));

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'all', label: 'All clips', count: clips.length },
    ...CATEGORIES.map((c) => ({ id: c.id, label: c.label, count: clips.filter((x) => x.category === c.id).length })),
  ];

  return (
    <div className="pf">
      <section className="pf__head">
        <div className="pf__avatar rise" style={{ ['--i' as string]: 0 }}>
          {(data.gamertag[0] ?? '?').toUpperCase()}
          <span className="pf__level" title="FACEIT level (synced after linking)">
            10
          </span>
        </div>

        <div className="pf__id">
          <p className="kicker rise" style={{ ['--i' as string]: 0 }}>
            <span className="kicker__bar" /> Welcome to HQ
          </p>
          <h1 className="pf__name rise" style={{ ['--i' as string]: 1 }}>
            {data.gamertag}
          </h1>
          <div className="pf__links rise" style={{ ['--i' as string]: 2 }}>
            {game && (
              <span className="pf__chip pf__chip--game">
                <img src={data.game === 'cs2' ? '/brand/social/counterstrike.svg' : game.logo} alt="" />
                {game.code}
              </span>
            )}
            {sources.map((s) => (
              <span key={s.key} className="pf__chip" title={s.label}>
                <img src={s.icon} alt="" />
                {handleFor(s, data)}
              </span>
            ))}
          </div>
        </div>

        <div className="pf__cta rise" style={{ ['--i' as string]: 2 }}>
          <button type="button" className="btn-square" onClick={onEdit} aria-label="Edit answers" title="Edit answers">
            ←
          </button>
          {profileUrl && (
            <a className="btn-ghost-box" href={profileUrl}>
              Public profile ↗
            </a>
          )}
          <button type="button" className="btn" title="Clip upload is the next screen">
            Upload a clip <span className="btn__arrow">→</span>
          </button>
        </div>
      </section>

      {saveError && (
        <p className="pf__notice rise" style={{ ['--i' as string]: 3 }}>
          <span className="pf__notice-dot" /> Profile not saved yet: {saveError}. This is a preview; your answers are kept in
          this browser.
        </p>
      )}

      <section className="pf__stats rise" style={{ ['--i' as string]: 3 }}>
        <div className="stat">
          <span className="stat__label">Clips found</span>
          <span className="stat__value">{clips.length}</span>
          <span className="stat__sub">across {sources.length} sources</span>
        </div>
        <div className="stat">
          <span className="stat__label">Avg AI score</span>
          <span className="stat__value">{avg}</span>
          <span className="stat__sub">highlights + clutches</span>
        </div>
        <div className="stat">
          <span className="stat__label">Best clip</span>
          <span className="stat__value stat__value--red">{best}</span>
          <span className="stat__sub">
            {bestClip.title} · {bestClip.map[0]}
          </span>
        </div>
        <div className="stat stat--wide">
          <span className="stat__label">Scout progress</span>
          <span className="stat__value">
            {scout}
            <small>%</small>
          </span>
          <span className="scout">
            <span className="scout__fill" style={{ ['--w' as string]: `${scout}%` }} />
            <span className="scout__mark" title="Scouting threshold" />
          </span>
          <span className="stat__sub">Keep posting. Cross the line and FaZe gets your report.</span>
        </div>
      </section>

      <nav className="pf__tabs rise" style={{ ['--i' as string]: 4 }} aria-label="Clip categories">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`pf__tab ${tab === t.id ? 'pf__tab--on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <span className="pf__count">{t.count}</span>
          </button>
        ))}
      </nav>

      <div key={tab} className="pf__grid">
        {shown.map((c, i) => (
          <ClipFrame key={c.id} clip={c} gamertag={data.gamertag} delay={240 + i * 45} scored scoreDelay={500 + i * 45} />
        ))}
      </div>
    </div>
  );
}
