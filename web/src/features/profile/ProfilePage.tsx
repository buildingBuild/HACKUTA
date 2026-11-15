import { useState } from "react";
import "./profile.css";
import { useSessionUser } from "../../components/session";
import { RecruiterLens } from "./RecruiterLens";
import { ApiError, fetchProfile, profileUrl } from "./api";
import { StateBox, TrendChart } from "./components";
import { ScoutDossier } from "./ScoutDossier";
import { ShareCard } from "./ShareCard";
import { ActivityPanel, BioEditor, FanBadges, joinedLabel } from "./FanSections";
import { FaceitLink } from "./FaceitLink";
import { ScoutCelebration, useScoutCelebration } from "./ScoutCelebration";
import { usePolling } from "./usePolling";
import { fmtCompact, fmtNum, fmtPct, fmtSigned } from "./format";
import type { Profile, StatKey } from "./types";

const STAT_TILES: { key: StatKey; label: string; digits: number; suffix?: string }[] = [
  { key: "elo", label: "ELO", digits: 0 },
  { key: "kd", label: "K/D", digits: 2 },
  { key: "hs_pct", label: "HS%", digits: 0, suffix: "%" },
  { key: "adr", label: "ADR", digits: 0 },
  { key: "win_rate", label: "Win rate", digits: 0, suffix: "%" },
];

const PLATFORM_LABEL: Record<string, string> = { faceit: "FACEIT", steam: "Steam", youtube: "YouTube", twitch: "Twitch", tiktok: "TikTok", x: "X", instagram: "Instagram", psn: "PSN", xbox: "Xbox" };

const levelTier = (level: number) => (level >= 10 ? "top" : level >= 8 ? "high" : level >= 4 ? "mid" : "low");

export type ProfilePageProps = {
  handle: string;
  /** Where a clip card links to. Defaults to /clips/:id (Joe's clip detail page). */
  clipHref?: (clip: Profile["clips"][number]) => string;
};

/** Public gamer resume at /u/:handle (REQUIREMENTS.md §5.4). */
export function ProfilePage({ handle, clipHref = (c) => c.social_post_url || c.blob_url || "#" }: ProfilePageProps) {
  // 5s so the live "clip pushes them over the bar" moment shows up fast on stage.
  const { data, error, loading, refresh } = usePolling(() => fetchProfile(handle), [handle], 5000);

  if (loading && !data) return <div className="pf-root"><StateBox kind="loading">Loading profile…</StateBox></div>;
  if (!data) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="pf-root">
        <StateBox kind={notFound ? "empty" : "error"}>
          {notFound ? <>No player called <strong>@{handle}</strong>.</> : <>Couldn't load this profile. {error?.message}</>}
        </StateBox>
      </div>
    );
  }
  return <ProfileView p={data} clipHref={clipHref} refresh={() => void refresh(true)} />;
}

