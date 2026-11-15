import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { FazeLogo } from '../../components/FazeLogo';
import { BuildingHQ } from './BuildingHQ';
import { ProfilePreview } from './ProfilePreview';
import { STEP_LINES } from './quotes';
import { saveOnboarding } from './storage';
import { AccountsStep, GamertagStep, GameStep, IntroStep, ReviewStep } from './Steps';
import { Ticker } from './Ticker';
import { TraceLine } from './TraceLine';
import { EMPTY_DATA, GAMES, STEPS, type OnboardingData, type StepId, type StepStatus } from './types';
import './onboarding.css';

const EXIT_MS = 420;

const HEADINGS: Record<StepId, string> = {
  intro: '',
  game: "What's your game?",
  gamertag: 'Drop your tag.',
  accounts: 'Bring your highlights.',
  review: 'Lock it in.',
};

function hasValue(id: StepId, d: OnboardingData): boolean {
  switch (id) {
    case 'game':
      return d.game !== null;
    case 'gamertag':
      return d.gamertag.trim().length >= 2;
    case 'accounts':
      return Boolean(d.twitch.trim() || d.youtube.trim() || d.psn.trim() || d.xbox.trim());
    default:
      return true;
  }
}

export function OnboardingFlow() {
  const [data, setData] = useState<OnboardingData>(() => ({ ...EMPTY_DATA })); // fresh each visit
  const [index, setIndex] = useState(0); // STEPS.length means finished
  const [leaving, setLeaving] = useState(false);
  const [building, setBuilding] = useState(false);
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
    if (!canContinue) return;
    if (step.id === 'review') setBuilding(true); // play the "building your HQ" sequence first
    else goTo(index + 1);
  };

  const finishBuilding = useCallback(() => {
    setBuilding(false);
    setIndex(STEPS.length);
    window.scrollTo({ top: 0 });
  }, []);

  const optionalEmpty = !step.required && !filled && step.id !== 'intro' && step.id !== 'review';
  const primaryLabel =
    step.id === 'intro' ? 'Enter HQ' : step.id === 'review' ? 'FaZe up' : optionalEmpty ? 'Skip for now' : 'Continue';

  return (
    <div className="onb">
      {building && <BuildingHQ data={data} onDone={finishBuilding} />}
      <FazeLogo className={`watermark ${finished ? 'watermark--done' : ''}`} />
      <header className="onb__top">
        <span className="brand">
          <FazeLogo className="brand__logo" title="FaZe" />
          <span className="brand__hq">HQ</span>
        </span>
        <TraceLine steps={STEPS} statuses={statuses} />
        <span className="onb__count">
          {finished ? 'Complete' : `${String(index).padStart(2, '0')} / ${String(STEPS.length - 1).padStart(2, '0')}`}
        </span>
      </header>

      <main className="onb__stage">
        <div key={index} className={`panel ${leaving ? 'panel--leave' : 'panel--enter'} ${step.id === 'game' && !finished ? 'panel--wide' : ''} ${finished ? 'panel--profile' : ''}`}>
          <span className="panel__bloom" aria-hidden="true" />
          {finished ? (
            <ProfilePreview data={data} onEdit={() => goTo(STEPS.length - 1)} />
          ) : (
            <form onSubmit={onSubmit} className="panel__form" noValidate>
              {step.id === 'intro' ? (
                <IntroStep />
              ) : (
                <>
                  {step.required && (
                  <p className="kicker rise" style={{ ['--i' as string]: 0 }}>
                    <span className="kicker__bar" />
                    <span className="badge badge--req">
                      <span className="badge__dot" /> Required
                    </span>
                    <span className="kicker__line">{STEP_LINES[step.id]}</span>
                  </p>
                  )}
                  <h2 className="heading rise" style={{ ['--i' as string]: 1 }}>
                    {step.id === 'gamertag'
                      ? `Drop your ${GAMES.find((g) => g.id === data.game)?.code ?? ''} gamertag.`.replace('  ', ' ')
                      : HEADINGS[step.id]}
                  </h2>
                  <div className="panel__body">
                    {step.id === 'game' && <GameStep data={data} update={update} />}
                    {step.id === 'gamertag' && <GamertagStep data={data} update={update} />}
                    {step.id === 'accounts' && <AccountsStep data={data} update={update} />}
                    {step.id === 'review' && (
                      <ReviewStep data={data} jump={(id) => goTo(STEPS.findIndex((s) => s.id === id))} />
                    )}
                  </div>
                </>
              )}

              <div className="actions rise" style={{ ['--i' as string]: 6 }}>
                <div className="btn-group">
                  {index > 0 && (
                    <button
                      type="button"
                      className="btn-square"
                      onClick={() => goTo(index - 1)}
                      aria-label="Back"
                      title="Back"
                    >
                      ←
                    </button>
                  )}
                  {step.id !== 'review' && (
                    <button
                      type="submit"
                      className={`btn ${optionalEmpty ? 'btn--outline' : ''} ${step.id === 'intro' ? 'btn--xl' : ''}`}
                      disabled={!canContinue}
                    >
                      {primaryLabel} <span className="btn__arrow">→</span>
                    </button>
                  )}
                </div>
                {!canContinue && (
                  <span className="actions__hint actions__hint--warn">
                    {step.id === 'game' ? 'Pick a game to continue' : 'Needs at least 2 characters'}
                  </span>
                )}
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
