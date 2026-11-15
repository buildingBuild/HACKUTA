// Scouting bar editor (REQUIREMENTS §5.2 "rules live in config so we can tune live").
// Recruiters see it read-only; admins can change thresholds and save.
import { useEffect, useState } from 'react';
import { getRules, saveRules, type RulesFile } from './api';

export function RulesEditor({ canEdit }: { canEdit: boolean }) {
  const [rules, setRules] = useState<RulesFile | null>(null);
  const [draft, setDraft] = useState<RulesFile | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getRules().then((r) => {
      setRules(r);
      setDraft(structuredClone(r));
    }, (e: Error) => setMsg(e.message));
  }, []);

  if (!draft) return <section className="yao-card yao-rules"><p className="yao-label">{msg ?? 'Loading scouting bar…'}</p></section>;

  const dirty = JSON.stringify(draft.rules) !== JSON.stringify(rules?.rules);
  const setValue = (ri: number, ci: number, value: number) =>
    setDraft((d) => {
      const next = structuredClone(d!);
      next.rules[ri].all[ci].value = value;
      return next;
    });
  const toggle = (ri: number) =>
    setDraft((d) => {
      const next = structuredClone(d!);
      next.rules[ri].enabled = !next.rules[ri].enabled;
      return next;
    });

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const saved = await saveRules(draft!.rules);
      setRules(saved);
      setDraft(structuredClone(saved));
      setMsg(`Saved v${saved.version}. Applies to the next clip or stat sync.`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="yao-card yao-rules">
      <div className="yao-card__head">
        <h2 className="yao-h">Scouting bar</h2>
        <span className="yao-label">
          scouting-rules.json · v{rules?.version}
          {!canEdit && ' · admin can edit'}
        </span>
      </div>
      <div className="yao-rules__grid">
        {draft.rules.map((rule, ri) => (
          <div key={rule.id} className={`yao-rule ${rule.enabled ? '' : 'is-off'}`}>
            <div className="yao-rule__head">
              <strong>{rule.label ?? rule.id}</strong>
              <button className="yao-chip" onClick={() => canEdit && toggle(ri)} disabled={!canEdit} aria-pressed={rule.enabled}>
                {rule.enabled ? 'On' : 'Off'}
              </button>
            </div>
            <ul className="yao-rule__list">
              {rule.all.map((c, ci) => (
                <li key={c.metric}>
                  <span className="yao-label">{c.label ?? c.metric}</span>
                  <span className="yao-rule__val">
                    <span className="yao-muted">{c.op}</span>
                    <input
                      className="yao-input"
                      type="number"
                      step="any"
                      value={c.value}
                      disabled={!canEdit}
                      onChange={(e) => setValue(ri, ci, Number(e.target.value))}
                      aria-label={`${c.label ?? c.metric} threshold`}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {canEdit && (
        <div className="yao-form__foot" style={{ marginTop: 16 }}>
          <button className="yao-btn yao-btn--primary yao-btn--sm" onClick={save} disabled={!dirty || busy}>
            {busy ? 'Saving…' : 'Save scouting bar'}
          </button>
          {dirty && (
            <button className="yao-link" onClick={() => setDraft(structuredClone(rules!))}>
              Reset
            </button>
          )}
          {msg && <span className="yao-label">{msg}</span>}
        </div>
      )}
    </section>
  );
}
