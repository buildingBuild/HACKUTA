// App shell + tiny path router (no dependency; links are plain <a href>). SHARED.
// Route table (REQUIREMENTS.md §5.1):
//   /                       Home = your profile (signed out -> /join) public
//   /old-home               archived showcase home (not in nav)      public
//   /join                   onboarding flow (creates an account)     public
//   /community/*            Community (Dahiya)                       public, writes need sign-in
//   /feed                   FaZe Feed, experimental masonry (Joe)    public
//   /leaderboards           public leaderboards (Omar)               public
//   /timeline               FaZe history as a tree (Omar)            public
//   /rewards                FaZe Points: challenges + store (Omar)   public, earning needs sign-in
//   /u/:handle, /me         fan profile (Omar)                       public
//   /rgb                    RGB Sync: clip-synced keyboard lighting  public
//   /hud /guessr /wall      Phase 2 features (branded placeholders)  public
//   /recruiting/*           Recruiting tab (Yao)                     recruiter + admin
//   /admin                  admin area (Phase 2 director console)    admin
import type { ReactNode } from 'react';
import { AppNav } from './components/AppNav';
import { ComingSoon } from './components/ComingSoon';
import { featureByPath } from './components/features';
import { GridBackground } from './components/GridBackground';
import { NotFound } from './components/NotFound';
import { RequireRole } from './components/RequireRole';
import { homeFor, useSessionUser } from './components/session';
import { Loading, Page } from './components/ui';
import { AdminPage } from './features/admin/AdminPage';
import { CommunityRoute } from './features/community/CommunityRoute';
import { HQPage } from './features/hq/HQPage';
import { FeedPage } from './features/feed/FeedPage';
import { HomePage } from './features/home/HomePage';
import { OnboardingFlow } from './features/onboarding/OnboardingFlow';
import { LeaderboardsPage } from './features/profile';
import { RecruitingPage } from './features/recruiting/RecruitingPage';
import { RgbPage } from './features/rgb/RgbPage';
import { TimelinePage } from './features/timeline';
import { MentorshipPage } from './features/mentorship/MentorshipPage';
import { RewardsPage } from './features/rewards';

const match = (path: string, pattern: RegExp) => path.match(pattern)?.[1];

export function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const { user, loading } = useSessionUser();

  // Full-bleed onboarding: it draws its own top bar (and AppNav once finished).
  if (path === '/join') {
    return (
      <GridBackground>
        <OnboardingFlow />
      </GridBackground>
    );
  }

  let page: ReactNode;
  const handle = match(path, /^\/u\/([^/]+)$/);
  const feature = featureByPath(path);

  if (path === '/') {
    // Home is your own profile. Signed out -> onboarding; staff -> their workspace.
    if (loading) page = <Page><Loading /></Page>;
    else if (user && user.role === 'user')
      page = <HQPage handle={user.handle} />; // one profile everywhere (features/hq)
    else {
      window.location.replace(user ? homeFor(user) : '/join');
      page = null;
    }
  } else if (path === '/old-home') page = <HomePage user={user} />; // archived showcase home, not in the nav
  else if (handle)
    page = <HQPage handle={decodeURIComponent(handle)} />;
  else if (path === '/me') {
    if (!loading) window.location.replace(user ? `/u/${encodeURIComponent(user.handle)}` : '/join');
    page = <Page><Loading /></Page>;
  } else if (path === '/community' || path.startsWith('/community/')) page = loading ? null : <CommunityRoute user={user} />;
  else if (path === '/feed') page = loading ? null : <FeedPage user={user} />;
  else if (path === '/coaching') page = loading ? null : <MentorshipPage user={user} />;
  else if (path === '/leaderboards') page = <LeaderboardsPage highlightHandle={user?.handle} />;
  else if (path === '/rgb') page = <RgbPage />;
  else if (path === '/timeline') page = <TimelinePage />;
  else if (path === '/rewards') page = <RewardsPage />;
  else if (feature) page = <ComingSoon feature={feature} />;
  else if (path === '/recruiter') {
    window.location.replace('/recruiting');
    page = null;
  } else if (path === '/recruiting' || path.startsWith('/recruiting/'))
    page = (
      <RequireRole user={user} loading={loading} roles={['recruiter', 'admin']}>
        <RecruitingPage path={path} user={user} />
      </RequireRole>
    );
  else if (path === '/admin' || path.startsWith('/admin/'))
    page = (
      <RequireRole user={user} loading={loading} roles={['admin']}>
        <AdminPage />
      </RequireRole>
    );
  else page = <NotFound />;

  return (
    <GridBackground>
      <AppNav user={user} path={path} />
      {page}
    </GridBackground>
  );
}
