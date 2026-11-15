// Top nav + demo login picker. SHARED (Joe): restyle freely, keep the picker for the demo.
import { useEffect, useState, type ChangeEvent } from 'react';
import { FazeLogo } from './FazeLogo';
import { setDemoUserId, type SessionUser } from './session';
import './AppNav.css';

interface Props {
  user: SessionUser | null;
  path: string;
}

export function AppNav({ user, path }: Props) {
  const [users, setUsers] = useState<SessionUser[]>([]);

  useEffect(() => {
    fetch('/api/auth/demo-users')
      .then((r) => r.json())
      .then((b: { users: SessionUser[] }) => setUsers(b.users ?? []))
      .catch(() => setUsers([]));
  }, []);

  const pick = (e: ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value || null;
    setDemoUserId(id);
    const next = users.find((u) => u.id === id);
    // Land each role on its home screen.
    window.location.href = path === '/community' ? '/community' : !next ? '/' : next.role === 'user' ? '/coach' : '/recruiter';
  };

  const staff = user?.role === 'recruiter' || user?.role === 'admin';
  const links = [
    { href: '/community', label: 'Community', show: true },
    { href: '/coach', label: 'Coach', show: !!user && !staff },
    { href: user ? `/u/${user.handle}` : '', label: 'My profile', show: !!user && !staff },
    { href: '/leaderboards', label: 'Leaderboards', show: true },
    { href: '/recruiter', label: 'Recruiter', show: staff },
  ];

  return (
    <header className="nav">
      <a className="brand nav__brand" href="/">
        <FazeLogo className="nav__logo" title="FaZe" />
        <span className="brand__hq">HQ</span>
      </a>
      <nav className="nav__links">
        {links
          .filter((l) => l.show)
          .map((l) => (
            <a key={l.label} href={l.href} className={`nav__link ${path.startsWith(l.href) ? 'nav__link--on' : ''}`}>
              {l.label}
            </a>
          ))}
      </nav>
      <label className="nav__login">
        <span className="nav__login-label">Demo login</span>
        <select value={user?.id ?? ''} onChange={pick}>
          <option value="">Signed out</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.display_name ?? u.handle}
              {u.role !== 'user' ? ` (${u.role})` : u.faceit_level ? ` · L${u.faceit_level}` : ''}
            </option>
          ))}
        </select>
      </label>
    </header>
  );
}
