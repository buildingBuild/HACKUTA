// Hackathon auth (REQUIREMENTS.md §7.5). SHARED FILE.
// POST /api/auth/login sets the httpOnly `fazehq_user` cookie: that's the source of truth.
// An `x-user-id` header is still accepted (scripts/tests, older callers). Staff routes gate on role.
import type { RequestHandler } from 'express';
import type { AuthDeps, Db, Role } from './yao-deps.js';

function cookie(header: string | undefined, name: string): string | null {
  const m = header?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createAuth(db: Db): AuthDeps {
  const identify: RequestHandler = async (req, _res, next) => {
    if (req.user) return next();
    const id = cookie(req.headers.cookie, 'fazehq_user') || req.header('x-user-id');
    if (!id || !UUID.test(id)) return next();
    try {
      const r = await db.query<{ id: string; role: Role }>(`SELECT id, role FROM users WHERE id = $1`, [id]);
      if (r.rows[0]) req.user = { id: String(r.rows[0].id), role: r.rows[0].role };
    } catch {
      /* treat as anonymous */
    }
    next();
  };

  const requireRole: AuthDeps['requireRole'] = (...roles) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'sign in required' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
    next();
  };

  return { identify, requireRole };
}