function ProfileView({ p, clipHref, refresh }: { p: Profile; clipHref: (clip: Profile["clips"][number]) => string; refresh: () => void }) {
  const [trendKey, setTrendKey] = useState<StatKey>("elo");
  const [bio, setBio] = useState<string | null>(p.user.bio);
  const trendTile = STAT_TILES.find((t) => t.key === trendKey)!;
  const name = p.user.display_name;
  const { user: viewer } = useSessionUser();
  const isMe = viewer?.id === p.user.id;
  const activityDone = p.activity.thread_count + p.activity.comment_count > 0;
  // Game stats only render when there's real FACEIT data (fan-first profile).
  const hasStats = Object.keys(p.stats).length > 0;
  const celebration = useScoutCelebration(p.scout);
  const faceitNick = p.game?.faceit_nickname ?? null;
  const isStaff = viewer?.role === "recruiter" || viewer?.role === "admin";
  const level = p.game?.faceit_level ?? null;
  const elo = p.game?.faceit_elo ?? null;
  const meta = [
    p.game?.region,
    p.elo_rank ? `#${p.elo_rank.rank} of ${p.elo_rank.total} by ELO` : null,
    p.clip_count ? `${p.clip_count} clip${p.clip_count === 1 ? "" : "s"}` : null,
    joinedLabel(p.user.created_at),
  ].filter(Boolean);

  return (
    <div className="pf-root pf-portfolio">
      {celebration.show && <ScoutCelebration handle={p.user.handle} displayName={name} isMe={isMe} onClose={celebration.dismiss} />}

      <header className="pf-hero pf-rise">
        <div className="pf-hero__id">
          <p className="pf-kicker">
            <span className="pf-kicker__bar" />Fan profile
            {meta.length > 0 && <span className="pf-kicker__dim">· {meta.join(" · ")}</span>}
          </p>
          <h1 className="pf-display pf-hero__name">
            {name}
            <span className="pf-accent">.</span>
          </h1>
          <p className="pf-hero__handle">@{p.user.handle}</p>
          <BioEditor handle={p.user.handle} bio={bio} canEdit={isMe} onSaved={setBio} />
          {p.linked_accounts.length > 0 && (
            <ul className="pf-badges">
              {p.linked_accounts.map((a) => (
                <li key={`${a.platform}:${a.handle}`}>
                  {a.url ? (
                    <a className="pf-badge" href={a.url} target="_blank" rel="noopener noreferrer">{PLATFORM_LABEL[a.platform] ?? a.platform} ↗</a>
                  ) : (
                    <span className="pf-badge pf-badge--dashed">{PLATFORM_LABEL[a.platform] ?? a.platform} · {a.handle}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        {elo !== null && (
          <div className="pf-hero__rank">
            {level !== null && (
              <div className={`pf-diamond tier-${levelTier(level)}`} title={`FACEIT level ${level}`}>
                <span>{level}</span>
              </div>
            )}
            <div>
              <div className="pf-display pf-hero__elo">{fmtNum(elo)}</div>
              <div className="pf-label">FACEIT ELO{level !== null ? ` · Level ${level}` : ""}</div>
            </div>
          </div>
        )}
      </header>

      {isStaff && <RecruiterLens scout={p.scout} displayName={name} />}

      {isMe && p.clip_count === 0 && (
        <section className="pf-panel pf-welcome pf-rise" aria-labelledby="pf-welcome-h">
          <p className="pf-kicker"><span className="pf-kicker__bar" />You're in</p>
          <h2 id="pf-welcome-h" className="pf-display pf-h2">Welcome to FaZe HQ</h2>
          <ol className="pf-welcome__steps">
            <li className="is-done"><span><strong>Profile created.</strong> This is your public FaZe HQ profile. Share it anywhere.</span></li>
            <li className={activityDone ? "is-done" : ""}><span><strong>Join the conversation.</strong> Post in Community and earn karma.</span></li>
            <li><span><strong>Play the features.</strong> Guessr streaks, pixels on The Wall and a synced setup show up here as badges.</span></li>
            <li className={faceitNick ? "is-done" : ""}><span><strong>Link FACEIT (optional).</strong> Add your CS2 level, ELO and match stats to the public leaderboards.</span></li>
          </ol>
          <a className="pf-btn pf-btn--primary" href="/community">Go to Community <span aria-hidden>→</span></a>
        </section>
      )}


      {hasStats && (
        <section className="pf-strip pf-rise" aria-label="Key stats">
          {STAT_TILES.map((t) => {
            const s = p.stats[t.key];
            const d = s?.delta_30d ?? null;
            const showDelta = d !== null && Math.abs(d) >= Math.pow(10, -t.digits) / 2;
            return (
              <button
                type="button"
                key={t.key}
                className={`pf-stat ${trendKey === t.key ? "is-active" : ""}`}
                onClick={() => setTrendKey(t.key)}
                aria-pressed={trendKey === t.key}
                title={`Show ${t.label} trend`}
              >
                <span className="pf-label">{t.label}</span>
                <span className="pf-display pf-stat__value">
                  {fmtNum(s?.value, t.digits)}
                  {s && t.suffix}
                </span>
                <span className={`pf-stat__delta ${showDelta ? (d! > 0 ? "is-up" : "is-down") : ""}`}>
                  {showDelta ? `${fmtSigned(d, t.digits)} · 30d` : " "}
                </span>
              </button>
            );
          })}
          <div className="pf-stat pf-stat--static">
            <span className="pf-label">Karma</span>
            <span className="pf-display pf-stat__value">{fmtCompact(p.karma)}</span>
            <span className="pf-stat__delta">community</span>
          </div>
        </section>
      )}

      {hasStats && (
        <section className="pf-trend pf-rise" aria-labelledby="pf-trend-h" aria-live="polite">
          <div className="pf-trend__head">
            <p className="pf-kicker"><span className="pf-kicker__bar" />Trend<span className="pf-kicker__dim">· pick a stat above</span></p>
            <h2 id="pf-trend-h" className="pf-display pf-h2">{trendTile.label} · last 30 days</h2>
          </div>
          <TrendChart points={p.trends[trendKey] ?? []} digits={trendTile.digits} label={trendTile.label} height={170} />
        </section>
      )}

      {isStaff && p.dossier && <ScoutDossier scout={p.scout} dossier={p.dossier} />}

      <div className="pf-grid">
        <div className="pf-col">
          <ActivityPanel activity={p.activity} isMe={isMe} karma={p.karma} />
          <section className="pf-panel pf-rise" aria-labelledby="pf-clips-h">
            <div className="pf-panel__head">
              <p className="pf-kicker"><span className="pf-kicker__bar" />Highlight reel<span className="pf-kicker__dim">· newest first</span></p>
              <h2 id="pf-clips-h" className="pf-display pf-h2">Clips</h2>
            </div>
            {p.clips.length === 0 ? (
              <p className="pf-muted">No clips yet. Share one in Community.</p>
            ) : (
              <ul className="pf-clips">
                {p.clips.map((c, i) => (
                  <li key={c.id}>
                    <a className="pf-clip" href={clipHref(c)} target="_blank" rel="noreferrer">
                      <div className="pf-clip__thumb">
                        {c.thumbnail_url ? <img src={c.thumbnail_url} alt="" loading="lazy" /> : <span className="pf-clip__map">{(c.map ?? "cs2").replace(/^de_/, "")}</span>}
                        <span className="pf-clip__idx">{String(i + 1).padStart(2, "0")}</span>
                      </div>
                      <div className="pf-clip__meta">
                        <strong>{c.title ?? "Untitled clip"}</strong>
                        <span className="pf-label">{[c.map, c.side].filter(Boolean).join(" · ")}</span>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="pf-col">
          <FanBadges profile={p} />
          {isMe && <FaceitLink handle={p.user.handle} userId={p.user.id} nickname={faceitNick} onSynced={refresh} compact />}
          {p.social.length > 0 && (
            <section className="pf-panel pf-rise" aria-labelledby="pf-social-h">
              <div className="pf-panel__head">
                <p className="pf-kicker"><span className="pf-kicker__bar" />Audience</p>
                <h2 id="pf-social-h" className="pf-display pf-h2">Creator stats</h2>
              </div>
              <table className="pf-table">
                <thead>
                  <tr><th>Platform</th><th>Followers</th><th>30d</th><th>Eng.</th></tr>
                </thead>
                <tbody>
                  {p.social.map((s) => (
                    <tr key={s.platform}>
                      <td>{PLATFORM_LABEL[s.platform] ?? s.platform}</td>
                      <td>{fmtCompact(s.followers)}</td>
                      <td className={s.followers_growth_30d && s.followers_growth_30d > 0 ? "is-up" : ""}>
                        {s.followers_growth_30d === null ? "–" : `${s.followers_growth_30d >= 0 ? "+" : ""}${fmtPct(s.followers_growth_30d, 1)}`}
                      </td>
                      <td>{fmtPct(s.engagement_rate, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          <ShareCard handle={p.user.handle} displayName={name} />
          <p className="pf-foot">
            Stats from FACEIT and seeded demo data. Fan-made project, not affiliated with FaZe Clan, Valve or FACEIT.{" "}
            <a href={profileUrl(p.user.handle)}>Permalink</a>
          </p>
        </aside>
      </div>
    </div>
  );
}

export default ProfilePage;
