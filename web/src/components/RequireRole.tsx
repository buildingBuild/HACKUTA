// Frontend route guard. The server enforces the same roles (requireRole), this just keeps the UI honest. SHARED.
import type { ReactNode } from 'react';
import type { Role } from '../../../shared/types';
import { type SessionUser } from './session';
import { Button, EmptyState, Loading, Page } from './ui';

export function RequireRole({ user, loading, roles, children }: { user: SessionUser | null; loading: boolean; roles: Role[]; children: ReactNode }) {
  if (loading) return <Page><Loading /></Page>;
  if (!user)
    return (
      <Page narrow>
        <EmptyState title="Sign in required" action={<Button href="/join" variant="primary" arrow>Join FaZe HQ</Button>}>
          Pick an account from <strong>Demo login</strong> in the top bar, or join to create one.
        </EmptyState>
      </Page>
    );
  if (!roles.includes(user.role))
    return (
      <Page narrow>
        <EmptyState title="Staff only" action={<Button href="/" arrow>Back to HQ</Button>}>
          This area is for FaZe {roles.includes('recruiter') ? 'recruiters and admins' : 'admins'}. You're signed in as @{user.handle}.
        </EmptyState>
      </Page>
    );
  return <>{children}</>;
}
