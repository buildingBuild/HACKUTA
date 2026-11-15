import type { StepMeta, StepStatus } from './types';

interface Props {
  steps: StepMeta[];
  statuses: StepStatus[];
}

/** Progress line: segments draw in red as you advance, dashed when a step was skipped. */
export function TraceLine({ steps, statuses }: Props) {
  return (
    <nav className="trace" aria-label="Onboarding progress">
      <ol className="trace__track">
        {steps.map((step, i) => {
          const status = statuses[i];
          const last = i === steps.length - 1;
          return (
            <li key={step.id} className={`trace__stop trace__stop--${status}`}>
              <span className="trace__node" aria-hidden="true" />
              <span className="trace__label">
                <span className="trace__num">{String(i).padStart(2, '0')}</span>
                {step.label}
                {step.required && <span className="trace__req" title="Required" />}
              </span>
              {!last && (
                <span
                  className={`trace__seg trace__seg--${status === 'done' || status === 'skipped' ? status : 'empty'}`}
                  aria-hidden="true"
                />
              )}
              <span className="sr-only">
                {step.label}: {status}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
