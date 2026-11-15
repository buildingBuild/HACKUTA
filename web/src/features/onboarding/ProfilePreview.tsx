import { useMemo, useState } from 'react';
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

const WEEKS = 20;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Contribution-style grid of when their imported clips happened (column = week, row = weekday).
 * Mocked from the gamertag like the rest of the preview: busier on weekends, ramping up lately,
 * and today is always lit (they just joined). Replace with real clip dates once ingestion lands.
 */
function activityGrid(seed: string) {
  let s = [...seed].reduce((a, c) => a + c.charCodeAt(0), 11) || 1;
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const n = WEEKS * 7;
  const counts = Array.from({ length: n }, (_, i) => {
    const day = i % 7;
    const week = Math.floor(i / 7);
    const weekend = day === 0 || day === 5 || day === 6 ? 0.35 : 0;
    const recency = (week / WEEKS) * 0.3;
    const p = 0.18 + weekend + recency;
    return r() < p ? 1 + Math.floor(r() * (weekend ? 5 : 3)) : 0;
  });
  counts[n - 1] = Math.max(counts[n - 1], 2); // joined today
  const active = counts.filter(Boolean).length;
  let streak = 0;
  let run = 0;
  for (const c of counts) {
    run = c ? run + 1 : 0;
    streak = Math.max(streak, run);
  }
  const byDay = DAYS.map((_, d) => counts.filter((_, i) => i % 7 === d).reduce((a, b) => a + b, 0));
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
  const activity = useMemo(() => activityGrid(data.gamertag), [data.gamertag]);

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
          <span className="stat__value">{clips.length}</span>
          <span className="stat__sub">across {sources.length} sources</span>
        </div>
        <div className="stat">
          <span className="stat__label">Avg hype</span>
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
          <span className="stat__label">Clip activity</span>
          <div className="act" role="img" aria-label={`Active on ${activity.active} days over the last ${WEEKS} weeks`}>
            {activity.cells.map((lvl, i) => (
              <span key={i} className={`act__cell act__cell--${lvl}`} style={{ ['--i' as string]: i }} />
            ))}
          </div>
          <span className="stat__sub">
            {activity.active} active days in {WEEKS} weeks · best streak {activity.streak} · most active on {activity.topDay}s
          </span>
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
