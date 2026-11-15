import { useEffect, useRef, useState } from "react";
import type { ScoutProgress } from "./types";

const FRESH_MS = 3 * 60_000; // a report this new still gets the moment on first load
const seenKey = (reportId: string) => `pf-celebrated:${reportId}`;

function alreadySeen(id: string): boolean {
  try {
    return localStorage.getItem(seenKey(id)) === "1";
  } catch {
    return false;
  }
}
function markSeen(id: string) {
  try {
    localStorage.setItem(seenKey(id), "1");
  } catch {
    /* storage blocked: may celebrate twice, harmless */
  }
}

/**
 * Fires once when a scout report appears for this player: either the status flips to
 * "reported" while the page is open (the live demo moment), or the page is opened
 * within a few minutes of the report being filed.
 */
export function useScoutCelebration(scout: ScoutProgress): { show: boolean; dismiss: () => void } {
  const prev = useRef<ScoutProgress["status"] | null>(null);
  const [show, setShow] = useState(false);
  const report = scout.report;

  useEffect(() => {
    const before = prev.current;
    prev.current = scout.status;
    if (scout.status !== "reported" || !report || alreadySeen(report.id)) return;
    const flipped = before !== null && before !== "reported";
    const fresh = before === null && Date.now() - new Date(report.created_at).getTime() < FRESH_MS;
    if (flipped || fresh) {
      markSeen(report.id);
      setShow(true);
    }
  }, [scout.status, report]);

  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(() => setShow(false), 9000);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShow(false);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [show]);

  return { show, dismiss: () => setShow(false) };
}

export function ScoutCelebration({ handle, displayName, isMe, onClose }: { handle: string; displayName: string; isMe: boolean; onClose: () => void }) {
  return (
    <div className="pf-celebrate" role="alertdialog" aria-labelledby="pf-celebrate-h" aria-describedby="pf-celebrate-d" onClick={onClose}>
      <div className="pf-celebrate__streaks" aria-hidden>
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} style={{ ["--i" as string]: i }} />
        ))}
      </div>
      <div className="pf-celebrate__card" onClick={(e) => e.stopPropagation()}>
        <p className="pf-celebrate__kicker">Threshold cleared</p>
        <h2 id="pf-celebrate-h" className="pf-celebrate__title">
          Scout report
          <br />
          sent to FaZe
        </h2>
        <p id="pf-celebrate-d" className="pf-celebrate__sub">
          {isMe ? "You're on the recruiter dashboard. Keep uploading, they're watching." : `@${handle} (${displayName}) just landed on the recruiter dashboard.`}
        </p>
        <button type="button" className="pf-btn pf-btn--primary" onClick={onClose} autoFocus>
          {isMe ? "Let's go" : "Nice"}
        </button>
      </div>
    </div>
  );
}
