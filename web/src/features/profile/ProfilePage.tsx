import { useState } from "react";
import "./profile.css";
import { ApiError, fetchProfile, profileUrl } from "./api";
import { Avatar, LevelBadge, ScoutProgressBar, StateBox, TrendChart } from "./components";
import { ShareCard } from "./ShareCard";
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

const PLATFORM_LABEL: Record<string, string> = { faceit: "FACEIT", steam: "Steam", youtube: "YouTube", twitch: "Twitch", tiktok: "TikTok", x: "X", instagram: "Instagram" };

export type ProfilePageProps = {
  handle: string;
  /** Where a clip card links to. Defaults to /clips/:id (Joe's clip detail page). */
  clipHref?: (clipId: string) => string;
};

/** Public gamer resume at /u/:handle (REQUIREMENTS.md §5.4). */
export function ProfilePage({ handle, clipHref = (id) => `/clips/${id}` }: ProfilePageProps) {
  const { data, error, loading } = usePolling(() => fetchProfile(handle), [handle]);

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
  return <ProfileView p={data} clipHref={clipHref} />;
}

function ProfileView({ p, clipHref }: { p: Profile; clipHref: (id: string) => string }) {
  const [trendKey, setTrendKey] = useState<StatKey>("elo");
  const trendTile = STAT_TILES.find((t) => t.key === trendKey)!;
  const name = p.user.display_name;

  return (
    <div className="pf-root">
      <header className="pf-hero">
        <Avatar name={name} url={p.user.avatar_url} size={88} />
        <div className="pf-hero__id">
          <p className="pf-eyebrow">CS2 portfolio</p>
          <h1 className="pf-h1">{name}</h1>
          <p className="pf-muted">
            @{p.user.handle}
            {p.game?.region ? ` · ${p.game.region}` : ""}
            {p.elo_rank ? ` · #${p.elo_rank.rank} of ${p.elo_rank.total} by ELO` : ""}
          </p>
          {p.user.bio && <p className="pf-bio">{p.user.bio}</p>}
          {p.linked_accounts.length > 0 && (
            <ul className="pf-links">
              {p.linked_accounts.map((a) => (
                <li key={`${a.platform}:${a.handle}`}>
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noopener noreferrer">{PLATFORM_LABEL[a.platform] ?? a.platform}</a>
                  ) : (
                    <span>{PLATFORM_LABEL[a.platform] ?? a.platform}: {a.handle}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="pf-hero__level">
          <LevelBadge level={p.game?.faceit_level ?? null} size="lg" />
          <div>
            <div className="pf-hero__elo">{fmtNum(p.game?.faceit_elo)}</div>
            <div className="pf-eyebrow">FACEIT ELO</div>
          </div>
        </div>
      </header>

      <section className="pf-tiles" aria-label="Key stats">
        {STAT_TILES.map((t) => {
          const s = p.stats[t.key];
          const d = s?.delta_30d ?? null;
          return (
            <button
              type="button"
              key={t.key}
              className={`pf-tile ${trendKey === t.key ? "is-active" : ""}`}
              onClick={() => setTrendKey(t.key)}
              aria-pressed={trendKey === t.key}
              title={`Show ${t.label} trend`}
            >
              <span className="pf-tile__label">{t.label}</span>
              <span className="pf-tile__value">{fmtNum(s?.value, t.digits)}{s && t.suffix}</span>
              {d !== null && Math.abs(d) >= Math.pow(10, -t.digits) / 2 && (
                <span className={`pf-tile__delta ${d > 0 ? "is-up" : "is-down"}`}>{fmtSigned(d, t.digits)} <span className="pf-muted">30d</span></span>
              )}
            </button>
          );
        })}
        <div className="pf-tile pf-tile--static">
          <span className="pf-tile__label">AI clip score</span>
          <span className="pf-tile__value">{fmtNum(p.avg_clip_score, 0)}</span>
          <span className="pf-muted pf-tile__sub">{p.clip_count} clip{p.clip_count === 1 ? "" : "s"}</span>
        </div>
        <div className="pf-tile pf-tile--static">
          <span className="pf-tile__label">Karma</span>
          <span className="pf-tile__value">{fmtCompact(p.karma)}</span>
          <span className="pf-muted pf-tile__sub">community</span>
        </div>
      </section>

      <div className="pf-grid">
        <div className="pf-col">
          <ScoutProgressBar scout={p.scout} />

          <section className="pf-card" aria-labelledby="pf-trend-h">
            <div className="pf-card__head">
              <h2 id="pf-trend-h" className="pf-h2">{trendTile.label} · last 30 days</h2>
            </div>
            <TrendChart points={p.trends[trendKey] ?? []} digits={trendTile.digits} label={trendTile.label} height={140} />
          </section>

          <section className="pf-card" aria-labelledby="pf-clips-h">
            <div className="pf-card__head">
              <h2 id="pf-clips-h" className="pf-h2">Top clips</h2>
              <span className="pf-muted">ranked by AI coaching score</span>
            </div>
            {p.clips.length === 0 ? (
              <p className="pf-muted">No clips yet. Upload one to get coached and climb the leaderboard.</p>
            ) : (
              <ul className="pf-clips">
                {p.clips.map((c) => (
                  <li key={c.id}>
                    <a className="pf-clip" href={clipHref(c.id)}>
                      <div className="pf-clip__thumb">
                        {c.thumbnail_url ? <img src={c.thumbnail_url} alt="" loading="lazy" /> : <span className="pf-clip__map">{(c.map ?? "cs2").replace(/^de_/, "")}</span>}
                        {c.overall_score !== null && <span className="pf-clip__score">{c.overall_score}</span>}
                      </div>
                      <div className="pf-clip__meta">
                        <strong>{c.title ?? "Untitled clip"}</strong>
                        <span className="pf-muted">{[c.map, c.side].filter(Boolean).join(" · ")}</span>
                        {c.summary && <span className="pf-clip__summary">{c.summary}</span>}
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="pf-col">
          {p.social.length > 0 && (
            <section className="pf-card" aria-labelledby="pf-social-h">
              <h2 id="pf-social-h" className="pf-h2">Creator stats</h2>
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
          <p className="pf-muted pf-foot">
            Stats from FACEIT and seeded demo data. AI scores are AI-generated feedback. <a href={profileUrl(p.user.handle)}>Permalink</a>
          </p>
        </aside>
      </div>
    </div>
  );
}

export default ProfilePage;
