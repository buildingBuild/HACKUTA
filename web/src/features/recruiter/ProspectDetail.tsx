// Prospect detail: scout report (template from real stats), status workflow, scouting
// criteria, 30-day trends and recent clips.
import { useEffect, useState } from 'react';
import { getProspect, setProspectStatus, STATUSES, type ProspectDetailData, type ProspectStatus } from './api';
import { TrendChart } from './TrendChart';

interface Props {
  id: string;
  onBack: () => void;
}

export function ProspectDetail({ id, onBack }: Props) {
  const [data, setData] = useState<ProspectDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<ProspectStatus | null>(null);

  useEffect(() => {
    getProspect(id).then(setData, (e) => setError((e as Error).message));
  }, [id]);

  async function changeStatus(status: ProspectStatus) {
    if (!data || status === data.report.status) return;
    setSaving(status);
    try {
      await setProspectStatus(id, status);
      setData({ ...data, report: { ...data.report, status } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  }

  if (error)
    return (
      <>
        <button className="yao-link" onClick={onBack}>← Pipeline</button>
        <p className="yao-error" style={{ marginTop: 16 }}>{error}</p>
      </>
    );
  if (!data) return <p className="yao-label">Loading prospect…</p>;

  const { report: r, trend, recentClips, progress } = data;
  const criteria = progress.primary?.criteria ?? r.evidence.criteria ?? [];
  const bar = (m: string) => criteria.find((c) => c.metric === m)?.value;

  return (
    <div className="yao-pd">
      <header className="yao-page__head">
        <div>
          <p className="yao-kicker">
            <button className="yao-link" onClick={onBack}>← Pipeline</button> · {r.track} track · reported {new Date(r.created_at).toLocaleDateString()}
          </p>
          <div className="yao-pd__who">
            {r.avatar_url ? <img className="yao-avatar yao-avatar--lg" src={r.avatar_url} alt="" /> : <span className="yao-avatar yao-avatar--lg" />}
            <div>
              <h1 className="yao-heading">{r.display_name || r.handle}</h1>
              <div className="yao-tags" style={{ marginTop: 10 }}>
                <span className="yao-lvl">L{r.faceit_level ?? '?'}</span>
                <span className="yao-chip">{r.faceit_elo ?? '—'} ELO</span>
                <span className="yao-chip">{r.region ?? '—'}</span>
                <span className="yao-chip">FACEIT {r.faceit_nickname ?? '—'}</span>
                <a className="yao-chip" href={`/u/${r.handle}`}>Public profile ↗</a>
              </div>
            </div>
          </div>
        </div>
        <div className="yao-pd__score">
          <span className="yao-label">Prospect score</span>
          <strong>{r.evidence.score ?? '—'}</strong>
        </div>
      </header>

      <div className="yao-pd__grid">
        <section className="yao-card">
          <div className="yao-card__head">
            <h2 className="yao-h">Scout report</h2>
            <span className="yao-chip">from FACEIT stats</span>
          </div>
          <p className="yao-pd__summary">{r.summary}</p>

          <h4 className="yao-sub">Status</h4>
          <div className="yao-seg yao-seg--wide" role="group" aria-label="Prospect status">
            {STATUSES.map((s) => (
              <button key={s} aria-pressed={r.status === s} onClick={() => changeStatus(s)} disabled={!!saving}>
                {saving === s ? '…' : s}
              </button>
            ))}
          </div>
        </section>

        <section className="yao-card">
          <div className="yao-card__head">
            <h2 className="yao-h">Scouting bar</h2>
            <span className="yao-label">{progress.primary?.label ?? r.rule_id}</span>
          </div>
          <ul className="yao-crit">
            {criteria.map((c) => (
              <li key={c.metric} className={c.pass ? 'is-pass' : 'is-fail'}>
                <span className="yao-crit__mark">{c.pass ? '✓' : '✗'}</span>
                <span className="yao-label">{c.label ?? c.metric}</span>
                <span className="yao-crit__val">
                  <strong>{c.actual ?? '—'}</strong>
                  <span className="yao-muted"> / {c.value}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <h4 className="yao-sub">30-day trends</h4>
      <div className="yao-trends">
        <TrendChart data={trend} metric="elo" label="FACEIT ELO" threshold={bar('elo')} format={(v) => String(Math.round(v))} />
        <TrendChart data={trend} metric="kd" label="K/D" threshold={bar('kd')} format={(v) => v.toFixed(2)} />
        <TrendChart data={trend} metric="hs_pct" label="HS %" threshold={bar('hs_pct')} format={(v) => `${Math.round(v)}`} />
        <TrendChart data={trend} metric="adr" label="ADR" threshold={bar('adr')} format={(v) => v.toFixed(1)} />
      </div>

      {recentClips.length > 0 && (
        <>
          <h4 className="yao-sub">Recent clips</h4>
          <ul className="yao-pclips">
            {recentClips.map((c) => (
              <li key={c.id}>
                <a className="yao-pclip" href={c.social_post_url || c.blob_url} target="_blank" rel="noreferrer">
                  <div className="yao-pclip__head">
                    <span className="yao-cliprow__map">{(c.map ?? 'cs2').slice(0, 4)}</span>
                    <span className="yao-cliprow__title">
                      <strong>{c.title ?? 'Untitled clip'}</strong>
                      <span className="yao-label">{c.map ?? '—'} · {c.side ?? '—'} · {new Date(c.created_at).toLocaleDateString()}</span>
                    </span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
