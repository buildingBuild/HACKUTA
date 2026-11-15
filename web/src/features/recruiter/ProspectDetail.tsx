// Prospect detail: AI scout report + voice briefing, status workflow, scouting
// criteria, 30-day trends and top clips (linking to the coach page).
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
  const [briefingNote, setBriefingNote] = useState<string | null>(null);
  const [saving, setSaving] = useState<ProspectStatus | null>(null);
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
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      setBriefing('idle');
      return;
    }
    setBriefing('loading');
    setBriefingNote(null);
    try {
      const b = await getBriefing(id);
      const audio = new Audio(b.audio_url);
      audioRef.current = audio;
      audio.onended = () => setBriefing('idle');
      await audio.play();
      setBriefing('playing');
      setBriefingNote('ElevenLabs voice');
    } catch (e) {
      // ElevenLabs down: read it with the browser voice so the moment still lands.
      const text = (e as { body?: { text?: string } }).body?.text ?? data?.report.summary;
      if (text && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text);
        u.onend = () => setBriefing('idle');
        speechSynthesis.speak(u);
        setBriefing('playing');
        setBriefingNote('Browser voice · ElevenLabs offline');
      } else {
        setBriefing('idle');
        setBriefingNote('Voice unavailable');
      }
    }
  }

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

  const { report: r, trend, topClips, progress } = data;
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
            <h2 className="yao-h">AI scout report</h2>
            <span className="yao-chip">{r.evidence.summary_source === 'llm' ? 'Gemini' : 'auto summary'}</span>
          </div>
          <p className="yao-pd__summary">{r.summary}</p>
          <div className="yao-form__foot">
            <button className="yao-btn yao-btn--primary" onClick={playBriefing} disabled={briefing === 'loading'}>
              {briefing === 'loading' ? 'Generating…' : briefing === 'playing' ? '■ Stop briefing' : 'Play voice briefing'}
              {briefing === 'idle' && <span className="yao-btn__arrow">→</span>}
            </button>
            {briefing === 'playing' && <span className="yao-dot yao-dot--pulse" />}
            {briefingNote && <span className="yao-label">{briefingNote}</span>}
          </div>

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

      <h4 className="yao-sub">Top clips · AI coached</h4>
      <ul className="yao-pclips">
        {topClips.map((c) => (
          <li key={c.id}>
            <a className="yao-pclip" href={`/clips/${c.id}`}>
              <div className="yao-pclip__head">
                <span className="yao-cliprow__map">{(c.map ?? 'cs2').slice(0, 4)}</span>
                <span className="yao-cliprow__title">
                  <strong>{c.title ?? 'Untitled clip'}</strong>
                  <span className="yao-label">{c.map ?? '—'} · {c.side ?? '—'}</span>
                </span>
                <span className="yao-cliprow__score">{c.overall_score}</span>
              </div>
              {c.summary && <p className="yao-pclip__summary">{c.summary}</p>}
              <ul className="yao-pclip__notes">
                {c.notes.slice(0, 3).map((n, i) => (
                  <li key={i}>
                    <code>{n.t}</code>
                    <span className="yao-label">{CATEGORY_LABELS[n.category] ?? n.category}</span>
                    <span>{n.note}</span>
                  </li>
                ))}
              </ul>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
