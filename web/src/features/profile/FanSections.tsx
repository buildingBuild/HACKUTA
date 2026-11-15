// Fan-profile sections (V3 pivot, drafted by Yao for Omar): editable bio, community activity,
// and placeholder slots for Phase 2 badges (Guessr streak, pixels placed, synced setup).
import { useState } from "react";
import { api } from "../../components/api";
import type { Activity } from "./types";

function ago(iso: string): string {
  const h = Math.max(0, (Date.now() - Date.parse(iso)) / 3600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function joinedLabel(iso: string): string {
  return `Joined ${new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`;
}

/** Bio with inline edit for the owner. */
export function BioEditor({ handle, bio, canEdit, onSaved }: { handle: string; bio: string | null; canEdit: boolean; onSaved: (bio: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(bio ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const out = await api<{ bio: string | null }>(`/api/profiles/${encodeURIComponent(handle)}`, { method: "PATCH", body: JSON.stringify({ bio: draft }) });
      onSaved(out.bio);
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (editing)
    return (
      <div className="pf-bioedit">
        <textarea
          className="pf-bioedit__input"
          value={draft}
          maxLength={280}
          rows={3}
          autoFocus
          placeholder="Tell the fam who you are: favorite era, main, the match that made you a fan."
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="pf-bioedit__row">
          <span className="pf-label">{draft.length}/280</span>
          {error && <span className="pf-bioedit__err">{error}</span>}
          <button type="button" className="pf-btn" onClick={() => { setEditing(false); setDraft(bio ?? ""); }} disabled={saving}>Cancel</button>
          <button type="button" className="pf-btn pf-btn--primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save bio"}</button>
        </div>
      </div>
    );

  return (
    <div className="pf-biorow">
      {bio ? <p className="pf-bio">{bio}</p> : canEdit ? <p className="pf-bio pf-muted">No bio yet.</p> : null}
      {canEdit && (
        <button type="button" className="pf-linkbtn" onClick={() => setEditing(true)}>
          {bio ? "Edit bio" : "Add a bio"}
        </button>
      )}
    </div>
  );
}

/** Recent threads + comments from Community. */
export function ActivityPanel({ activity, isMe, karma }: { activity: Activity; isMe: boolean; karma: number }) {
  const empty = activity.threads.length === 0 && activity.comments.length === 0;
  return (
    <section className="pf-panel pf-rise" aria-labelledby="pf-activity-h">
      <div className="pf-panel__head">
        <p className="pf-kicker">
          <span className="pf-kicker__bar" />Community
          <span className="pf-kicker__dim">· {karma} karma · {activity.thread_count} threads · {activity.comment_count} comments</span>
        </p>
        <h2 id="pf-activity-h" className="pf-display pf-h2">Activity</h2>
      </div>
      {empty ? (
        <p className="pf-muted">
          {isMe ? "Nothing yet. " : "No community activity yet. "}
          <a href="/community">{isMe ? "Start a thread →" : "Visit Community →"}</a>
        </p>
      ) : (
        <ul className="pf-activity">
          {activity.threads.map((t) => (
            <li key={`t-${t.id}`}>
              <a href={`/community?thread=${encodeURIComponent(t.id)}`} className="pf-activity__item">
                <span className="pf-activity__score">{t.score}</span>
                <span className="pf-activity__body">
                  <strong>{t.title}</strong>
                  <span className="pf-label">Posted in {t.board_name} · {ago(t.created_at)} · {t.comment_count} comments</span>
                </span>
              </a>
            </li>
          ))}
          {activity.comments.map((c) => (
            <li key={`c-${c.id}`}>
              <a href={`/community?thread=${encodeURIComponent(c.thread_id)}`} className="pf-activity__item">
                <span className="pf-activity__score pf-activity__score--c">{c.score}</span>
                <span className="pf-activity__body">
                  <span className="pf-activity__quote">“{c.body}”</span>
                  <span className="pf-label">On {c.thread_title} · {ago(c.created_at)}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const SLOTS = [
  { key: "guessr", label: "Guessr streak", mark: "?", href: "/guessr" },
  { key: "wall", label: "Pixels placed", mark: "▦", href: "/wall" },
  { key: "rgb", label: "Synced setup", mark: "RGB", href: "/rgb" },
];

/** Phase 2 badge slots: render now so the layout is final; values arrive with each feature. */
export function FanBadges() {
  return (
    <section className="pf-panel pf-rise" aria-labelledby="pf-fanbadges-h">
      <div className="pf-panel__head">
        <p className="pf-kicker"><span className="pf-kicker__bar" />FaZe HQ</p>
        <h2 id="pf-fanbadges-h" className="pf-display pf-h2">Fan badges</h2>
      </div>
      <ul className="pf-fanbadges">
        {SLOTS.map((s) => (
          <li key={s.key}>
            <a href={s.href} className="pf-fanbadge">
              <span className="pf-fanbadge__mark" aria-hidden>{s.mark}</span>
              <span>
                <strong>{s.label}</strong>
                <span className="pf-label">Unlocks soon</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
