import type { CSSProperties } from 'react';
import type { DemoClip } from './clips';
import './clip-frame.css';

interface Props {
  clip: DemoClip;
  gamertag: string;
  /** entrance delay in ms */
  delay?: number;
  /** show the AI score badge */
  scored?: boolean;
  scoreDelay?: number;
  style?: CSSProperties;
  className?: string;
}

/** A CSS-drawn CS2 clip frame: scene, crosshair, kill feed, source, timestamp, play bar. */
export function ClipFrame({ clip, gamertag, delay = 0, scored, scoreDelay = 0, style, className = '' }: Props) {
  return (
    <figure
      className={`frame ${scored ? 'frame--scored' : ''} ${className}`}
      style={{
        ['--rot' as string]: `${clip.rot}deg`,
        ['--d' as string]: `${delay}ms`,
        ['--sd' as string]: `${delay % 900}ms`,
        ['--sdelay' as string]: `${scoreDelay}ms`,
        ['--bg1' as string]: clip.map[1],
        ['--bg2' as string]: clip.map[2],
        ['--p' as string]: `${clip.progress}%`,
        ...style,
      }}
    >
      <span className="frame__scene" />
      <span className="frame__grain" />
      <span className="frame__cross" />
      <span className="frame__feed">
        {Array.from({ length: clip.kills }, (_, k) => (
          <span key={k}>
            <b>{gamertag || 'you'}</b> ⌖ enemy
          </span>
        ))}
      </span>
      <figcaption className="frame__meta">
        <img src={clip.source.icon} alt="" />
        <span className="frame__title">
          {clip.title} · {clip.map[0]}
        </span>
        <span className="frame__time">{clip.time}</span>
      </figcaption>
      <span className="frame__bar" />
      <span className="frame__score">{clip.score}</span>
      <span className="frame__lock" />
    </figure>
  );
}
