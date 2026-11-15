// Coaching report panel: drop into any clip page.
//   <CoachingReportPanel clipId={clip.id} onSeek={(sec) => (video.currentTime = sec)} />
import { useCallback, useEffect, useRef, useState } from 'react';
import { analyzeClip, getCoaching } from './api';
import { CATEGORY_LABELS, toSeconds, type AnalyzeResponse, type Category, type CoachingReport } from './types';
import { TalkToCoachButton } from './TalkToCoachButton';
import './coaching.css';

interface Props {
  clipId: string;
  /** Seek the clip's video player to a timestamp (seconds). */
  onSeek?: (seconds: number) => void;
  /** Start analysis automatically if the clip has no report yet. */
  autoAnalyze?: boolean;
  /** Called after a fresh analysis (e.g. to refresh the scout progress bar). */
  onAnalyzed?: (result: AnalyzeResponse) => void;
}

type State = 'loading' | 'empty' | 'analyzing' | 'done' | 'error';

const STEPS = ['Reading the clip', 'Crosshair placement', 'Movement + peeks', 'Spray control', 'Utility usage', 'Positioning + trades', 'Decision making', 'Writing your report'];
const POLL_LIMIT_MS = 90_000;

export function CoachingReportPanel({ clipId, onSeek, autoAnalyze, onAnalyzed }: Props) {
  const [state, setState] = useState<State>('loading');
  const [report, setReport] = useState<CoachingReport | null>(null);
  const [crossed, setCrossed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stuck, setStuck] = useState(false);
  const onAnalyzedRef = useRef(onAnalyzed);
  onAnalyzedRef.current = onAnalyzed;

  const run = useCallback(
    async (force = false) => {
      setState('analyzing');
      setError(null);
      setStuck(false);
      try {
        const res = await analyzeClip(clipId, force);
        setReport(res.report);
        setCrossed(res.scouting?.created[0]?.id ?? null);
        setState('done');
        onAnalyzedRef.current?.(res);
      } catch (e) {
        setError((e as Error).message);
        setState('error');
      }
    },
    [clipId],
  );

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    setState('loading');
    setReport(null);
    setCrossed(null);
    const load = async () => {
      try {
        const res = await getCoaching(clipId);
        if (cancelled) return;
        if (res.status === 'analyzing') {
          setState('analyzing');
          if (Date.now() - started > POLL_LIMIT_MS) setStuck(true);
          else timer = setTimeout(load, 2000); // started elsewhere: poll
        } else if (res.report) {
          setReport(res.report);
          setState('done');
        } else if (autoAnalyze) {
          void run();
        } else {
          setState('empty');
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setState('error');
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [clipId, autoAnalyze, run]);

  if (state === 'loading')
    return (
      <section className="yao-panel">
        <p className="yao-label">Loading coaching…</p>
      </section>
    );

  if (state === 'empty' || state === 'error')
    return (
      <section className="yao-panel yao-panel--center">
        <p className="yao-kicker">AI Coach · CS2</p>
        <h3 className="yao-h">Get this clip coached</h3>
        <p className="yao-muted">
          Crosshair placement, counter-strafing, spray, utility, positioning and decisions, scored with timestamps and drills.
        </p>
        {error && <p className="yao-error">{error}</p>}
        <button className="yao-btn yao-btn--primary" onClick={() => run(state === 'error')}>
          {state === 'error' ? 'Retry analysis' : 'Analyze clip'} <span className="yao-btn__arrow">→</span>
        </button>
      </section>
    );

  if (state === 'analyzing') return <Analyzing stuck={stuck} onForce={() => run(true)} />;

  const r = report!;
  const cats = Object.keys(CATEGORY_LABELS) as Category[];
  return (
    <section className="yao-panel">
      {crossed && (
        <div className="yao-banner" role="status">
          <span className="yao-dot" /> Scout threshold crossed. FaZe recruiters have your report.
        </div>
      )}

      <header className="yao-report__head yao-rise">
        <ScoreRing score={r.overall_score} />
        <div>
          <p className="yao-kicker">AI coach report</p>
          <p className="yao-summary">{r.summary}</p>
          <div className="yao-tags">
            <span className="yao-chip">AI feedback</span>
            {r.model && <span className="yao-chip">{r.model.startsWith('cache') ? 'cached' : r.model}</span>}
          </div>
        </div>
      </header>

      <h4 className="yao-sub">Breakdown</h4>
      <div className="yao-cats">
        {cats.map((c, i) => (
          <div key={c} className="yao-rise" style={{ ['--i' as string]: i }}>
            <div className="yao-cat__row">
              <span>{CATEGORY_LABELS[c]}</span>
              <span className="yao-cat__val">{r.category_scores[c]}</span>
            </div>
            <div className="yao-bar">
              <div className={`yao-bar__fill ${r.category_scores[c] < 70 ? 'yao-bar__fill--low' : ''}`} style={{ width: `${r.category_scores[c]}%` }} />
            </div>
          </div>
        ))}
      </div>

      <h4 className="yao-sub">Key moments {onSeek && <span className="yao-muted">· click to jump</span>}</h4>
      <ol className="yao-notes">
        {r.notes.map((n, i) => (
          <li key={i} className={`yao-note yao-note--${n.severity} yao-rise`} style={{ ['--i' as string]: i + 3 }}>
            <button className="yao-note__t" onClick={() => onSeek?.(toSeconds(n.t))} disabled={!onSeek} title="Jump to this moment">
              {n.t}
            </button>
            <div>
              <div className="yao-note__meta">
                {CATEGORY_LABELS[n.category]}
                <span className={`yao-chip ${n.severity === 'high' ? 'yao-chip--red' : ''}`}>{n.severity}</span>
              </div>
              <p className="yao-note__text">{n.note}</p>
              <p className="yao-note__fix">
                <strong>Fix</strong>
                {n.fix}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <h4 className="yao-sub">Drills</h4>
      <ul className="yao-drills">
        {r.drills.map((d, i) => (
          <li key={i} className="yao-drill">
            <div>
              <strong>{d.name}</strong>
              <div className="yao-label">{d.where}</div>
            </div>
            <span className="yao-drill__min">
              {d.minutes}
              <small>MIN</small>
            </span>
          </li>
        ))}
      </ul>

      <TalkToCoachButton clipId={clipId} fallbackText={`${r.summary} ${r.notes.find((n) => n.severity !== 'low')?.fix ?? ''}`} />
    </section>
  );
}

function ScoreRing({ score }: { score: number }) {
  const C = 2 * Math.PI * 46;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(score));
    return () => cancelAnimationFrame(t);
  }, [score]);
  return (
    <div className="yao-ring" role="img" aria-label={`Clip score ${score} out of 100`}>
      <svg viewBox="0 0 100 100">
        <circle className="yao-ring__track" cx="50" cy="50" r="46" />
        <circle className="yao-ring__fill" cx="50" cy="50" r="46" strokeDasharray={C} strokeDashoffset={C * (1 - shown / 100)} />
      </svg>
      <div className="yao-ring__num">
        <strong>{score}</strong>
        <span>/ 100</span>
      </div>
    </div>
  );
}

function Analyzing({ stuck, onForce }: { stuck: boolean; onForce: () => void }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1100);
    return () => clearInterval(t);
  }, []);
  return (
    <section className="yao-panel yao-analyzing" aria-busy="true">
      <p className="yao-kicker">AI Coach · analyzing</p>
      <h3 className="yao-h">Watching your clip…</h3>
      <div className="yao-scanbox" />
      <ul className="yao-steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i < step ? 'is-done' : i === step ? 'is-active' : ''}>
            {s}
          </li>
        ))}
      </ul>
      {stuck && (
        <button className="yao-btn yao-btn--sm" onClick={onForce}>
          Taking too long? Restart analysis
        </button>
      )}
    </section>
  );
}
