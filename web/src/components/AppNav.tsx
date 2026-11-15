// Top nav: Home · Community · Leaderboards · Features ▾, plus the user menu (Profile, Recruiting, Admin,
// demo login, sign out). SHARED (Joe): restyle freely, keep the demo login picker for judging.
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { FEATURES } from './features';
import { FazeLogo } from './FazeLogo';
import { homeFor, isStaff, signIn, type SessionUser } from './session';
import './AppNav.css';

interface Props {
  user: SessionUser | null;
  path: string;
}

const MAIN = [
  { href: '/', label: 'Home', match: (p: string) => p === '/' },
  { href: '/community', label: 'Community', match: (p: string) => p.startsWith('/community') },
  { href: '/feed', label: 'Feed', match: (p: string) => p === '/feed' },
  { href: '/leaderboards', label: 'Leaderboards', match: (p: string) => p.startsWith('/leaderboards') },
];

// Pages that make sense for any account: stay put when switching demo users.
const STAY = [/^\/community/, /^\/leaderboards/, /^\/u\//, /^\/(hud|rgb|guessr|wall)$/];

/** <details> dropdown that closes on outside click / Escape. */
function Menu({ label, className, children }: { label: React.ReactNode; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: Event) => {
      const el = ref.current;
      if (!el?.open) return;
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, []);
  return (
    <details ref={ref} className={`nav__menu ${className ?? ''}`}>
      <summary className="nav__menu-btn">{label}</summary>
      <div className="nav__menu-panel">{children}</div>
    </details>
  );
}

export function AppNav({ user, path }: Props) {
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    fetch('/api/auth/demo-users')
      .then((r) => r.json())
      .then((b: { users: SessionUser[] }) => setUsers(b.users ?? []))
      .catch(() => setUsers([]));
  }, []);

  async function pick(e: ChangeEvent<HTMLSelectElement>) {
    setSwitching(true);
    try {
      const next = await signIn(e.target.value || null);
      window.location.href = next && STAY.some((re) => re.test(path)) ? path : homeFor(next);
    } catch {
      setSwitching(false);
    }
  }

  const staff = isStaff(user);
  const featureOn = FEATURES.some((f) => path === f.path);

  const picker = (
    <label className="nav__login">
      <span className="nav__login-label">Demo login</span>
      <select value={user?.id ?? ''} onChange={pick} disabled={switching} aria-label="Demo login">
        <option value="">Signed out</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.display_name ?? u.handle}
            {u.role !== 'user' ? ` (${u.role})` : u.faceit_level ? ` · L${u.faceit_level}` : ''}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <header className="nav">
      <a className="brand nav__brand" href="/" aria-label="FaZe HQ home">
        <FazeLogo className="nav__logo" title="FaZe" />
        <span className="brand__hq">HQ</span>
      </a>

      <nav className="nav__links" aria-label="Main">
        {MAIN.map((l) => (
          <a key={l.href} href={l.href} className={`nav__link ${l.match(path) ? 'nav__link--on' : ''}`}>
            {l.label}
          </a>
        ))}
        <Menu label={<span className={`nav__link ${featureOn ? 'nav__link--on' : ''}`}>Features ▾</span>} className="nav__menu--features">
          {FEATURES.map((f) => (
            <a key={f.slug} href={f.path} className={`nav__feature ${path === f.path ? 'is-on' : ''}`}>
              <span className="nav__feature-mark" aria-hidden>{f.mark}</span>
              <span>
                <strong>{f.name}</strong>
                <small>{f.status === 'soon' ? 'Coming soon' : f.cta}</small>
              </span>
            </a>
          ))}
        </Menu>
      </nav>

      <div className="nav__right">
        {user ? (
          <Menu
            className="nav__menu--user"
            label={
              <span className="nav__user">
                {user.avatar_url ? <img src={user.avatar_url} alt="" /> : <span className="nav__user-dot" aria-hidden>{(user.display_name ?? user.handle)[0]}</span>}
                <span className="nav__user-name">{user.display_name ?? user.handle}</span>
                {user.role !== 'user' && <span className="nav__role">{user.role}</span>}
              </span>
            }
          >
            <a href={`/u/${encodeURIComponent(user.handle)}`} className="nav__item">My profile</a>
            {staff && <a href="/recruiting" className={`nav__item ${path.startsWith('/recruiting') ? 'is-on' : ''}`}>Recruiting</a>}
            {user.role === 'admin' && <a href="/admin" className={`nav__item ${path.startsWith('/admin') ? 'is-on' : ''}`}>Admin</a>}
            <div className="nav__item nav__item--picker">{picker}</div>
            <button type="button" className="nav__item nav__item--out" onClick={() => pick({ target: { value: '' } } as ChangeEvent<HTMLSelectElement>)}>
              Sign out
            </button>
          </Menu>
        ) : (
          <>
            {picker}
            <a className="nav__join" href="/join">Join</a>
          </>
        )}
      </div>
    </header>
  );
}
