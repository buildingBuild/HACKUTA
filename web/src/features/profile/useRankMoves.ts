import { useEffect, useMemo, useRef, useState } from "react";
import type { Leaderboard } from "./types";

export type RankMove = { kind: "up" | "down"; by: number } | { kind: "new" } | null;

type Ranks = Record<string, number>;

const storeKey = (board: string) => `pf-lb-ranks:${board}`;

function load(board: string): Ranks | null {
  try {
    const raw = localStorage.getItem(storeKey(board));
    return raw ? (JSON.parse(raw) as Ranks) : null;
  } catch {
    return null;
  }
}
function save(board: string, ranks: Ranks) {
  try {
    localStorage.setItem(storeKey(board), JSON.stringify(ranks));
  } catch {
    /* storage blocked: arrows just won't persist across visits */
  }
}

/**
 * Rank movement per handle on a board:
 *  - arrows compare against the ranks this viewer saw on their previous visit (kept for the whole visit),
 *  - `flashing` marks rows whose rank changed since the last poll (the live moment).
 * On a first-ever visit the first load becomes the baseline, so live moves still get arrows.
 */
export function useRankMoves(board: string, data: Leaderboard | null) {
  const baseline = useRef<{ board: string; ranks: Ranks | null } | null>(null);
  const lastPoll = useRef<{ board: string; ranks: Ranks } | null>(null);
  const [flashing, setFlashing] = useState<Set<string>>(new Set());

  if (!baseline.current || baseline.current.board !== board) baseline.current = { board, ranks: load(board) };

  const current = useMemo<Ranks | null>(
    () => (data ? Object.fromEntries(data.entries.map((e) => [e.handle, e.rank])) : null),
    [data],
  );

  useEffect(() => {
    if (!current) return;
    if (baseline.current?.board === board && !baseline.current.ranks) baseline.current.ranks = current; // first-ever visit
    const prev = lastPoll.current?.board === board ? lastPoll.current.ranks : null;
    if (prev) {
      const changed = Object.keys(current).filter((h) => prev[h] !== current[h]);
      if (changed.length) {
        setFlashing(new Set(changed));
        const t = window.setTimeout(() => setFlashing(new Set()), 2400);
        lastPoll.current = { board, ranks: current };
        save(board, current);
        return () => window.clearTimeout(t);
      }
    }
    lastPoll.current = { board, ranks: current };
    save(board, current);
  }, [board, current]);

  const moves = useMemo(() => {
    const base = baseline.current?.ranks;
    const out: Record<string, RankMove> = {};
    if (!current || !base) return out;
    for (const [h, r] of Object.entries(current)) {
      const before = base[h];
      out[h] = before === undefined ? { kind: "new" } : before > r ? { kind: "up", by: before - r } : before < r ? { kind: "down", by: r - before } : null;
    }
    return out;
  }, [current, board]); // eslint-disable-line react-hooks/exhaustive-deps

  return { moves, flashing };
}
