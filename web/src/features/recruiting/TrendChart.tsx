// Small dependency-free SVG trend chart (HUD style) with the scouting bar as a dashed line.
interface Props {
  data: ({ day: string } & Record<string, number | string>)[];
  metric: string;
  label: string;
  format?: (v: number) => string;
  /** Scouting threshold for this metric (drawn as a dashed line). */
  threshold?: number;
}

const W = 280;
const H = 96;
const PAD = 6;

export function TrendChart({ data, metric, label, format = (v) => String(v), threshold }: Props) {
  const pts = data.filter((d) => typeof d[metric] === 'number').map((d) => ({ day: d.day, v: d[metric] as number }));
  if (pts.length < 2)
    return (
      <figure className="yao-trend">
        <figcaption className="yao-label">{label}</figcaption>
        <p className="yao-muted">Not enough data yet</p>
      </figure>
    );

  const vals = pts.map((p) => p.v).concat(threshold != null ? [threshold] : []);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => PAD + (i / (pts.length - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
  const first = pts[0].v;
  const last = pts[pts.length - 1].v;
  const delta = last - first;
  const above = threshold == null || last >= threshold;

  return (
    <figure className="yao-trend">
      <figcaption className="yao-trend__head">
        <span className="yao-label">{label}</span>
        <span className={`yao-trend__delta ${delta >= 0 ? 'is-up' : 'is-down'}`}>
          {delta >= 0 ? '▲' : '▼'} {format(Math.abs(Math.round(delta * 100) / 100))}
        </span>
      </figcaption>
      <strong className="yao-trend__value">{format(last)}</strong>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${label}: ${format(first)} to ${format(last)} over ${pts.length} days`}>
        <path d={area} className="yao-trend__area" />
        {threshold != null && (
          <line x1={0} x2={W} y1={y(threshold)} y2={y(threshold)} className="yao-trend__threshold" vectorEffect="non-scaling-stroke">
            <title>Scouting bar: {format(threshold)}</title>
          </line>
        )}
        <path d={line} className={`yao-trend__line ${above ? '' : 'is-below'}`} vectorEffect="non-scaling-stroke" />
      </svg>
      {threshold != null && <span className="yao-label">bar {format(threshold)}</span>}
    </figure>
  );
}
