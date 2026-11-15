import { useId, useMemo, useState } from "react";
import type { ScoutProgress, TrendPoint } from "./types";
import { fmtNum, initials } from "./format";

export function Avatar({ name, url, size = 56 }: { name: string; url: string | null; size?: number }) {
  return url ? (
    <img className="pf-avatar" src={url} alt="" width={size} height={size} style={{ width: size, height: size }} />
  ) : (
    <span className="pf-avatar pf-avatar--initials" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>
      {initials(name)}
    </span>
  );
}

/** FACEIT-style level chip: colour climbs from grey (1) to red (10). */
export function LevelBadge({ level, size = "md" }: { level: number | null; size?: "sm" | "md" | "lg" }) {
  if (level === null) return null;
  const tier = level >= 10 ? "top" : level >= 8 ? "high" : level >= 4 ? "mid" : "low";
  return (
    <span className={`pf-level pf-level--${tier} pf-level--${size}`} title={`FACEIT level ${level}`}>
      <span className="pf-level__num">{level}</span>
    </span>
  );
}

export function TrendChart({ points, digits = 0, label, height = 120 }: { points: TrendPoint[]; digits?: number; label: string; height?: number }) {
  const gradId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 320, H = height, P = 6;
  const geo = useMemo(() => {
    if (points.length < 2) return null;
    const vs = points.map((p) => p.v);
    let min = Math.min(...vs), max = Math.max(...vs);
    if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * 0.1;
    min -= pad; max += pad;
    const xy = points.map((p, i) => [P + (i / (points.length - 1)) * (W - 2 * P), P + (1 - (p.v - min) / (max - min)) * (H - 2 * P)] as const);
    const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
    const area = `${line}L${xy[xy.length - 1]![0].toFixed(1)},${H}L${xy[0]![0].toFixed(1)},${H}Z`;
    return { xy, line, area };
  }, [points, H]);

  if (!geo) return <div className="pf-chart pf-chart--empty">Not enough history yet</div>;
  const active = hover ?? points.length - 1;
  const [ax, ay] = geo.xy[active]!;
  const p = points[active]!;

  return (
    <div className="pf-chart">
      <div className="pf-chart__readout">
        <strong>{fmtNum(p.v, digits)}</strong>
        <span>{new Date(p.t).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label} over the last ${points.length} days`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.round(((e.clientX - r.left) / r.width) * (points.length - 1));
          setHover(Math.max(0, Math.min(points.length - 1, i)));
        }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--pf-red)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--pf-red)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={geo.area} fill={`url(#${gradId})`} />
        <path d={geo.line} fill="none" stroke="var(--pf-red)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <line x1={ax} x2={ax} y1={0} y2={H} stroke="var(--pf-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <circle cx={ax} cy={ay} r="3.5" fill="var(--pf-red)" stroke="var(--pf-bg)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

export function ScoutProgressBar({ scout }: { scout: ScoutProgress }) {
  if (scout.status === "unavailable") return null;
  const pct = Math.round((scout.progress ?? 0) * 100);
  const reported = scout.status === "reported";
  const remaining = scout.criteria.filter((c) => !c.met);
  return (
    <section className={`pf-card pf-scout ${reported ? "pf-scout--reported" : ""}`} aria-labelledby="pf-scout-h">
      <div className="pf-scout__head">
        <h2 id="pf-scout-h" className="pf-h2">Road to FaZe Up Next</h2>
        <span className="pf-scout__pct">{reported ? "Scout report filed" : `${pct}%`}</span>
      </div>
      <div className="pf-scout__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Scout progress">
        <div className="pf-scout__fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="pf-muted pf-scout__note">
        {reported
          ? `Recruiters have this profile on their dashboard (status: ${scout.report?.status ?? "new"}).`
          : remaining.length
            ? `${remaining.length} of ${scout.criteria.length} bars left to clear before a scout report is generated.`
            : "All bars cleared. A scout report is on its way."}
      </p>
      <ul className="pf-criteria">
        {scout.criteria.map((c) => (
          <li key={c.metric} className={c.met ? "is-met" : ""}>
            <span className="pf-criteria__icon" aria-hidden>{c.met ? "✓" : "○"}</span>
            <span className="pf-criteria__label">{c.label}</span>
            <span className="pf-criteria__val">
              {c.current === null ? "–" : fmtNum(c.current, Number.isInteger(c.target) ? 0 : 2)}
              <span className="pf-muted"> / {fmtNum(c.target, Number.isInteger(c.target) ? 0 : 2)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function StateBox({ kind, children }: { kind: "loading" | "error" | "empty"; children: React.ReactNode }) {
  return <div className={`pf-state pf-state--${kind}`} role={kind === "error" ? "alert" : "status"}>{children}</div>;
}
