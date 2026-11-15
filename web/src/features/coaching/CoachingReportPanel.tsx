// Coaching report panel: drops into the slot on Joe's clip detail page.
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
  /** Called after a fresh analysis (e.g. to refresh the profile's scout progress bar). */
  onAnalyzed?: (result: AnalyzeResponse) => void;
}

type State = 'loading' | 'empty' | 'analyzing' | 'done' | 'error';

const scoreTone = (s: number) => (s >= 85 ? 'elite' : s >= 70 ? 'good' : s >= 55 ? 'ok' : 'low');

export function CoachingReportPanel({ clipId, onSeek, autoAnalyze, onAnalyzed }: Props) {
  const [state, setState] = useState<State>('loading');
  const [report, setReport] = useState<CoachingReport | null>(null);
  const [crossed, setCrossed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onAnalyzedRef = useRef(onAnalyzed);
  onAnalyzedRef.current = onAnalyzed;

  const run = useCallback(async () => {
    setState('analyzing');
    setError(null);
    try {
      const res = await analyzeClip(clipId);
      setReport(res.report);
      setCrossed(!!res.scouting?.created.length);
      setState('done');
      onAnalyzedRef.current?.(res);
    } catch (e) {
      setError((e as Error).message);
      setState('error');
    }
  }, [clipId]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    setState('loading');
    setReport(null);
    setCrossed(false);
    const load = async () => {
      try {
        const res = await getCoaching(clipId);
        if (cancelled) return;
        if (res.report && res.status !== 'analyzing') {
          setReport(res.report);
          setState('done');
        } else if (res.status === 'analyzing') {
          setState('analyzing');
          timer = setTimeout(load, 2000); // analysis started elsewhere: poll
        } else if (autoAnalyze) {
          run();
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
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [clipId, autoAnalyze, run]);

  if (state === 'loading') return <section className="yao-panel yao-panel--center">Loading coaching…</section>;

  if (state === 'empty' || state === 'error')
    return (
      <section className="yao-panel yao-panel--center">
        <h3 className="yao-h">AI Coach</h3>
        <p className="yao-muted">Get CS2-specific feedback on this clip: crosshair placement, movement, spray, utility, positioning and decisions.</p>
        {error && <p className="yao-error">{error}</p>}
        <button className="yao-btn yao-btn--primary" onClick={run}>
          {state === 'error' ? 'Retry analysis' : 'Analyze clip'}
        </button>
      </section>
    );

  if (state === 'analyzing')
    return (
      <section className="yao-panel yao-panel--center" aria-busy="true">
        <div className="yao-scan" />
        <h3 className="yao-h">Analyzing your clip…</h3>
        <p className="yao-muted">Checking crosshair height, counter-strafes, spray and utility timing.</p>
      </section>
    );

  const r = report!;
  return (
    <section className="yao-panel">
      {crossed && (
        <div className="yao-banner">
          <strong>Scout threshold crossed.</strong> Your profile was just sent to FaZe recruiters.
        </div>
      )}
      <header className="yao-report__head">
        <div className={`yao-score yao-score--${scoreTone(r.overall_score)}`}>
          <span className="yao-score__num">{r.overall_score}</span>
          <span className="yao-score__label">CLIP SCORE</span>
        </div>
        <div>
          <h3 className="yao-h">AI Coach Report</h3>
          <p className="yao-summary">{r.summary}</p>
          <span className="yao-tag">AI feedback{r.model?.startsWith('cache') ? ' · cached' : ''}</span>
        </div>
      </header>

      <div className="yao-cats">
        {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
          <div key={c} className="yao-cat">
            <div className="yao-cat__row">
              <span>{CATEGORY_LABELS[c]}</span>
              <span className="yao-cat__val">{r.category_scores[c]}</span>
            </div>
            <div className="yao-bar">
              <div className={`yao-bar__fill yao-bar__fill--${scoreTone(r.category_scores[c])}`} style={{ width: `${r.category_scores[c]}%` }} />
            </div>
          </div>
        ))}
      </div>

      <h4 className="yao-sub">Key moments</h4>
      <ol className="yao-notes">
        {r.notes.map((n, i) => (
          <li key={i} className={`yao-note yao-note--${n.severity}`}>
            <button className="yao-note__t" onClick={() => onSeek?.(toSeconds(n.t))} disabled={!onSeek} title="Jump to moment">
              {n.t}
            </button>
            <div>
              <div className="yao-note__meta">
                {CATEGORY_LABELS[n.category]} · {n.severity}
              </div>
              <p className="yao-note__text">{n.note}</p>
              <p className="yao-note__fix">
                <strong>Fix:</strong> {n.fix}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <h4 className="yao-sub">Drills</h4>
      <ul className="yao-drills">
        {r.drills.map((d, i) => (
          <li key={i}>
            <strong>{d.name}</strong> <span className="yao-muted">· {d.where} · {d.minutes} min</span>
          </li>
        ))}
      </ul>

      <TalkToCoachButton clipId={clipId} fallbackText={`${r.summary} ${r.notes[0]?.fix ?? ''}`} />
    </section>
  );
}
