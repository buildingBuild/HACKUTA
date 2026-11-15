import { Field } from './Field';
import { toHandle } from './storage';
import { GAMES, type OnboardingData, type StepId } from './types';

type Update = (patch: Partial<OnboardingData>) => void;

interface StepProps {
  data: OnboardingData;
  update: Update;
}

const ROADMAP = [
  { title: 'Set up', desc: 'Pick your game, drop your tag, link your channels.' },
  { title: 'Get coached', desc: 'Upload clips. AI breaks down your aim, movement and utility.' },
  { title: 'Get scouted', desc: 'Cross the threshold and recruiters get your report.' },
];

export function IntroStep() {
  return (
    <div className="intro">
      <p className="kicker rise" style={{ ['--i' as string]: 0 }}>
        <span className="kicker__bar" /> FaZe HQ · Talent intake
      </p>
      <h1 className="intro__title rise" style={{ ['--i' as string]: 1 }}>
        FaZe up<span className="intro__star">*</span>
      </h1>
      <p className="lede rise" style={{ ['--i' as string]: 2 }}>
        Your scouting profile starts here. Every clip you upload gets broken down by an AI coach and
        scored. Hit the bar, and your scout report goes straight to recruiters.
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
      {GAMES.map((g, i) => {
        const selected = data.game === g.id;
        return (
          <button
            key={g.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={!g.live}
            className={`game-card rise ${selected ? 'game-card--on' : ''} ${g.live ? '' : 'game-card--soon'} ${i === 0 ? 'game-card--hero' : ''}`}
            style={{ ['--i' as string]: i + 2 }}
            onClick={() => update({ game: g.id })}
          >
            <span className="game-card__code">{g.code}</span>
            <span className="game-card__name">{g.name}</span>
            <span className="game-card__tag">{g.live ? (selected ? 'Locked' : 'Live') : 'Soon'}</span>
          </button>
        );
      })}
    </div>
  );
}

export function GamertagStep({ data, update }: StepProps) {
  const cs2 = data.game === 'cs2';
  return (
    <div className="rise" style={{ ['--i' as string]: 2 }}>
      <Field
        label={cs2 ? 'FACEIT nickname' : 'Gamertag'}
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

export function StreamingStep({ data, update }: StepProps) {
  return (
    <div className="field-stack">
      <div className="rise" style={{ ['--i' as string]: 2 }}>
        <Field
          label="Twitch"
          prefix="twitch.tv/"
          value={data.twitch}
          onChange={(v) => update({ twitch: v })}
          onBlur={() => update({ twitch: toHandle(data.twitch) })}
          placeholder="channel"
          autoFocus
        />
      </div>
      <div className="rise" style={{ ['--i' as string]: 3 }}>
        <Field
          label="YouTube"
          prefix="youtube.com/@"
          value={data.youtube}
          onChange={(v) => update({ youtube: v })}
          onBlur={() => update({ youtube: toHandle(data.youtube) })}
          placeholder="handle"
        />
      </div>
    </div>
  );
}

export function ConsoleStep({ data, update }: StepProps) {
  return (
    <div className="field-stack">
      <div className="rise" style={{ ['--i' as string]: 2 }}>
        <Field label="PSN ID" value={data.psn} onChange={(v) => update({ psn: v })} placeholder="psn_id" autoFocus />
      </div>
      <div className="rise" style={{ ['--i' as string]: 3 }}>
        <Field label="Xbox gamertag" value={data.xbox} onChange={(v) => update({ xbox: v })} placeholder="gamertag" />
      </div>
    </div>
  );
}

interface ReviewProps {
  data: OnboardingData;
  jump: (id: StepId) => void;
}

export function ReviewStep({ data, jump }: ReviewProps) {
  const game = GAMES.find((g) => g.id === data.game);
  const rows: { label: string; value: string; step: StepId }[] = [
    { label: 'Game', value: game?.name ?? '', step: 'game' },
    { label: data.game === 'cs2' ? 'FACEIT' : 'Gamertag', value: data.gamertag, step: 'gamertag' },
    { label: 'Twitch', value: data.twitch && `twitch.tv/${data.twitch}`, step: 'streaming' },
    { label: 'YouTube', value: data.youtube && `@${data.youtube}`, step: 'streaming' },
    { label: 'PSN', value: data.psn, step: 'console' },
    { label: 'Xbox', value: data.xbox, step: 'console' },
  ];
  return (
    <dl className="review">
      {rows.map((r, i) => (
        <div key={r.label} className="review__row rise" style={{ ['--i' as string]: i + 2 }}>
          <dt>{r.label}</dt>
          <dd className={r.value ? '' : 'review__empty'}>{r.value || 'Skipped, link later'}</dd>
          <button type="button" className="review__edit" onClick={() => jump(r.step)}>
            Edit
          </button>
        </div>
      ))}
    </dl>
  );
}
