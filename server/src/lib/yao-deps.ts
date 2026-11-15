// Dependency types for Yao's routers (coaching, players, scouting, voice).
// Routers receive these as arguments so they plug into whatever app.ts / db
// client / auth the shared scaffold ships with:
//   app.use('/api/coaching', createCoachingRouter({ db, auth }))
import type { RequestHandler } from 'express';

export interface QueryResult<R> {
  rows: R[];
  rowCount: number | null;
}

/** Minimal DB interface. `pg.Pool` satisfies it as-is. */
export interface Db {
  query<R = any>(sql: string, params?: unknown[]): Promise<QueryResult<R>>;
}

export type Role = 'user' | 'recruiter' | 'admin';

export interface AuthDeps {
  /** Populates req.user ({ id, role }) when a user is identified. Never rejects. */
  identify: RequestHandler;
  /** Rejects with 401/403 unless req.user has one of the roles. */
  requireRole: (...roles: Role[]) => RequestHandler;
}

export interface YaoDeps {
  db: Db;
  auth: AuthDeps;
}

export interface AuthedUser {
  id: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}
