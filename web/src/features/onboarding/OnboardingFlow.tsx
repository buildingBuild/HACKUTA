import { useEffect, useRef, useState, type FormEvent } from 'react';
import { STEP_LINES } from './quotes';
import { loadOnboarding, saveOnboarding } from './storage';
import { ConsoleStep, GamertagStep, GameStep, IntroStep, ReviewStep, StreamingStep } from './Steps';
import { Ticker } from './Ticker';
import { TraceLine } from './TraceLine';
import { STEPS, type OnboardingData, type StepId, type StepStatus } from './types';
import './onboarding.css';

const EXIT_MS = 420;

const HEADINGS: Record<StepId, string> = {
  intro: '',
  game: "What's your game?",
  gamertag: 'Drop your tag.',
  streaming: 'Where do you stream?',
  console: 'Console accounts.',
  review: 'Lock it in.',
};

function hasValue(id: StepId, d: OnboardingData): boolean {
  switch (id) {
    case 'game':
      return d.game !== null;
    case 'gamertag':
      return d.gamertag.trim().length >= 2;
    case 'streaming':
      return Boolean(d.twitch.trim() || d.youtube.trim());
    case 'console':
      return Boolean(d.psn.trim() || d.xbox.trim());
    default:
      return true;
  }
}

export function OnboardingFlow() {
  const [data, setData] = useState<OnboardingData>(loadOnboarding);
  const [index, setIndex] = useState(0); // STEPS.length means finished
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => saveOnboarding(data), [data]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const finished = index >= STEPS.length;
  const step = STEPS[Math.min(index, STEPS.length - 1)];
  const filled = hasValue(step.id, data);
  const canContinue = !step.required || filled;

  const statuses: StepStatus[] = STEPS.map((s, i) => {
    if (finished || i < index) return s.required || hasValue(s.id, data) ? 'done' : 'skipped';
    return i === index ? 'current' : 'pending';
  });

  const update = (patch: Partial<OnboardingData>) => setData((d) => ({ ...d, ...patch }));

  const goTo = (to: number) => {
    if (leaving || to === index) return;
    setLeaving(true);
    timer.current = window.setTimeout(() => {
      setIndex(to);
      setLeaving(false);
      window.scrollTo({ top: 0 });
    }, EXIT_MS);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (canContinue) goTo(index + 1);
  };

  const optionalEmpty = !step.required && !filled && step.id !== 'intro' && step.id !== 'review';
  const primaryLabel =
    step.id === 'intro' ? 'Start' : step.id === 'review' ? 'FaZe up' : optionalEmpty ? 'Skip for now' : 'Continue';

  return (
    <div className="onb">
      <header className="onb__top">
        <span className="brand">
          FaZe<span className="brand__hq">HQ</span>
        </span>
        <TraceLine steps={STEPS} statuses={statuses} />
        <span className="onb__count">
          {finished ? 'Complete' : `${String(index).padStart(2, '0')} / ${String(STEPS.length - 1).padStart(2, '0')}`}
        </span>
      </header>

      <main className="onb__stage">
        <div key={index} className={`panel ${leaving ? 'panel--leave' : 'panel--enter'}`}>
          <span className="panel__bloom" aria-hidden="true" />
          {finished ? (
            <DoneScreen data={data} onEdit={() => goTo(STEPS.length - 1)} />
          ) : (
            <form onSubmit={onSubmit} className="panel__form" noValidate>
              {step.id === 'intro' ? (
                <IntroStep />
              ) : (
                <>
                  <p className="kicker rise" style={{ ['--i' as string]: 0 }}>
                    <span className="kicker__bar" />
                    {step.required ? (
                      <span className="badge badge--req">
                        <span className="badge__dot" /> Required
                      </span>
                    ) : step.id === 'review' ? (
                      <span className="badge">Final check</span>
                    ) : (
                      <span className="badge badge--opt">Optional · skip anytime</span>
                    )}
                    <span className="kicker__line">{STEP_LINES[step.id]}</span>
                  </p>
                  <h2 className="heading rise" style={{ ['--i' as string]: 1 }}>
                    {HEADINGS[step.id]}
                  </h2>
                  <div className="panel__body">
                    {step.id === 'game' && <GameStep data={data} update={update} />}
                    {step.id === 'gamertag' && <GamertagStep data={data} update={update} />}
                    {step.id === 'streaming' && <StreamingStep data={data} update={update} />}
                    {step.id === 'console' && <ConsoleStep data={data} update={update} />}
                    {step.id === 'review' && (
                      <ReviewStep data={data} jump={(id) => goTo(STEPS.findIndex((s) => s.id === id))} />
                    )}
                  </div>
                </>
              )}

              <div className="actions rise" style={{ ['--i' as string]: 6 }}>
                {index > 0 && (
                  <button type="button" className="btn-ghost" onClick={() => goTo(index - 1)}>
                    ← Back
                  </button>
                )}
                <button
                  type="submit"
                  className={`btn ${optionalEmpty ? 'btn--outline' : ''}`}
                  disabled={!canContinue}
                >
                  {primaryLabel} <span className="btn__arrow">→</span>
                </button>
                <span className="actions__hint">
                  {canContinue ? (
                    <>
                      press <kbd>Enter</kbd>
                    </>
                  ) : step.id === 'game' ? (
                    'pick one to continue'
                  ) : (
                    'need at least 2 characters'
                  )}
                </span>
              </div>
            </form>
          )}
        </div>
      </main>

      <footer className="onb__foot">
        <Ticker />
      </footer>
    </div>
  );
}

function DoneScreen({ data, onEdit }: { data: OnboardingData; onEdit: () => void }) {
  return (
    <div className="done">
      <p className="kicker rise" style={{ ['--i' as string]: 0 }}>
        <span className="kicker__bar" /> Profile locked
      </p>
      <h1 className="done__title rise" style={{ ['--i' as string]: 1 }}>
        FaZe up,
        <br />
        <span className="done__tag">{data.gamertag}.</span>
      </h1>
      <p className="lede rise" style={{ ['--i' as string]: 2 }}>
        You're on the radar<span className="intro__star">*</span>
      </p>
      <p className="footnote rise" style={{ ['--i' as string]: 3 }}>
        * Scouting starts with your first clip.
      </p>
      <div className="actions rise" style={{ ['--i' as string]: 4 }}>
        <button type="button" className="btn-ghost" onClick={onEdit}>
          ← Edit answers
        </button>
        <button type="button" className="btn" title="Clip upload is the next screen we build">
          Upload your first clip <span className="btn__arrow">→</span>
        </button>
      </div>
    </div>
  );
}
