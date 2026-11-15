import { useEffect, useMemo, useRef, useState } from "react";
import "./profile.css";
import { profileUrl } from "./api";
import { Avatar, StateBox } from "./components";
import { listProspects, PROSPECT_STATUSES, type ProspectRow, type ProspectStatus } from "./recruiterApi";
import { fmtNum } from "./format";

const POLL_MS = 5000;
const REGIONS = ["NA", "EU", "SA", "OCE", "SEA"];
const LEVELS = [10, 9, 8];
type StatusTab = "all" | ProspectStatus;

const levelTier = (l: number) => (l >= 10 ? "top" : l >= 8 ? "high" : l >= 4 ? "mid" : "low");

/**
 * FaZe recruiter pipeline (staff only; Yao's API enforces the role).
 * Status tabs double as pipeline counts; rows open the player's portfolio in recruiter mode.
 */
export function ProspectBoard() {
  const [all, setAll] = useState<ProspectRow[] | null>(null);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const [tab, setTab] = useState<StatusTab>("all");
  const [track, setTrack] = useState<"player" | "creator" | "">("player");
  const [region, setRegion] = useState("");
  const [minLevel, setMinLevel] = useState(0);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { prospects } = await listProspects(track ? { track } : {});
        if (cancelled) return;
        if (known.current) {
          const arrived = prospects.filter((p) => !known.current!.has(p.id));
          if (arrived.length) {
            setFresh((s) => new Set([...s, ...arrived.map((p) => p.id)]));
            setToast(`New prospect: @${arrived[0]!.handle}${arrived.length > 1 ? ` +${arrived.length - 1}` : ""}`);
            window.setTimeout(() => setToast(null), 6000);
          }
        }
        known.current = new Set(prospects.map((p) => p.id));
        setAll(prospects);
        setError(null);
      } catch (e) {
        if (!cancelled) setError({ message: (e as Error).message, status: (e as { status?: number }).status });
      }
    };
    known.current = null;
    void load();
    const t = window.setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [track]);

  const scoped = useMemo(
    () => (all ?? []).filter((p) => (!region || p.region === region) && (!minLevel || (p.faceit_level ?? 0) >= minLevel)),
    [all, region, minLevel],
  );
  const counts = useMemo(() => {
    const c: Record<StatusTab, number> = { all: scoped.length, new: 0, reviewing: 0, contacted: 0, passed: 0 };
    for (const p of scoped) c[p.status]++;
    return c;
  }, [scoped]);
  const rows = tab === "all" ? scoped : scoped.filter((p) => p.status === tab);

  const denied = error && (error.status === 401 || error.status === 403);

  return (
    <div className="pf-root pf-board">
      {toast && <div className="pf-toast" role="status">{toast}</div>}

      <header className="pf-board__hero pf-rise">
        <p className="pf-kicker"><span className="pf-kicker__bar" />FaZe recruiter<span className="pf-kicker__dim">· staff only · live</span></p>
        <h1 className="pf-display pf-board__title">Talent pipeline<span className="pf-accent">.</span></h1>
        <p className="pf-board__lede">Players who cleared the FaZe Up Next bar, ranked by prospect score. Open one to see their dossier, AI scout report and flagged clip moments.</p>
      </header>

      {denied ? (
        <StateBox kind="error">Recruiter or admin account required. Use Demo login → FaZe Recruiter.</StateBox>
      ) : (
        <>
          <nav className="pf-pipeline pf-rise" aria-label="Pipeline status">
            {(["all", ...PROSPECT_STATUSES] as StatusTab[]).map((s, i) => (
              <button key={s} type="button" className={`pf-pipeline__stage ${tab === s ? "is-active" : ""} st-${s}`} onClick={() => setTab(s)} aria-pressed={tab === s}>
                <span className="pf-label">{String(i).padStart(2, "0")} · {s}</span>
                <span className="pf-display pf-pipeline__count">{counts[s]}</span>
              </button>
            ))}
          </nav>

          <div className="pf-board__filters pf-rise">
            <div className="pf-seg" role="group" aria-label="Track">
              {([["player", "Players"], ["creator", "Creators"], ["", "All"]] as const).map(([v, l]) => (
                <button key={l} type="button" className={track === v ? "is-active" : ""} onClick={() => setTrack(v)} aria-pressed={track === v}>{l}</button>
              ))}
            </div>
            <div className="pf-seg" role="group" aria-label="Region">
              <button type="button" className={!region ? "is-active" : ""} onClick={() => setRegion("")}>Any region</button>
              {REGIONS.map((r) => (
                <button key={r} type="button" className={region === r ? "is-active" : ""} onClick={() => setRegion(r)} aria-pressed={region === r}>{r}</button>
              ))}
            </div>
            <div className="pf-seg" role="group" aria-label="Minimum FACEIT level">
              <button type="button" className={!minLevel ? "is-active" : ""} onClick={() => setMinLevel(0)}>Any level</button>
              {LEVELS.map((l) => (
                <button key={l} type="button" className={minLevel === l ? "is-active" : ""} onClick={() => setMinLevel(l)} aria-pressed={minLevel === l}>L{l}+</button>
              ))}
            </div>
          </div>

          <section className="pf-panel pf-board__list" aria-label="Prospects">
            {!all && !error && <StateBox kind="loading">Loading prospects…</StateBox>}
            {error && !denied && <StateBox kind="error">{error.message}</StateBox>}
            {all && rows.length === 0 && <StateBox kind="empty">No prospects match these filters yet.</StateBox>}
            {rows.length > 0 && (
              <ol className="pf-prospects">
                {rows.map((p, i) => (
                  <li key={p.id}>
                    <a className={`pf-prospect ${fresh.has(p.id) ? "is-fresh" : ""}`} href={profileUrl(p.handle)}>
                      <span className="pf-prospect__rank">{String(i + 1).padStart(2, "0")}</span>
                      <span className="pf-prospect__who">
                        <Avatar name={p.display_name || p.handle} url={p.avatar_url} size={44} />
                        <span className="pf-prospect__names">
                          <strong className="pf-display">{p.display_name || p.handle}</strong>
                          <span className="pf-label">@{p.handle} · {p.region ?? "—"} · {p.track}{fresh.has(p.id) ? " · just in" : ""}</span>
                        </span>
                      </span>
                      <span className="pf-prospect__lvl">
                        {p.faceit_level !== null && <span className={`pf-diamond pf-diamond--sm tier-${levelTier(p.faceit_level)}`}><span>{p.faceit_level}</span></span>}
                        <span className="pf-prospect__elo"><strong className="pf-display">{fmtNum(p.faceit_elo)}</strong><span className="pf-label">ELO</span></span>
                      </span>
                      <span className="pf-prospect__stats">
                        <Stat label="K/D" v={p.metrics?.kd} d={2} />
                        <Stat label="HS%" v={p.metrics?.hs_pct} d={0} />
                        <Stat label="ADR" v={p.metrics?.adr} d={0} />
                        <Stat label="AI" v={p.metrics?.avg_clip_score} d={0} />
                      </span>
                      <span className="pf-prospect__score">
                        <strong className="pf-display">{p.score ?? "–"}</strong>
                        <span className="pf-label">score</span>
                      </span>
                      <span className={`pf-status st-${p.status}`}>{p.status}</span>
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, v, d }: { label: string; v: number | null | undefined; d: number }) {
  return (
    <span className="pf-prospect__stat">
      <span className="pf-label">{label}</span>
      <strong>{v == null ? "–" : fmtNum(v, d)}</strong>
    </span>
  );
}

export default ProspectBoard;
