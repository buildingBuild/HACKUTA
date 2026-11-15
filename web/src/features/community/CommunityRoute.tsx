import { useEffect, useState } from 'react';
import { authHeaders, type SessionUser } from '../../components/session';
import CommunityPage from './CommunityPage';
import type { Clip } from './types';

/** Adapter to the shared session and Joe's existing GET /api/clips contract. */
export function CommunityRoute({ user }: { user: SessionUser | null }) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setClips([]); setError('');
    if (user) fetch(`/api/clips?userId=${encodeURIComponent(user.id)}`, { headers: authHeaders() })
      .then(async response => { if (!response.ok) throw new Error('Clip library is unavailable. Discussions still work; retry to attach a clip.'); return response.json(); })
      .then(result => { if (live) setClips(result.clips ?? []); })
      .catch(reason => { if (live) setError(reason.message); });
    return () => { live = false; };
  }, [user?.id]);
  const params = new URLSearchParams(window.location.search);
  return <>{error && <p role="alert" style={{ padding: 16 }}>{error}</p>}<CommunityPage currentUser={user ? { ...user, display_name: user.display_name || user.handle } : undefined} clips={clips} initialBoard={params.get('board') || 'faze-cs2'} initialClipId={params.get('clip') || ''} /></>;
}
