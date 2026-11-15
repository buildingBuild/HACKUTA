// Tiny dependency-free SVG line chart for stat trends.
interface Props {
  data: ({ day: string } & Record<string, number | string>)[];
  metric: string;
  label: string;
  format?: (v: number) => string;
  /** Scouting threshold for this metric (drawn as a dashed line). */
  threshold?: number;
}

const W = 260;
const H = 90;
const PAD = 6;

export function TrendChart({ data, metric, label, format = (v) => String(v), threshold }: Props) {
  const pts = data.filter((d) => typeof d[metric] === 'number').map((d) => ({ day: d.day, v: d[metric] as number }));
  if (pts.length < 2) return <div className="yao-trend yao-trend--empty">{label}: not enough data</div>;

  const vals = pts.map((p) => p.v).concat(threshold != null ? [threshold] : []);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => PAD + (i / (pts.length - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const first = pts[0].v;
  const last = pts[pts.length - 1].v;
  const delta = last - first;

  return (
    <figure className="yao-trend">
      <figcaption className="yao-trend__head">
        <span>{label}</span>
        <span>
          <strong>{format(last)}</strong>{' '}
          <span className={delta >= 0 ? 'yao-up' : 'yao-down'}>
            {delta >= 0 ? '▲' : '▼'} {format(Math.abs(Math.round(delta * 100) / 100))}
          </span>
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} trend, ${pts.length} days, from ${format(first)} to ${format(last)}`}>
        {threshold != null && (
          <line x1={PAD} x2={W - PAD} y1={y(threshold)} y2={y(threshold)} className="yao-trend__threshold">
            <title>Scouting bar: {format(threshold)}</title>
          </line>
        )}
        <path d={path} className="yao-trend__line" />
        <circle cx={x(pts.length - 1)} cy={y(last)} r={3} className="yao-trend__dot" />
      </svg>
    </figure>
  );
}
