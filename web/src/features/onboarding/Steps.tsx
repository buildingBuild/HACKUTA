import { useEffect, useRef } from 'react';
import { Field } from './Field';
import { GameCard } from './GameCard';
import { toHandle } from './storage';
import { GAMES, type OnboardingData, type StepId } from './types';

type Update = (patch: Partial<OnboardingData>) => void;

interface StepProps {
  data: OnboardingData;
  update: Update;
}

const ROADMAP = [
  { title: 'Join the fam', desc: 'Old heads and new fans.' },
  { title: 'Post your plays', desc: 'Share clips. Get AI coaching.' },
  { title: 'Get connected', desc: 'Squad up. Get seen by recruiters.' },
];

export function IntroStep() {
  return (
    <div className="intro">
      <p className="kicker rise" style={{ ['--i' as string]: 0 }}>
        <span className="kicker__bar" /> FaZe HQ · Home base
      </p>
      <h1 className="intro__title rise" style={{ ['--i' as string]: 1 }}>
        FaZe up<span className="intro__star">*</span>
      </h1>
      <p className="lede rise" style={{ ['--i' as string]: 2 }}>
        Home for FaZe fans. Day ones and new blood.
      </p>
      <ol className="roadmap rise" style={{ ['--i' as string]: 3 }}>
        {ROADMAP.map((r, i) => (
          <li key={r.title} className="roadmap__item">
            <span className="roadmap__num">{String(i + 1).padStart(2, '0')}</span>
            <span className="roadmap__title">{r.title}</span>
            <span className="roadmap__desc">{r.desc}</span>
          </li>
        ))}
      </ol>
      <p className="footnote rise" style={{ ['--i' as string]: 4 }}>
        * FaZe the f*ck up. Setup takes about a minute.
      </p>
    </div>
  );
}

export function GameStep({ data, update }: StepProps) {
  return (
    <div className="game-grid" role="radiogroup" aria-label="Game">
      {GAMES.map((g, i) => (
        <GameCard
          key={g.id}
          game={g}
          index={i}
          selected={data.game === g.id}
          onSelect={() => update({ game: g.id })}
        />
      ))}
    </div>
  );
}

export function GamertagStep({ data, update }: StepProps) {
  const cs2 = data.game === 'cs2';
  return (
    <div className="rise" style={{ ['--i' as string]: 2 }}>
      <Field
        label={cs2 ? 'FACEIT nickname' : 'Gamertag'}
        icon={cs2 ? '/brand/social/faceit.svg' : undefined}
        value={data.gamertag}
        onChange={(v) => update({ gamertag: v.replace(/\s/g, '') })}
        placeholder="your_tag"
        hint={cs2 ? 'We use it to pull your FACEIT level, ELO and match stats.' : undefined}
        autoFocus
        maxLength={32}
      />
    </div>
  );
}

export function AccountsStep({ data, update }: StepProps) {
  return (
    <div className="field-grid">
      <div className="rise" style={{ ['--i' as string]: 2 }}>
        <Field
          label="Twitch"
          icon="/brand/social/twitch.svg"
          prefix="twitch.tv/"
          value={data.twitch}
          onChange={(v) => update({ twitch: v })}
          onBlur={() => update({ twitch: toHandle(data.twitch) })}
          placeholder="channel"
          hint="We'll pull your Twitch clips and VOD highlights."
          autoFocus
        />
      </div>
      <div className="rise" style={{ ['--i' as string]: 3 }}>
        <Field
          label="YouTube"
          icon="/brand/social/youtube.svg"
          prefix="@"
          value={data.youtube}
          onChange={(v) => update({ youtube: v })}
          onBlur={() => update({ youtube: toHandle(data.youtube) })}
          placeholder="handle"
          hint="We'll pull your YouTube videos and Shorts."
        />
      </div>
      <div className="rise" style={{ ['--i' as string]: 4 }}>
        <Field
          label="PSN ID"
          icon="/brand/social/playstation.svg"
          value={data.psn}
          onChange={(v) => update({ psn: v })}
          placeholder="psn_id"
          hint="We'll pull your PlayStation captures."
        />
      </div>
      <div className="rise" style={{ ['--i' as string]: 5 }}>
        <Field
          label="Xbox gamertag"
          icon="/brand/social/xbox.svg"
          value={data.xbox}
          onChange={(v) => update({ xbox: v })}
          placeholder="gamertag"
          hint="We'll pull your Xbox game clips."
        />
      </div>
    </div>
  );
}

