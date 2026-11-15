// Prospect detail: scout report, voice briefing, status workflow, criteria,
// stat trends and top clips with coaching notes.
import { useEffect, useRef, useState } from 'react';
import { getBriefing, getProspect, setProspectStatus, STATUSES, type ProspectDetailData, type ProspectStatus } from './api';
import { TrendChart } from './TrendChart';
import { CATEGORY_LABELS } from '../coaching/types';

interface Props {
  id: string;
  onBack: () => void;
}

export function ProspectDetail({ id, onBack }: Props) {
  const [data, setData] = useState<ProspectDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [saving, setSaving] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    getProspect(id).then(setData, (e) => setError((e as Error).message));
    return () => {
      audioRef.current?.pause();
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    };
  }, [id]);

  async function playBriefing() {
    if (briefing === 'playing') {
      audioRef.current?.pause();
      speechSynthesis?.cancel();
      setBriefing('idle');
      return;
    }
    setBriefing('loading');
    try {
      const b = await getBriefing(id);
      const audio = new Audio(b.audio_url);
      audioRef.current = audio;
      audio.onended = () => setBriefing('idle');
      await audio.play();
      setBriefing('playing');
    } catch (e) {
      // ElevenLabs down: read it with the browser voice so the moment still lands.
      const text = (e as { body?: { text?: string } }).body?.text ?? data?.report.summary;
      if (text && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text);
        u.onend = () => setBriefing('idle');
        speechSynthesis.speak(u);
        setBriefing('playing');
      } else {
        setBriefing('idle');
      }
    }
  }

  async function changeStatus(status: ProspectStatus) {
    if (!data) return;
    setSaving(true);
    try {
      await setProspectStatus(id, status);
      setData({ ...data, report: { ...data.report, status } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (error) return <section className="yao-panel"><button className="yao-btn" onClick={onBack}>← Back</button><p className="yao-error">{error}</p></section>;
  if (!data) return <section className="yao-panel yao-panel--center">Loading prospect…</section>;

  const { report: r, trend, topClips, progress } = data;
  const criteria = progress.primary?.criteria ?? r.evidence.criteria ?? [];
  const bar = (m: string) => criteria.find((c) => c.metric === m)?.value;

  return (
    <section className="yao-panel yao-rec">
      <button className="yao-btn" onClick={onBack}>← Pipeline</button>

      <header className="yao-pd__head">
        {r.avatar_url ? <img className="yao-avatar yao-avatar--lg" src={r.avatar_url} alt="" /> : <span className="yao-avatar yao-avatar--lg" />}
        <div className="yao-pd__who">
          <h2 className="yao-h">{r.display_name || r.handle}</h2>
          <p className="yao-muted">
            @{r.handle} · {r.region ?? '—'} · FACEIT {r.faceit_nickname ?? '—'} · <span className="yao-lvl">L{r.faceit_level ?? '?'}</span> {r.faceit_elo ?? '—'} ELO
          </p>
        </div>
        <div className="yao-pd__score">
          <span className="yao-prow__score">{r.evidence.score ?? '—'}</span>
          <span className="yao-muted">prospect score</span>
        </div>
      </header>

      <div className="yao-pd__report">
        <div className="yao-pd__summary">
          <h4 className="yao-sub">AI scout report</h4>
          <p>{r.summary}</p>
          <div className="yao-pd__actions">
            <button className="yao-btn yao-btn--primary" onClick={playBriefing} disabled={briefing === 'loading'}>
              {briefing === 'loading' ? 'Generating briefing…' : briefing === 'playing' ? '■ Stop briefing' : '🔊 Play voice briefing'}
            </button>
            <label className="yao-pd__status">
              Status
              <select value={r.status} onChange={(e) => changeStatus(e.target.value as ProspectStatus)} disabled={saving}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
        </div>
        <div>
          <h4 className="yao-sub">Scouting bar · {progress.primary?.label ?? r.rule_id}</h4>
          <ul className="yao-crit">
            {criteria.map((c) => (
              <li key={c.metric} className={c.pass ? 'yao-crit--pass' : 'yao-crit--fail'}>
                <span>{c.pass ? '✓' : '✗'} {c.label ?? c.metric}</span>
                <span><strong>{c.actual ?? '—'}</strong> <span className="yao-muted">/ {c.op} {c.value}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h4 className="yao-sub">30-day trends</h4>
      <div className="yao-trends">
        <TrendChart data={trend} metric="elo" label="FACEIT ELO" threshold={bar('elo')} format={(v) => String(Math.round(v))} />
        <TrendChart data={trend} metric="kd" label="K/D" threshold={bar('kd')} format={(v) => v.toFixed(2)} />
        <TrendChart data={trend} metric="hs_pct" label="HS %" threshold={bar('hs_pct')} format={(v) => `${Math.round(v)}`} />
        <TrendChart data={trend} metric="adr" label="ADR" threshold={bar('adr')} format={(v) => v.toFixed(1)} />
      </div>

      <h4 className="yao-sub">Top clips</h4>
      <ul className="yao-clips">
        {topClips.map((c) => (
          <li key={c.id} className="yao-clip">
            <div className="yao-clip__head">
              <strong>{c.title ?? 'Untitled clip'}</strong>
              <span className="yao-muted">{c.map ?? '—'} · {c.side ?? '—'}</span>
              <span className="yao-clip__score">{c.overall_score}</span>
            </div>
            {c.summary && <p className="yao-muted">{c.summary}</p>}
            <ul className="yao-clip__notes">
              {c.notes.slice(0, 3).map((n, i) => (
                <li key={i}><code>{n.t}</code> <span className="yao-muted">{CATEGORY_LABELS[n.category] ?? n.category}:</span> {n.note}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
