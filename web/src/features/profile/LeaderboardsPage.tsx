import { useState } from "react";
import "./profile.css";
import { fetchLeaderboard, profileUrl } from "./api";
import { Avatar, LevelBadge, StateBox } from "./components";
import { usePolling } from "./usePolling";
import { useRankMoves, type RankMove } from "./useRankMoves";

function MoveBadge({ move }: { move: RankMove | undefined }) {
  if (!move) return <span className="pf-move" aria-hidden />;
  if (move.kind === "new") return <span className="pf-move pf-move--new" title="New on this board since your last visit">NEW</span>;
  const up = move.kind === "up";
  return (
    <span className={`pf-move ${up ? "pf-move--up" : "pf-move--down"}`} title={`${up ? "Up" : "Down"} ${move.by} since your last visit`}>
      {up ? "▲" : "▼"}{move.by}
    </span>
  );
}
import { fmtCompact, fmtLeaderboardValue } from "./format";
import type { LeaderboardType } from "./types";

const TABS: { type: LeaderboardType; label: string; blurb: string }[] = [
  { type: "elo", label: "ELO", blurb: "Highest FACEIT ELO right now." },
  { type: "improvement", label: "Most improved", blurb: "Biggest ELO gain over the window." },
  { type: "creator-growth", label: "Creator growth", blurb: "Follower growth across linked socials." },
  { type: "karma", label: "Karma", blurb: "Upvotes earned in the community." },
];

const WINDOWS = [7, 30, 90] as const;

export type LeaderboardsPageProps = {
  initialType?: LeaderboardType;
  /** Highlight a row, e.g. the signed-in player's handle. */
  highlightHandle?: string;
  limit?: number;
};

export function LeaderboardsPage({ initialType = "elo", highlightHandle, limit = 25 }: LeaderboardsPageProps) {
  const [type, setType] = useState<LeaderboardType>(initialType);
  const [windowDays, setWindowDays] = useState<number>(30);
  const windowed = type === "improvement" || type === "creator-growth";
  const { data, error, loading } = usePolling(() => fetchLeaderboard(type, { limit, window: windowed ? windowDays : undefined }), [type, windowDays, limit]);
  const tab = TABS.find((t) => t.type === type)!;
  const board = windowed ? `${type}:${windowDays}` : type;
  const { moves, flashing } = useRankMoves(board, data && data.type === type ? data : null);

  return (
    <div className="pf-root">
      <header className="pf-lb-head">
        <p className="pf-eyebrow">Season leaderboards</p>
        <h1 className="pf-h1">Leaderboards</h1>
      </header>

      <div className="pf-tabs" role="tablist" aria-label="Leaderboard type">
        {TABS.map((t) => (
          <button key={t.type} type="button" role="tab" aria-selected={type === t.type} className={`pf-tab ${type === t.type ? "is-active" : ""}`} onClick={() => setType(t.type)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="pf-lb-sub">
        <p className="pf-muted">{tab.blurb}</p>
        {windowed && (
          <div className="pf-seg" role="group" aria-label="Time window">
            {WINDOWS.map((w) => (
              <button key={w} type="button" className={windowDays === w ? "is-active" : ""} aria-pressed={windowDays === w} onClick={() => setWindowDays(w)}>
                {w}d
              </button>
            ))}
          </div>
        )}
      </div>

      <section className="pf-card pf-card--flush" role="tabpanel" aria-label={tab.label}>
        {loading && !data ? (
          <StateBox kind="loading">Loading…</StateBox>
        ) : !data ? (
          <StateBox kind="error">Couldn't load the leaderboard. {error?.message}</StateBox>
        ) : data.type !== type ? (
          <StateBox kind="loading">Loading…</StateBox>
        ) : data.entries.length === 0 ? (
          <StateBox kind="empty">Nobody on this board yet.</StateBox>
        ) : (
          <ol className="pf-lb">
            {data.entries.map((e) => (
              <li key={e.handle} className={`pf-lb__row ${e.rank <= 3 ? `is-top is-top-${e.rank}` : ""} ${e.handle === highlightHandle ? "is-me" : ""} ${flashing.has(e.handle) ? "is-moved" : ""}`}>
                <span className="pf-lb__rank">
                  {e.rank}
                  <MoveBadge move={moves[e.handle]} />
                </span>
                <a className="pf-lb__player" href={profileUrl(e.handle)}>
                  <Avatar name={e.display_name} url={e.avatar_url} size={36} />
                  <span className="pf-lb__names">
                    <strong>{e.display_name}</strong>
                    <span className="pf-muted">@{e.handle}</span>
                  </span>
                </a>
                <LevelBadge level={e.faceit_level} size="sm" />
                <span className="pf-lb__value">
                  {fmtLeaderboardValue(type, e.value)}
                  {e.sample !== undefined && (
                    <span className="pf-muted pf-lb__sample">
                      {`${fmtCompact(e.sample)} followers`}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export default LeaderboardsPage;
