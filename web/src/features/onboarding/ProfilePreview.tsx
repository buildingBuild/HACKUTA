import { useMemo, useState } from 'react';
import { REAL_TABS, RealClipCard, type RealTab } from '../clips/ClipReel';
import type { RealClip } from '../clips/api';
import { ClipFrame } from './ClipFrame';
import { CATEGORIES, handleFor, linkedSources, makeClips, type ClipCategory } from './clips';
import { GAMES, type OnboardingData } from './types';
import './profile-preview.css';

/**
 * First look at the player's profile right after onboarding.
 * NOTE: the real public profile (/u/:handle) is Omar's feature in features/profile/.
 * This preview uses demo clips + mocked stats (onboarding eye candy, not real data).
 */

type Tab = 'all' | ClipCategory;

export const WEEKS = 20;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Stable demo contribution history per profile, combined with saved clip dates. */
export function activityGrid(clips: readonly RealClip[], seed = "demo") {
  const n = WEEKS * 7;
  const dayNumber = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
  const today = dayNumber(new Date());
  const counts = Array<number>(n).fill(0);
  const byDay = Array<number>(7).fill(0);
  for (const clip of clips) {
    if (!clip.created_at) continue;
    const date = new Date(clip.created_at);
    if (!Number.isFinite(date.getTime())) continue;
    const index = dayNumber(date) - (today - n + 1);
    if (index < 0 || index >= n) continue;
    counts[index]++;
    byDay[date.getDay()]++;
  }
  // Demo history: keep the same populated days on every visit for this player.
  let state = [...seed].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 17);
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const target = 10 + Math.floor(random() * 21);
  const empty = counts.map((count, index) => ({ count, index })).filter((day) => !day.count);
  for (let i = empty.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [empty[i], empty[j]] = [empty[j], empty[i]];
  }
  const missing = Math.max(0, target - counts.filter(Boolean).length);
  for (const { index } of empty.slice(0, missing)) counts[index] = 1 + Math.floor(random() * 6);
  const active = counts.filter(Boolean).length;
  let streak = 0;
  let run = 0;
  for (const count of counts) {
    run = count ? run + 1 : 0;
    streak = Math.max(streak, run);
  }
  const topDay = DAYS[byDay.indexOf(Math.max(...byDay))];
  const cells = counts.map((c) => (c === 0 ? 0 : c === 1 ? 1 : c <= 2 ? 2 : c <= 4 ? 3 : 4));
  return { cells, active, streak, topDay };
}

interface Props {
  data: OnboardingData;
  onEdit: () => void;
  /** set once the player is saved (Omar's /u/:handle) */
  profileUrl?: string;
  saveError?: string | null;
  /** analyzed clips from the pipeline (replaces the demo clips when present) */
  real?: RealClip[] | null;
}

export function ProfilePreview({ data, onEdit, profileUrl, saveError, real }: Props) {
  const [realTab, setRealTab] = useState<RealTab>('all');
  const clips = useMemo(() => makeClips(data), [data]);
  const sources = useMemo(() => linkedSources(data), [data]);
  const game = GAMES.find((g) => g.id === data.game);
  const [tab, setTab] = useState<Tab>('all');

  const shown = tab === 'all' ? clips : clips.filter((c) => c.category === tab);
  const plays = clips.filter((c) => c.category === 'highlights' || c.category === 'clutches');
  const avg = Math.round(plays.reduce((a, c) => a + c.score, 0) / Math.max(1, plays.length));
  const bestClip = plays.reduce((b, c) => (c.score > b.score ? c : b), plays[0] ?? clips[0]);
  const best = bestClip.score;
  const hasReal = !!real?.length;
  const realAvg = hasReal ? Math.round(real!.reduce((a, c) => a + (c.ai_score ?? 0), 0) / real!.length) : 0;
  const realBest = hasReal ? real![0] : null;
  const realShown = hasReal ? real!.filter((c) => realTab === 'all' || c.category === realTab) : [];
  const activity = useMemo(() => activityGrid(real ?? [], data.gamertag), [real, data.gamertag]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'all', label: 'All clips', count: clips.length },
    ...CATEGORIES.map((c) => ({ id: c.id, label: c.label, count: clips.filter((x) => x.category === c.id).length })),
  ];

  return (
    <div className="pf">
      <section className="pf__head">
        <div className="pf__avatar rise" style={{ ['--i' as string]: 0 }}>
          {(data.gamertag[0] ?? '?').toUpperCase()}
          <span className="pf__level" title="HQ level">
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
          <span className="stat__value">{hasReal ? real!.length : clips.length}</span>
          <span className="stat__sub">{hasReal ? 'analyzed by AI' : `across ${sources.length} sources`}</span>
        </div>
        <div className="stat">
          <span className="stat__label">{hasReal ? 'Avg AI score' : 'Avg hype'}</span>
          <span className="stat__value">{hasReal ? realAvg : avg}</span>
          <span className="stat__sub">{hasReal ? 'pro + funny + content' : 'highlights + clutches'}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Best clip</span>
          <span className="stat__value stat__value--red">{realBest ? realBest.ai_score : best}</span>
          <span className="stat__sub">{realBest ? realBest.title : `${bestClip.title} · ${bestClip.map[0]}`}</span>
        </div>
        <div className="stat stat--wide">
          <span className="stat__label">Clip activity</span>
          <div className="act" role="img" aria-label={`Active on ${activity.active} days over the last ${WEEKS} weeks`}>
            {activity.cells.map((lvl, i) => (
              <span key={i} className={`act__cell act__cell--${lvl}`} style={{ ['--i' as string]: i }} />
            ))}
          </div>
          <span className="stat__sub">
            {activity.active} {activity.active === 1 ? 'day' : 'days'} of clip contributions
          </span>
        </div>
      </section>

      {hasReal ? (
        <>
          <nav className="pf__tabs rise" style={{ ['--i' as string]: 4 }} aria-label="Clip categories">
            {REAL_TABS.map((t) => (
              <button key={t.id} type="button" className={`pf__tab ${realTab === t.id ? 'pf__tab--on' : ''}`} onClick={() => setRealTab(t.id)}>
                {t.label}
                <span className="pf__count">{t.id === 'all' ? real!.length : real!.filter((c) => c.category === t.id).length}</span>
              </button>
            ))}
          </nav>
          <div key={realTab} className="rc-grid">
            {realShown.map((c, i) => (
              <RealClipCard key={c.id} clip={c} i={i} />
            ))}
          </div>
        </>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
