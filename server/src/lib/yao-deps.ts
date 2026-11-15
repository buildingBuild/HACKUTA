// Dependency types for routers that take { db, auth } (auth, players, scouting, clips, live, admin).
// Routers receive these as arguments so app.ts wires them up in one line:
//   app.use('/api/scouting', createScoutingRouter({ db, auth }))
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
