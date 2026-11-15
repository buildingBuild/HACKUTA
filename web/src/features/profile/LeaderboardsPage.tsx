import { useState } from "react";
import "./profile.css";
import "./leaderboards.css";
import { FazeLogo } from "../../components/FazeLogo";
import { fetchLeaderboard, profileUrl } from "./api";
import { Avatar, LevelBadge, StateBox } from "./components";
import { usePolling } from "./usePolling";
import { useRankMoves, type RankMove } from "./useRankMoves";
import { fmtCompact, fmtLeaderboardValue } from "./format";
import type { LeaderboardType } from "./types";

// Leaderboards (owner: Omar). Visual pass by Joe: podium + bar rows + "you" bar.
// Data, polling, rank moves and props are unchanged.

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

export function LeaderboardsPage({ initialType = "elo", highlightHandle, limit = 20 }: LeaderboardsPageProps) {
  const [type, setType] = useState<LeaderboardType>(initialType);
  const [windowDays, setWindowDays] = useState<number>(30);
  const windowed = type === "improvement" || type === "creator-growth";
  const { data, error, loading } = usePolling(() => fetchLeaderboard(type, { limit, window: windowed ? windowDays : undefined }), [type, windowDays, limit]);
  const tab = TABS.find((t) => t.type === type)!;
  const board = windowed ? `${type}:${windowDays}` : type;
  const { moves, flashing } = useRankMoves(board, data && data.type === type ? data : null);

  const ready = data && data.type === type ? data : null;
  const entries = ready?.entries ?? [];
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);
  const fmt = (v: number) => fmtLeaderboardValue(type, v);
  const me = highlightHandle ? entries.find((e) => e.handle === highlightHandle) : undefined;
  const ahead = me ? entries.find((e) => e.rank === me.rank - 1) : undefined;

  return (
    <div className="pf-root lbx">
      <header className="lbx-head">
        <div>
          <p className="lbx-kicker">
            <span className="lbx-live" /> Top 20 · live
          </p>
          <h1 className="lbx-title">Leaderboards</h1>
        </div>
        <p className="lbx-blurb">
          {tab.blurb}
          {windowed && ` Last ${windowDays} days.`}
        </p>
      </header>

      <div className="lbx-tabs" role="tablist" aria-label="Leaderboard type">
        {TABS.map((t) => (
          <button
            key={t.type}
            type="button"
            role="tab"
            aria-selected={type === t.type}
            className={`lbx-tab ${type === t.type ? "is-active" : ""}`}
            onClick={() => setType(t.type)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {windowed && (
        <div className="lbx-window" role="group" aria-label="Time window">
          <span>Window</span>
          {WINDOWS.map((w) => (
            <button key={w} type="button" className={windowDays === w ? "is-active" : ""} aria-pressed={windowDays === w} onClick={() => setWindowDays(w)}>
              {w}d
            </button>
          ))}
        </div>
      )}

      <section role="tabpanel" aria-label={tab.label}>
        {loading && !data ? (
          <StateBox kind="loading">Loading…</StateBox>
        ) : !data ? (
          <StateBox kind="error">Couldn't load the leaderboard. {error?.message}</StateBox>
        ) : !ready ? (
          <StateBox kind="loading">Loading…</StateBox>
        ) : entries.length === 0 ? (
          <div className="lbx-empty">
            <FazeLogo className="lbx-empty__logo" />
            <h2>Nobody on this board yet.</h2>
            <p>
              {type === "creator-growth"
                ? "Link YouTube or Twitch and your follower growth starts counting. First one here takes the crown."
                : "Be the first name up here."}
            </p>
            <a className="lbx-empty__cta" href="/join">Get on the board →</a>
          </div>
        ) : (
          <div key={board} className="lbx-body">
            {/* podium: 2 · 1 · 3 */}
            <ol className="lbx-podium">
              {[podium[1], podium[0], podium[2]].map((e, slot) =>
                e ? (
                  <li
                    key={e.handle}
                    className={`lbx-step lbx-step--${e.rank} ${e.handle === highlightHandle ? "is-me" : ""} ${flashing.has(e.handle) ? "is-moved" : ""}`}
                    style={{ ["--d" as string]: `${[180, 420, 0][slot]}ms` }}
                  >
                    <a className="lbx-step__card" href={profileUrl(e.handle)}>
                      <span className="lbx-step__avatar">
                        <Avatar name={e.display_name} url={e.avatar_url} size={e.rank === 1 ? 88 : 72} />
                        <LevelBadge level={e.faceit_level} size="sm" />
                      </span>
                      <strong className="lbx-step__name">{e.display_name}</strong>
                      <span className="lbx-step__handle">
                        @{e.handle} <MoveBadge move={moves[e.handle]} />
                      </span>
                      <span className="lbx-step__value">
                        {fmt(e.value)}
                      </span>
                      <span className="lbx-step__unit">
                        {ready.unit}
                        {e.sample !== undefined && ` · ${fmtCompact(e.sample)} followers`}
                      </span>
                    </a>
                    <span className="lbx-step__base">
                      {e.rank}
                    </span>
                  </li>
                ) : (
                  <li key={`empty-${slot}`} className="lbx-step lbx-step--void" aria-hidden />
                ),
              )}
            </ol>

            {rest.length > 0 && (
              <ol className="lbx-list" start={4}>
                {rest.map((e, i) => {
                  return (
                    <li
                      key={e.handle}
                      className={`lbx-row ${e.handle === highlightHandle ? "is-me" : ""} ${flashing.has(e.handle) ? "is-moved" : ""}`}
                      style={{ ["--i" as string]: i }}
                    >
                      <span className="lbx-row__rank">
                        {String(e.rank).padStart(2, "0")}
                        <MoveBadge move={moves[e.handle]} />
                      </span>
                      <a className="lbx-row__player" href={profileUrl(e.handle)}>
                        <Avatar name={e.display_name} url={e.avatar_url} size={44} />
                        <span className="lbx-row__names">
                          <strong>{e.display_name}</strong>
                          <span>@{e.handle}</span>
                        </span>
                      </a>
                      <LevelBadge level={e.faceit_level} size="sm" />
                      <span className="lbx-row__value">
                        {fmt(e.value)}
                        {e.sample !== undefined && <small>{fmtCompact(e.sample)} followers</small>}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}

            <p className="lbx-thanks">
              <FazeLogo className="lbx-thanks__logo" />
              <span>
                <b>Thank you</b> to every fan on the board, day ones and new blood. FaZe up.
              </span>
            </p>

            {me && (
              <div className="lbx-you">
                <Avatar name={me.display_name} url={me.avatar_url} size={36} />
                <span>
                  You're <b>#{me.rank}</b> on {tab.label}
                  {ahead ? (
                    <> · {fmt(Math.abs(ahead.value - me.value)).replace(/^\+/, "")} behind {ahead.display_name}</>
                  ) : (
                    <> · top of the board. FaZe up.</>
                  )}
                </span>
                <a href={profileUrl(me.handle)}>Your profile →</a>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default LeaderboardsPage;
