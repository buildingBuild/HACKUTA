import { useState, type FormEvent } from "react";
import { linkFaceit, syncFaceit, type FaceitSyncResult } from "./api";

type Props = {
  handle: string;
  userId: string;
  nickname: string | null;
  /** Refetch the profile after a link/sync. */
  onSynced: () => void;
  /** Sidebar style (player already has stats). */
  compact?: boolean;
};

type State = { kind: "idle" } | { kind: "busy"; label: string } | { kind: "done"; result: FaceitSyncResult } | { kind: "error"; message: string };

function describe(r: FaceitSyncResult): { tone: "ok" | "warn"; text: string } {
  if (r.source === "faceit") {
    const n = Object.values(r.stats).filter((v) => v != null).length;
    return { tone: "ok", text: `Synced ${n} stats from FACEIT.${r.scouting?.created.length ? " You just crossed a scouting bar!" : ""}` };
  }
  const hasAny = Object.values(r.stats).some((v) => v != null);
  return {
    tone: "warn",
    text: hasAny
      ? `Couldn't reach FACEIT right now, so you're seeing your last saved stats. (${r.error ?? "unavailable"})`
      : `Nickname saved, but FACEIT couldn't be reached, so no stats yet. Try "Sync" again in a bit. (${r.error ?? "unavailable"})`,
  };
}

/** Owner-only card: link a FACEIT nickname (first time) or re-sync stats. */
export function FaceitLink({ handle, userId, nickname, onSynced, compact = false }: Props) {
  const [value, setValue] = useState(nickname ?? "");
  const [editing, setEditing] = useState(!nickname);
  const [state, setState] = useState<State>({ kind: "idle" });
  const busy = state.kind === "busy";

  async function run(fn: () => Promise<FaceitSyncResult>, label: string) {
    setState({ kind: "busy", label });
    try {
      const result = await fn();
      setState({ kind: "done", result });
      setEditing(false);
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    } finally {
      onSynced();
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (v.length < 2 || busy) return;
    void run(() => linkFaceit(handle, v), "Linking and pulling your stats…");
  };

  const msg = state.kind === "done" ? describe(state.result) : null;

  return (
    <section className={`pf-card pf-faceit ${compact ? "" : "pf-faceit--empty"}`} aria-labelledby="pf-faceit-h">
      <div className="pf-card__head">
        <h2 id="pf-faceit-h" className="pf-h2">{nickname ? "FACEIT" : "Link your FACEIT"}</h2>
        {nickname && !editing && (
          <span className="pf-faceit__linked">
            Linked as <strong>{nickname}</strong>
          </span>
        )}
      </div>

      {editing ? (
        <form className="pf-faceit__form" onSubmit={submit}>
          {!nickname && <p className="pf-muted pf-faceit__lede">Your level, ELO, K/D, HS% and ADR power your portfolio, the leaderboards and your scouting bars.</p>}
          <div className="pf-faceit__row">
            <label className="pf-visually-hidden" htmlFor="pf-faceit-input">FACEIT nickname</label>
            <input
              id="pf-faceit-input"
              className="pf-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="FACEIT nickname"
              autoComplete="off"
              spellCheck={false}
              maxLength={32}
              disabled={busy}
            />
            <button type="submit" className="pf-btn pf-btn--primary" disabled={busy || value.trim().length < 2}>
              {nickname ? "Save" : "Link FACEIT"}
            </button>
            {nickname && (
              <button type="button" className="pf-btn" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
            )}
          </div>
        </form>
      ) : (
        <div className="pf-faceit__row">
          <button type="button" className="pf-btn pf-btn--primary" disabled={busy} onClick={() => void run(() => syncFaceit(userId), "Pulling fresh stats…")}>
            ↻ Sync stats
          </button>
          <button type="button" className="pf-btn" disabled={busy} onClick={() => setEditing(true)}>Change nickname</button>
        </div>
      )}

      <p className={`pf-faceit__status ${msg ? `is-${msg.tone}` : ""} ${state.kind === "error" ? "is-error" : ""}`} aria-live="polite">
        {state.kind === "busy" && <><span className="pf-spinner" aria-hidden /> {state.label}</>}
        {msg?.text}
        {state.kind === "error" && state.message}
      </p>
    </section>
  );
}
