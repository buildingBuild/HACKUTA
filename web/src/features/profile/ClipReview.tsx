import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClipNote, ProfileClip } from "./types";

const PRE = 2; // seconds of lead-in before a flagged moment
const POST = 4; // seconds after it before pausing / moving on

const CATEGORY: Record<string, string> = {
  crosshair_placement: "Crosshair",
  movement: "Movement",
  spray_control: "Spray",
  utility: "Utility",
  positioning: "Positioning",
  decision_making: "Decisions",
};
const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

/** "00:07" | "1:02" | "7" -> seconds */
export function toSeconds(t: string): number {
  const parts = String(t).trim().split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

type Moment = ClipNote & { sec: number; idx: number };
type SevFilter = "all" | "high" | "medium" | "low";

/**
 * Recruiter-friendly clip review: a timeline of AI-flagged moments over the video.
 * Click a moment (or press J/K) to jump there with a short lead-in; "Play key moments"
 * plays only the flagged windows back to back.
 */
export function ClipReview({ clips, title = "Clip review" }: { clips: ProfileClip[]; title?: string }) {
  const reviewable = useMemo(() => clips.filter((c) => c.blob_url), [clips]);
  const [clipIdx, setClipIdx] = useState(0);
  const clip = reviewable[clipIdx];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [videoOk, setVideoOk] = useState(true);
  const [active, setActive] = useState<number | null>(null);
  const [reel, setReel] = useState(false);
  const [sev, setSev] = useState<SevFilter>("all");
  const stopAt = useRef<number | null>(null);

  const moments: Moment[] = useMemo(
    () => (clip?.notes ?? []).map((n, idx) => ({ ...n, sec: toSeconds(n.t), idx })).sort((a, b) => a.sec - b.sec),
    [clip],
  );
  const visible = useMemo(() => moments.filter((m) => sev === "all" || m.severity === sev), [moments, sev]);
  const span = duration ?? Math.max(10, ...moments.map((m) => m.sec + POST));

  // reset when switching clips
  useEffect(() => {
    setDuration(null);
    setNow(0);
    setVideoOk(true);
    setActive(null);
    setReel(false);
    stopAt.current = null;
  }, [clip?.id]);

  const jump = useCallback(
    (pos: number, opts: { reel?: boolean } = {}) => {
      const m = visible[pos];
      if (!m) return;
      setActive(pos);
      setReel(Boolean(opts.reel));
      const v = videoRef.current;
      const start = Math.max(0, m.sec - PRE);
      stopAt.current = m.sec + POST;
      setNow(m.sec);
      if (v && videoOk) {
        v.currentTime = start;
        void v.play().catch(() => undefined);
      }
    },
    [visible, videoOk],
  );

  const step = useCallback(
    (dir: 1 | -1) => {
      if (!visible.length) return;
      const next = active === null ? (dir === 1 ? 0 : visible.length - 1) : (active + dir + visible.length) % visible.length;
      jump(next);
    },
    [active, visible, jump],
  );

  // J / K to step through moments, Space to play/pause (ignored while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "j" || e.key === "J") { e.preventDefault(); step(1); }
      else if (e.key === "k" || e.key === "K") { e.preventDefault(); step(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const onTime = () => {
    const v = videoRef.current;
    if (!v) return;
    setNow(v.currentTime);
    if (stopAt.current !== null && v.currentTime >= stopAt.current) {
      stopAt.current = null;
      if (reel && active !== null && active < visible.length - 1) jump(active + 1, { reel: true });
      else {
        v.pause();
        setReel(false);
      }
    }
  };

  if (!clip) return null;
  const sevCount = (s: SevFilter) => (s === "all" ? moments.length : moments.filter((m) => m.severity === s).length);
  const activeMoment = active !== null ? visible[active] : null;

  return (
    <section className="pf-panel pf-review pf-rise" aria-labelledby="pf-review-h">
      <div className="pf-panel__head pf-review__head">
        <div>
          <p className="pf-kicker"><span className="pf-kicker__bar" />Highlight reel<span className="pf-kicker__dim">· AI-flagged moments · J / K to step</span></p>
          <h2 id="pf-review-h" className="pf-display pf-h2">{title}</h2>
        </div>
        {reviewable.length > 1 && (
          <div className="pf-review__clips" role="tablist" aria-label="Clips">
            {reviewable.map((c, i) => (
              <button key={c.id} role="tab" aria-selected={i === clipIdx} className={`pf-review__tab ${i === clipIdx ? "is-active" : ""}`} onClick={() => setClipIdx(i)}>
                <span className="pf-review__tab-map">{(c.map ?? "cs2").replace(/^de_/, "")}</span>
                {c.overall_score !== null && <span className="pf-review__tab-score">{c.overall_score}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="pf-review__body">
        <div className="pf-review__stage">
          <div className="pf-review__video">
            {videoOk ? (
              <video
                ref={videoRef}
                key={clip.id}
                src={clip.blob_url ?? undefined}
                poster={clip.thumbnail_url ?? undefined}
                controls
                playsInline
                preload="metadata"
                onLoadedMetadata={(e) => setDuration(Number.isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0 ? e.currentTarget.duration : null)}
                onDurationChange={(e) => Number.isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0 && setDuration(e.currentTarget.duration)}
                onTimeUpdate={onTime}
                onError={() => setVideoOk(false)}
              />
            ) : (
              <div className="pf-review__novideo">
                <span className="pf-review__novideo-map">{(clip.map ?? "cs2").replace(/^de_/, "")}</span>
                <span className="pf-label">Video file isn't available on this machine. The AI moments below still work.</span>
              </div>
            )}
            {activeMoment && (
              <div className={`pf-review__callout sev-${activeMoment.severity}`} aria-live="polite">
                <span className="pf-review__callout-t">{activeMoment.t}</span>
                <span>{activeMoment.note}</span>
              </div>
            )}
          </div>

          {/* timeline with flagged moments */}
          <div className="pf-timeline" aria-label="Clip timeline">
            <div className="pf-timeline__track">
              {visible.map((m, i) => (
                <span
                  key={`w${m.idx}`}
                  className={`pf-timeline__window sev-${m.severity}`}
                  style={{ left: `${(Math.max(0, m.sec - PRE) / span) * 100}%`, width: `${((PRE + POST) / span) * 100}%`, opacity: active === i ? 0.5 : 0.2 }}
                  aria-hidden
                />
              ))}
              <span className="pf-timeline__head" style={{ left: `${Math.min(100, (now / span) * 100)}%` }} aria-hidden />
              {visible.map((m, i) => (
                <button
                  key={m.idx}
                  className={`pf-timeline__mark sev-${m.severity} ${active === i ? "is-active" : ""}`}
                  style={{ left: `${(m.sec / span) * 100}%` }}
                  onClick={() => jump(i)}
                  title={`${m.t} · ${CATEGORY[m.category] ?? m.category}: ${m.note}`}
                  aria-label={`Jump to ${m.t}, ${m.severity} severity, ${CATEGORY[m.category] ?? m.category}`}
                />
              ))}
            </div>
            <div className="pf-timeline__scale"><span>0:00</span><span>{fmtTime(span)}</span></div>
          </div>

          <div className="pf-review__controls">
            <button type="button" className="pf-btn pf-btn--primary" onClick={() => jump(0, { reel: true })} disabled={!visible.length}>
              ▶ Play key moments
            </button>
            <button type="button" className="pf-btn" onClick={() => step(-1)} disabled={!visible.length} aria-label="Previous moment (K)">← Prev</button>
            <button type="button" className="pf-btn" onClick={() => step(1)} disabled={!visible.length} aria-label="Next moment (J)">Next →</button>
            <div className="pf-seg pf-review__sev" role="group" aria-label="Filter by severity">
              {(["all", "high", "medium", "low"] as SevFilter[]).map((s) => (
                <button key={s} type="button" className={sev === s ? "is-active" : ""} aria-pressed={sev === s} onClick={() => { setSev(s); setActive(null); }} disabled={s !== "all" && !sevCount(s)}>
                  {s} <span className="pf-review__count">{sevCount(s)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className="pf-review__side">
          <div className="pf-review__meta">
            <strong className="pf-display">{clip.title ?? "Untitled clip"}</strong>
            <span className="pf-label">{[clip.map, clip.side].filter(Boolean).join(" · ")}{clip.overall_score !== null ? ` · AI score ${clip.overall_score}` : ""}</span>
            {clip.summary && <p>{clip.summary}</p>}
          </div>
          {visible.length === 0 ? (
            <p className="pf-muted pf-review__empty">No AI-flagged moments for this clip{sev !== "all" ? ` at ${sev} severity` : ""}.</p>
          ) : (
            <ol className="pf-moments">
              {[...visible]
                .map((m, i) => ({ m, i }))
                .sort((a, b) => SEVERITY_ORDER[a.m.severity] - SEVERITY_ORDER[b.m.severity] || a.m.sec - b.m.sec)
                .map(({ m, i }) => (
                  <li key={m.idx}>
                    <button type="button" className={`pf-moment sev-${m.severity} ${active === i ? "is-active" : ""}`} onClick={() => jump(i)}>
                      <span className="pf-moment__t">{m.t}</span>
                      <span className="pf-moment__body">
                        <span className="pf-moment__tags">
                          <span className={`pf-sev sev-${m.severity}`}>{m.severity}</span>
                          <span className="pf-label">{CATEGORY[m.category] ?? m.category}</span>
                        </span>
                        <span className="pf-moment__note">{m.note}</span>
                        {m.fix && <span className="pf-moment__fix">Fix · {m.fix}</span>}
                      </span>
                    </button>
                  </li>
                ))}
            </ol>
          )}
        </aside>
      </div>
    </section>
  );
}
