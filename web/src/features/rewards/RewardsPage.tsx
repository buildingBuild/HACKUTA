// /rewards: FaZe Points. Complete challenges to earn points, spend them on merch or real coaching sessions.
// Owner: Omar.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ApiError } from '../../components/api';
import { claimChallenge, fetchCatalog, fetchMe, redeem, type Challenge, type PointsMe, type Reward } from './api';
import { MerchArt } from './MerchArt';
import './rewards.css';

const fmt = (n: number) => n.toLocaleString('en-US');
type Filter = 'all' | 'merch' | 'coaching';

function resetIn(iso: string): string {
  const mins = Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60_000));
  if (mins >= 48 * 60) return `${Math.round(mins / 1440)} days`;
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${mins}m`;
}

/** Rough time to afford something, assuming every challenge gets done. */
function weeksFor(points: number, perWeek: number): string {
  if (perWeek <= 0 || points <= 0) return '';
  const w = Math.ceil(points / perWeek);
  return w <= 1 ? 'about a week' : `${w} weeks of challenges`;
}

function ago(iso: string): string {
  const h = Math.max(0, (Date.now() - Date.parse(iso)) / 3600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${Math.floor(h)}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ChallengeCard({ c, signedIn, busy, onClaim }: { c: Challenge; signedIn: boolean; busy: boolean; onClaim: () => void }) {
  const pct = Math.round((c.progress / c.target) * 100);
  return (
    <li className={`rw-ch ${c.claimed ? 'is-claimed' : ''} ${c.claimable ? 'is-ready' : ''}`}>
      <div className="rw-ch__top">
        <span className="rw-ch__pts">+{fmt(c.points)}</span>
        <span className="rw-chip">{c.period === 'daily' ? 'Daily' : 'Weekly'}</span>
      </div>
      <strong className="rw-ch__title">{c.title}</strong>
      <span className="rw-ch__blurb">{c.blurb}</span>
      <span className="rw-ch__bar" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </span>
      <div className="rw-ch__foot">
        <span className="rw-ch__count">
          {fmt(Math.min(c.value, c.target))} / {fmt(c.target)}
        </span>
        {c.claimed ? (
          <span className="rw-ch__done">Claimed ✓</span>
        ) : c.claimable ? (
          <button type="button" className="rw-btn rw-btn--red" onClick={onClaim} disabled={busy}>
            {busy ? 'Claiming…' : 'Claim'}
          </button>
        ) : (
          <span className="rw-ch__todo">{signedIn ? 'In progress' : 'Sign in to start'}</span>
        )}
      </div>
    </li>
  );
}

function StoreCard({
  r,
  balance,
  perWeek,
  signedIn,
  busy,
  onRedeem,
}: {
  r: Reward;
  balance: number | null;
  perWeek: number;
  signedIn: boolean;
  busy: boolean;
  onRedeem: (option?: string) => void;
}) {
  const [option, setOption] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const short = balance !== null ? r.cost - balance : r.cost;
  const soldOut = r.stock !== null && r.stock <= 0;
  const needsOption = r.options.length > 0 && !option;

  let action;
  if (soldOut) action = <span className="rw-store__note">Sold out</span>;
  else if (!signedIn) action = <span className="rw-store__note">Sign in to redeem</span>;
  else if (short > 0)
    action = (
      <span className="rw-store__note">
        Need {fmt(short)} more{perWeek > 0 ? ` · ~${weeksFor(short, perWeek)}` : ''}
      </span>
    );
  else if (confirm)
    action = (
      <span className="rw-store__confirm">
        <button type="button" className="rw-btn rw-btn--red" disabled={busy} onClick={() => onRedeem(option ?? undefined)}>
          {busy ? 'Redeeming…' : `Confirm · ${fmt(r.cost)}`}
        </button>
        <button type="button" className="rw-btn rw-btn--ghost" onClick={() => setConfirm(false)}>
          Cancel
        </button>
      </span>
    );
  else
    action = (
      <button type="button" className="rw-btn" disabled={needsOption} onClick={() => setConfirm(true)}>
        {needsOption ? 'Pick a size' : 'Redeem'}
      </button>
    );

  return (
    <li className={`rw-store__item kind-${r.kind} ${soldOut ? 'is-out' : ''}`}>
      <div className="rw-store__art">
        <MerchArt art={r.art} />
        {r.stock !== null && !soldOut && <span className="rw-chip rw-chip--red rw-store__stock">{r.stock} left</span>}
        {r.kind === 'coaching' && <span className="rw-chip rw-store__kind">Real coach</span>}
      </div>
      <div className="rw-store__body">
        <div className="rw-store__head">
          <strong className="rw-store__name">{r.name}</strong>
          <span className="rw-store__cost">{fmt(r.cost)} pts</span>
        </div>
        {r.blurb && <p className="rw-store__blurb">{r.blurb}</p>}
        {r.options.length > 0 && (
          <div className="rw-sizes" role="group" aria-label="Size">
            {r.options.map((o) => (
              <button key={o} type="button" className={option === o ? 'is-on' : ''} aria-pressed={option === o} onClick={() => setOption(o)}>
                {o}
              </button>
            ))}
          </div>
        )}
        <div className="rw-store__action">{action}</div>
      </div>
    </li>
  );
}

export function RewardsPage() {
  const [me, setMe] = useState<PointsMe | null>(null);
  const [catalog, setCatalog] = useState<Reward[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    try {
      const [m, c] = await Promise.all([fetchMe(), fetchCatalog()]);
      setMe(m);
      setCatalog(c);
      setError(null);
    } catch (e) {
      setError((e as Error).message || 'Could not load FaZe Points');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const onClaim = async (c: Challenge) => {
    setBusy(`c:${c.id}`);
    try {
      const out = await claimChallenge(c.id);
      setToast(`+${fmt(out.points)} points · ${c.title}`);
      await load();
    } catch (e) {
      setToast((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const onRedeem = async (r: Reward, option?: string) => {
    setBusy(`r:${r.id}`);
    try {
      await redeem(r.id, option);
      setToast(r.kind === 'coaching' ? `${r.name} unlocked · book it on the Coaching page` : `${r.name}${option ? ` (${option})` : ''} is yours`);
      await load();
    } catch (e) {
      setToast((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const signedIn = Boolean(me?.signed_in);
  const balance = me?.balance ?? null;
  const ready = me?.challenges.filter((c) => c.claimable).length ?? 0;
  const daily = useMemo(() => (me?.challenges ?? []).filter((c) => c.period === 'daily'), [me]);
  const weekly = useMemo(() => (me?.challenges ?? []).filter((c) => c.period === 'weekly'), [me]);
  const perWeek = me?.weekly_potential ?? 0;
  const items = (catalog ?? []).filter((r) => filter === 'all' || r.kind === filter);
  const nextGoal = useMemo(() => {
    if (balance === null || !catalog) return null;
    return [...catalog].filter((r) => r.cost > balance && (r.stock === null || r.stock > 0)).sort((a, b) => a.cost - b.cost)[0] ?? null;
  }, [catalog, balance]);

  return (
    <div className="rw-root">
      <header className="rw-hero">
        <div>
          <p className="rw-kicker">
            <span className="rw-kicker__bar" />
            FaZe Points
          </p>
          <h1 className="rw-title">
            Earn it. Spend it<span>.</span>
          </h1>
          <p className="rw-lede">
            Post clips, get the fam reacting, show up in Community. Every challenge pays out in FaZe Points, and points buy merch or real
            time with a real coach.
          </p>
        </div>
        <div className="rw-wallet" aria-live="polite">
          {signedIn ? (
            <>
              <span className="rw-wallet__label">Your balance</span>
              <span className="rw-wallet__balance">
                {balance === null ? '—' : fmt(balance)}
                <small>pts</small>
              </span>
              {ready > 0 && (
                <a className="rw-wallet__ready" href="#rw-challenges">
                  {ready} challenge{ready === 1 ? '' : 's'} ready to claim →
                </a>
              )}
              {nextGoal && balance !== null && (
                <span className="rw-wallet__next">
                  {fmt(nextGoal.cost - balance)} to go for the {nextGoal.name.toLowerCase()}
                  {perWeek > 0 && <em> · ~{weeksFor(nextGoal.cost - balance, perWeek)}</em>}
                  <span className="rw-wallet__track" aria-hidden="true">
                    <i style={{ width: `${Math.min(100, (balance / nextGoal.cost) * 100)}%` }} />
                  </span>
                </span>
              )}
              {me && me.coaching_credits > 0 && (
                <span className="rw-chip rw-chip--red">
                  {me.coaching_credits} coaching credit{me.coaching_credits === 1 ? '' : 's'}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="rw-wallet__label">Start earning</span>
              <span className="rw-wallet__balance">
                50<small>pts</small>
              </span>
              <span className="rw-wallet__next">Every new fan starts with 50 points. Join, or pick an account in the demo login (top right).</span>
              <a className="rw-btn rw-btn--red" href="/join">
                Join FaZe HQ →
              </a>
            </>
          )}
        </div>
      </header>

      {error && <p className="rw-error">{error}</p>}

      <section className="rw-section" id="rw-challenges" aria-labelledby="rw-ch-h">
        <div className="rw-section__head">
          <h2 id="rw-ch-h" className="rw-h2">
            Challenges
          </h2>
          <span className="rw-muted">
            Daily and weekly. Finish one, claim it, the points land instantly
            {perWeek > 0 ? ` (up to ${fmt(perWeek)} a week)` : ''}.
          </span>
        </div>
        {!me ? (
          <p className="rw-muted">Loading challenges…</p>
        ) : (
          <>
            <h3 className="rw-h3">
              Today <span className="rw-muted">· resets in {resetIn(me.day_resets_at)}</span>
            </h3>
            <ul className="rw-ch-grid">
              {daily.map((c) => (
                <ChallengeCard key={c.id} c={c} signedIn={signedIn} busy={busy === `c:${c.id}`} onClaim={() => onClaim(c)} />
              ))}
            </ul>
            {weekly.length > 0 && (
              <>
                <h3 className="rw-h3">
                  This week <span className="rw-muted">· resets in {resetIn(me.week_resets_at)}</span>
                </h3>
                <ul className="rw-ch-grid">
                  {weekly.map((c) => (
                    <ChallengeCard key={c.id} c={c} signedIn={signedIn} busy={busy === `c:${c.id}`} onClaim={() => onClaim(c)} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>

      <section className="rw-section" aria-labelledby="rw-store-h">
        <div className="rw-section__head">
          <h2 id="rw-store-h" className="rw-h2">
            Store
          </h2>
          <div className="rw-filter" role="group" aria-label="Filter the store">
            {(['all', 'merch', 'coaching'] as Filter[]).map((f) => (
              <button key={f} type="button" className={filter === f ? 'is-on' : ''} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === 'all' ? 'Everything' : f === 'merch' ? 'Merch' : 'Coaching'}
              </button>
            ))}
          </div>
        </div>
        {filter !== 'merch' && (
          <p className="rw-coachnote">
            <strong>Real coaches, not AI.</strong> Redeem points for a session credit, then book it on the Coaching page. Rather pay? Paid
            sessions are on the Coaching page too.
          </p>
        )}
        {!catalog ? (
          <p className="rw-muted">Loading the store…</p>
        ) : (
          <ul className="rw-store">
            {items.map((r) => (
              <StoreCard key={r.id} r={r} balance={balance} perWeek={perWeek} signedIn={signedIn} busy={busy === `r:${r.id}`} onRedeem={(o) => onRedeem(r, o)} />
            ))}
          </ul>
        )}
      </section>

      {signedIn && me && (
        <section className="rw-section rw-mine" aria-label="Your rewards and points history">
          <div>
            <h2 className="rw-h2">Your rewards</h2>
            {me.redemptions.length === 0 ? (
              <p className="rw-muted">Nothing redeemed yet.</p>
            ) : (
              <ul className="rw-list">
                {me.redemptions.map((d) => (
                  <li key={d.id}>
                    <span className="rw-list__art">
                      <MerchArt art={d.art} />
                    </span>
                    <span className="rw-list__body">
                      <strong>
                        {d.name}
                        {d.option ? ` · ${d.option}` : ''}
                      </strong>
                      <span className="rw-muted">
                        {fmt(d.cost)} pts · {ago(d.created_at)}
                      </span>
                    </span>
                    <span className={`rw-status is-${d.status}`}>
                      {d.kind === 'coaching' ? (d.status === 'used' ? 'Booked' : 'Ready to book') : d.status === 'requested' ? 'Ordered' : d.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h2 className="rw-h2">Points history</h2>
            <ul className="rw-list rw-history">
              {me.history.map((h, i) => (
                <li key={i}>
                  <span className="rw-list__body">
                    <strong>{h.reason}</strong>
                    <span className="rw-muted">{ago(h.time)}</span>
                  </span>
                  <span className={`rw-delta ${h.delta < 0 ? 'is-neg' : ''}`}>
                    {h.delta > 0 ? '+' : ''}
                    {fmt(h.delta)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <p className="rw-fine">Demo store: nothing ships and no payment is taken. Fan project, not affiliated with or endorsed by FaZe Clan.</p>

      {toast && (
        <div className="rw-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