interface ReviewProps {
  data: OnboardingData;
  jump: (id: StepId) => void;
}

interface OrbitNode {
  key: string;
  label: string;
  value: string;
  icon: string;
  step: StepId;
}

const CRUISE = 7.5; // deg/s, one lap every ~48s
const CHARGE = 16; // deg/s while hovering FaZe Up (gentle spin-up)

/** Everything they linked, orbiting the FaZe Up button. Click a node to edit it. */
export function ReviewStep({ data, jump }: ReviewProps) {
  const game = GAMES.find((g) => g.id === data.game);
  const nodes: OrbitNode[] = [
    { key: 'game', label: 'Game', value: game?.code ?? '', icon: data.game === 'cs2' ? '/brand/social/counterstrike.svg' : game?.logo ?? '', step: 'game' },
    { key: 'faceit', label: data.game === 'cs2' ? 'FACEIT' : 'Gamertag', value: data.gamertag, icon: '/brand/social/faceit.svg', step: 'gamertag' },
    { key: 'twitch', label: 'Twitch', value: data.twitch, icon: '/brand/social/twitch.svg', step: 'accounts' },
    { key: 'youtube', label: 'YouTube', value: data.youtube && `@${data.youtube}`, icon: '/brand/social/youtube.svg', step: 'accounts' },
    { key: 'psn', label: 'PSN', value: data.psn, icon: '/brand/social/playstation.svg', step: 'accounts' },
    { key: 'xbox', label: 'Xbox', value: data.xbox, icon: '/brand/social/xbox.svg', step: 'accounts' },
  ];
  const linked = nodes.filter((n) => n.value).length;

  // Rotation is driven here (not CSS) so speed can ease smoothly:
  // cruise normally, glide to a stop over a node, spin up over FaZe Up.
  const orbitRef = useRef<HTMLDivElement>(null);
  const targetSpeed = useRef(CRUISE);
  useEffect(() => {
    const el = orbitRef.current;
    if (!el) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let angle = 0;
    let speed = still ? 0 : CRUISE;
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const target = still ? 0 : targetSpeed.current;
      speed += (target - speed) * (1 - Math.exp(-dt * 2.6)); // smooth ease toward target
      angle = (angle + speed * dt) % 360;
      el.style.setProperty('--rot', `${angle}deg`);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  const setSpeed = (v: number) => () => {
    targetSpeed.current = v;
  };

  return (
    <>
    <p className="lede review__lede rise" style={{ ['--i' as string]: 2 }}>
      We pull your clips from everywhere and break down every play, so you know exactly how to level up. The
      community sees your grind. <strong className="review__punch">FaZe notices.</strong>
    </p>
    <div className="orbit-wrap rise" style={{ ['--i' as string]: 3 }}>
      <div className="orbit" ref={orbitRef}>
        <span className="radar" aria-hidden="true">
          <span className="radar__sweep" />
          <span className="radar__ping" />
          <span className="radar__ping radar__ping--late" />
        </span>
        <div className="orbit__spin">
          {nodes.map((n, i) => {
            const angle = (360 / nodes.length) * i - 90;
            return (
              <div key={n.key} className="orbit__arm" style={{ ['--a' as string]: `${angle}deg`, ['--k' as string]: i }}>
                <button
                  type="button"
                  className={`node ${n.value ? 'node--on' : 'node--off'}`}
                  onClick={() => jump(n.step)}
                  onMouseEnter={setSpeed(0)}
                  onMouseLeave={setSpeed(CRUISE)}
                  onFocus={setSpeed(0)}
                  onBlur={setSpeed(CRUISE)}
                  title={`Edit ${n.label}`}
                >
                  <span className="node__upright">
                    <span className="node__badge">
                      <img src={n.icon} alt="" draggable={false} />
                    </span>
                    <span className="node__label">{n.label}</span>
                    <span className="node__value">{n.value || 'Skipped'}</span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="submit"
          className="core"
          onMouseEnter={setSpeed(CHARGE)}
          onMouseLeave={setSpeed(CRUISE)}
          onFocus={setSpeed(CHARGE)}
          onBlur={setSpeed(CRUISE)}
        >
          <span className="core__label">FaZe up</span>
          <span className="core__arrow">→</span>
          <span className="core__count">
            {linked}/{nodes.length} linked
          </span>
        </button>
      </div>
    </div>
    </>
  );
}
