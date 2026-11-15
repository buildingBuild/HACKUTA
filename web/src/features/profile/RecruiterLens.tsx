import { useEffect, useState } from "react";
import { getProspectReport, PROSPECT_STATUSES, setProspectStatus, type ProspectReport, type ProspectStatus } from "./recruiterApi";
import type { ScoutProgress } from "./types";

/** Where the pipeline board lives (App.tsx routes it). */
export const PIPELINE_URL = "/recruiting";

const STATUS_COPY: Record<ProspectStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  contacted: "Contacted",
  passed: "Passed",
};

/**
 * Staff-only bar on top of a player's profile: the scout report, prospect score and
 * status workflow. Reads/writes Yao's scouting routes.
 */
export function RecruiterLens({ scout, displayName }: { scout: ScoutProgress; displayName: string }) {
  const reportId = scout.report?.id ?? null;
  const [report, setReport] = useState<ProspectReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!reportId) return;
    getProspectReport(reportId).then((r) => setReport(r.report), (e: Error) => setError(e.message));
  }, [reportId]);

  async function changeStatus(status: ProspectStatus) {
    if (!report || status === report.status) return;
    const prev = report.status;
    setReport({ ...report, status });
    setSaving(true);
    try {
      await setProspectStatus(report.id, status);
    } catch (e) {
      setReport({ ...report, status: prev });
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Player isn't in the pipeline yet: slim bar with how close they are.
  if (!reportId) {
    const pct = Math.round((scout.progress ?? 0) * 100);
    const open = scout.criteria.filter((c) => !c.met).length;
    return (
      <section className="pf-lens pf-lens--slim pf-rise" aria-label="Recruiter view">
        <span className="pf-lens__tag">Recruiter view</span>
        <span className="pf-lens__slim-text">
          Not in the pipeline yet · <strong>{pct}%</strong> to the bar{open ? ` · ${open} bar${open === 1 ? "" : "s"} left` : ""}
        </span>
        <a className="pf-lens__back" href={PIPELINE_URL}>← Pipeline</a>
      </section>
    );
  }

  const score = report?.evidence?.score ?? report?.score ?? null;
  const statusIdx = report ? PROSPECT_STATUSES.indexOf(report.status) : -1;

  return (
    <section className="pf-lens pf-rise" aria-label="Recruiter view">
      <div className="pf-lens__top">
        <span className="pf-lens__tag">Recruiter view · staff only</span>
        <a className="pf-lens__back" href={PIPELINE_URL}>← Pipeline</a>
      </div>

      <div className="pf-lens__grid">
        <div className="pf-lens__score">
          <span className="pf-display pf-lens__score-num">{score ?? "–"}</span>
          <span className="pf-label">Prospect score</span>
        </div>

        <blockquote className="pf-lens__report">
          <p className="pf-kicker"><span className="pf-kicker__bar" />Scout report{report?.evidence?.rule_label ? <span className="pf-kicker__dim">· {report.evidence.rule_label}</span> : null}</p>
          <p className="pf-lens__summary">{report ? report.summary : error ? `Couldn't load the report: ${error}` : "Loading report…"}</p>
        </blockquote>

        <div className="pf-lens__status">
          <p className="pf-label">Pipeline status{saving ? " · saving…" : ""}</p>
          <ol className="pf-steps" aria-label={`Status for ${displayName}`}>
            {PROSPECT_STATUSES.map((s, i) => (
              <li key={s}>
                <button
                  type="button"
                  className={`pf-step ${i < statusIdx ? "is-done" : ""} ${i === statusIdx ? "is-current" : ""} ${s === "passed" ? "is-pass" : ""}`}
                  onClick={() => changeStatus(s)}
                  disabled={!report || saving}
                  aria-pressed={i === statusIdx}
                >
                  <span className="pf-step__node" aria-hidden />
                  <span className="pf-step__label">{STATUS_COPY[s]}</span>
                </button>
              </li>
            ))}
          </ol>
          {error && report && <p className="pf-lens__error">{error}</p>}
        </div>
      </div>
    </section>
  );
}
