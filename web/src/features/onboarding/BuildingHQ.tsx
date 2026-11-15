import { useEffect, useMemo, useState } from 'react';
import { FazeLogo } from '../../components/FazeLogo';
import { platformOf, type RealClip } from '../clips/api';
import { linkedSources, makeClips } from './clips';
import type { OnboardingData } from './types';
import './building.css';

/**
 * "Building your HQ" sequence shown after FaZe Up.
 * Clip frames populate a collage, get AI scores, then the FaZe mark reveals.
 * Frames are drawn in CSS so the demo never depends on video files or Wi-Fi.
 */

type Phase = 'scan' | 'analyze' | 'reveal';

// bento spans for a dynamic collage (index -> [cols, rows])
const SPANS: Record<number, [number, number]> = { 0: [2, 2], 5: [2, 1], 9: [1, 2], 13: [2, 2], 18: [2, 1] };
const TILE_COUNT = 26; // 7 cols x 5 rows with the bento spans above

const SRC_ICON = { twitch: '/brand/social/twitch.svg', youtube: '/brand/social/youtube.svg', folder: '/brand/social/folder.svg' };

/** A real analyzed clip as a collage tile: thumbnail + title + AI score. */
function RealTile({ clip, delay, scored, style }: { clip: RealClip; delay: number; scored: boolean; style: React.CSSProperties }) {
  return (
    <figure className={`frame frame--real ${scored ? 'frame--scored' : ''}`} style={{ ['--d' as string]: `${delay}ms`, ['--sdelay' as string]: `${delay * 0.6}ms`, ['--rot' as string]: '0deg', ...style }}>
      {clip.thumbnail_url && <img className="frame__thumb" src={clip.thumbnail_url} alt="" />}
      <span className="frame__grain" />
      <figcaption className="frame__meta">
        <img src={SRC_ICON[platformOf(clip)]} alt="" />
        <span className="frame__title">{clip.title}</span>
        <span className="frame__time">{clip.category}</span>
      </figcaption>
      <span className="frame__score">{clip.ai_score}</span>
    </figure>
  );
}

export function BuildingHQ({ data, real, waiting, onDone }: { data: OnboardingData; real?: RealClip[] | null; waiting?: boolean; onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('scan');
  const [found, setFound] = useState(0);

  const sources = useMemo(() => linkedSources(data), [data]);

  const total = real?.length ?? 0;

  // same seeded clips the profile shows next; shuffle only the entrance order
  const clips = useMemo(() => makeClips(data, TILE_COUNT), [data]);
  const order = useMemo(() => clips.map((c) => c.id).sort((x, y) => ((x * 7919) % 13) - ((y * 7919) % 13)), [clips]);

  // phase timeline
  useEffect(() => {
    if (waiting) return;
    const t = [
      window.setTimeout(() => setPhase('analyze'), 2700),
      window.setTimeout(() => setPhase('reveal'), 4300),
      window.setTimeout(onDone, 6600),
    ];
    return () => t.forEach(window.clearTimeout);
  }, [onDone, waiting]);

  // clip counter ticking up during the scan
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 2600);
      setFound(Math.round(total * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total]);

  const scanning = sources[Math.min(sources.length - 1, Math.floor((found / Math.max(1, total)) * sources.length))];
  const status =
    phase === 'scan'
      ? `Scanning ${scanning.label}`
      : phase === 'analyze'
        ? 'Building your FaZe HQ'
        : 'HQ online';

  return (
    <div className={`hq hq--${phase}`} onClick={waiting ? undefined : onDone} role="status" aria-live="polite">
      <header className="hq__bar">
        <span className="hq__status">
          <span className="hq__dot" />
          {status}
          <span className="hq__dots" aria-hidden="true">
            <i>.</i>
            <i>.</i>
            <i>.</i>
          </span>
        </span>
        <span className="hq__count">
          <b>{found}</b> clips found · {sources.length} sources
        </span>
        <span className="hq__progress" aria-hidden="true" />
      </header>

      <div className="hq__wall" aria-hidden="true">
        {clips.map((c) => {
          const delay = order.indexOf(c.id) * 85;
          const span = SPANS[c.id] ?? [1, 1];
          const style = { gridColumn: `span ${span[0]}`, gridRow: `span ${span[1]}` };
          if (real?.length) return <RealTile key={c.id} clip={real[c.id % real.length]} delay={delay} scored={phase !== 'scan'} style={style} />;
          // Never present synthetic clips as results from linked accounts.
          return <figure key={c.id} className="frame frame--pending" style={{ ['--d' as string]: `${delay}ms`, ['--rot' as string]: '0deg', ...style }} />;
        })}
      </div>

      <div className="hq__reveal">
        <FazeLogo className="hq__logo" />
        <p className="hq__headline">You're on the radar.</p>
        <p className="hq__sub">
          {total} clips · {sources.length} sources · HQ ready
        </p>
      </div>

      <span className="hq__skip">{waiting ? 'Loading your clips…' : 'click to skip'}</span>
    </div>
  );
}
