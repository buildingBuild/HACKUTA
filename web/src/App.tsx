// App shell + tiny path router (no dependency; links are plain <a href>). SHARED (Joe).
//   /                 onboarding
//   /coach            my clips (Yao)
//   /clips/:id        clip + AI coach report (Yao, until Joe's clip page lands)
//   /u/:handle        public profile (Omar)
//   /leaderboards     leaderboards (Omar)
//   /recruiter        FaZe recruiter dashboard (Yao, staff only)
import type { ReactNode } from 'react';
import { CommunityRoute } from './features/community/CommunityRoute';
import { AppNav } from './components/AppNav';
import { GridBackground } from './components/GridBackground';
import { useSessionUser } from './components/session';
import { ClipCoachPage, MyClipsPage } from './features/coaching/CoachPages';
import { OnboardingFlow } from './features/onboarding/OnboardingFlow';
import { LeaderboardsPage, ProfilePage } from './features/profile';
import { RecruiterDashboard } from './features/recruiter/RecruiterDashboard';

const match = (path: string, pattern: RegExp) => path.match(pattern)?.[1];

export function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const { user, loading } = useSessionUser();

  if (path === '/') {
    return (
      <GridBackground>
        <OnboardingFlow />
      </GridBackground>
    );
  }

  let page: ReactNode;
  const clipId = match(path, /^\/clips\/([^/]+)$/);
  const handle = match(path, /^\/u\/([^/]+)$/);
  if (clipId) page = <ClipCoachPage clipId={decodeURIComponent(clipId)} />;
  else if (handle) page = <ProfilePage handle={decodeURIComponent(handle)} />;
  else if (path === '/coach') page = loading ? null : <MyClipsPage user={user} />;
  else if (path === '/community') page = loading ? null : <CommunityRoute user={user} />;
  else if (path === '/leaderboards') page = <LeaderboardsPage highlightHandle={user?.handle} />;
  else if (path === '/recruiter') page = loading ? null : <RecruiterDashboard user={user} />;
  else page = <p style={{ padding: 24 }}>Page not found. <a href="/">Go home</a></p>;

  return (
    <GridBackground>
      <AppNav user={user} path={path} />
      {page}
    </GridBackground>
  );
}
