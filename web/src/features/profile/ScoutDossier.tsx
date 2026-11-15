import type { Dossier, ScoutCriterion, ScoutProgress } from "./types";
import { fmtNum, fmtSigned } from "./format";

const digitsFor = (target: number) => (Number.isInteger(target) ? 0 : 2);
/** Show a decimal when rounding would hide the gap (77.5 vs 80 must not read as 78). */
const valueDigits = (current: number, target: number) => (!Number.isInteger(target) ? 2 : Number.isInteger(current) ? 0 : 1);

/** Plain-English gap for one unmet bar, e.g. "Avg AI clip score (last 5): 77.5 → 80 · +2.5 needed". */
function gapText(c: ScoutCriterion): string {
  if (c.current === null) return `${c.label}: no data yet`;
  const vd = valueDigits(c.current, c.target);
  return `${c.label}: ${fmtNum(c.current, vd)} → ${fmtNum(c.target, digitsFor(c.target))} · +${fmtNum(c.target - c.current, Math.max(vd, digitsFor(c.target)))} needed`;
}

function verdict(scout: ScoutProgress): { title: string; sub: string; tone: "cleared" | "close" | "building" } {
  const open = scout.criteria.filter((c) => !c.met);
  if (scout.status === "reported")
    return { title: "Report filed", sub: `On the FaZe recruiter dashboard · status: ${scout.report?.status ?? "new"}`, tone: "cleared" };
  if (scout.criteria.length && !open.length) return { title: "All bars cleared", sub: "Scout report is being generated.", tone: "cleared" };
  if (open.length === 1) return { title: "1 bar away", sub: gapText(open[0]!), tone: "close" };
  return { title: `${open.length} bars to go`, sub: open.slice(0, 2).map(gapText).join(" · "), tone: open.length <= 2 ? "close" : "building" };
}

const tierFor = (pct: number | null) => (pct === null ? "" : pct >= 90 ? "elite" : pct >= 70 ? "strong" : pct >= 40 ? "mid" : "low");

const CONSISTENCY_COPY: Record<string, string> = {
  high: "Performs the same night to night",
  steady: "Small swings between sessions",
  streaky: "Big swings between sessions",
};

export function ScoutDossier({ scout, dossier }: { scout: ScoutProgress; dossier: Dossier }) {
  if (scout.status === "unavailable" && !dossier.percentiles.length) return null;
  const v = verdict(scout);
  const pct = Math.round((scout.progress ?? 0) * 100);
  const { form } = dossier;

  return (
    <section className={`pf-dossier pf-rise is-${v.tone}`} aria-labelledby="pf-dossier-h">
      <header className="pf-dossier__head">
        <p className="pf-kicker"><span className="pf-kicker__bar" />Scout dossier<span className="pf-kicker__dim">· what a FaZe recruiter sees</span></p>
        <div className="pf-dossier__titles">
          <h2 id="pf-dossier-h" className="pf-display pf-dossier__title">Road to FaZe Up Next</h2>
          <div className="pf-verdict">
            <span className="pf-verdict__pct">{scout.status === "reported" ? "✓" : `${pct}%`}</span>
            <span className="pf-verdict__text">
              <strong>{v.title}</strong>
              <span>{v.sub}</span>
            </span>
          </div>
        </div>
      </header>

      {scout.criteria.length > 0 && (
        <ol className="pf-trace" aria-label="Scouting bars">
          {scout.criteria.map((c, i) => (
            <li key={c.metric} className={`pf-trace__stop ${c.met ? "is-met" : "is-open"}`} style={{ ["--i" as string]: i }}>
              {i < scout.criteria.length - 1 && <span className={`pf-trace__seg ${c.met ? "is-met" : ""}`} aria-hidden />}
              <span className="pf-trace__node" aria-hidden />
              <span className="pf-trace__label">{c.label}</span>
              <span className="pf-trace__val">
                {c.current === null ? "–" : fmtNum(c.current, valueDigits(c.current, c.target))}
                <span className="pf-trace__target"> / {fmtNum(c.target, digitsFor(c.target))}</span>
              </span>
              <span className="pf-sr">{c.met ? "met" : "not met"}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="pf-dossier__grid">
        {dossier.percentiles.length > 0 && (
          <div className="pf-dcol">
            <h3 className="pf-dcol__h">Vs. the player pool</h3>
            <ul className="pf-pct">
              {dossier.percentiles.map((m) => (
                <li key={m.metric} className={`pf-pct__row tier-${tierFor(m.better_than_pct)}`}>
                  <span className="pf-pct__label">{m.label}</span>
                  <span className="pf-pct__bar" aria-hidden><span style={{ width: `${m.better_than_pct ?? 0}%` }} /></span>
                  <span className="pf-pct__val">
                    {m.better_than_pct === null ? "–" : <>Top {Math.max(1, 100 - m.better_than_pct)}%</>}
                  </span>
                </li>
              ))}
            </ul>
            <p className="pf-dcol__foot">Latest value vs {dossier.percentiles[0]?.pool ?? 0} tracked players</p>
          </div>
        )}

        {form.days_tracked > 0 && (
          <div className="pf-dcol">
            <h3 className="pf-dcol__h">Form · last {form.days_tracked} days</h3>
            <dl className="pf-form">
              <FormRow label="ELO" v={form.elo_delta} digits={0} />
              <FormRow label="K/D" v={form.kd_delta} digits={2} />
              <FormRow label="ADR" v={form.adr_delta} digits={1} />
              <FormRow label="HS%" v={form.hs_delta} digits={1} />
            </dl>
            {form.consistency && (
              <div className={`pf-consistency is-${form.consistency}`}>
                <span className="pf-consistency__tag">{form.consistency}</span>
                <span>{CONSISTENCY_COPY[form.consistency]}</span>
              </div>
            )}
          </div>
        )}

      </div>
    </section>
  );
}

function FormRow({ label, v, digits }: { label: string; v: number | null; digits: number }) {
  if (v === null) return null;
  const flat = Math.abs(v) < Math.pow(10, -digits) / 2;
  return (
    <div className="pf-form__row">
      <dt>{label}</dt>
      <dd className={flat ? "" : v > 0 ? "is-up" : "is-down"}>
        {flat ? "±0" : fmtSigned(v, digits)}
        <span className="pf-form__arrow" aria-hidden>{flat ? "→" : v > 0 ? "↗" : "↘"}</span>
      </dd>
    </div>
  );
}
