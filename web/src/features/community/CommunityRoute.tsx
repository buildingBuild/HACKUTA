import { useEffect, useState } from 'react';
import { authHeaders, type SessionUser } from '../../components/session';
import CommunityPage from './CommunityPage';
import type { Clip } from './types';

/** Adapter to the shared session and Joe's existing GET /api/clips contract. */
export function CommunityRoute({ user, uploadUrl }: { user: SessionUser | null; uploadUrl?: string }) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setClips([]); setError('');
    let inFlight = false;
    const refresh = async (force = false) => {
      if(inFlight || (!force && document.visibilityState === 'hidden'))return;
      inFlight = true;
      try {
        const response = await fetch('/api/clips', { headers: authHeaders() });
        if(!response.ok)throw new Error('Clip library unavailable. Discussions still work.');
        const result = await response.json();
        if(live){setClips(old => {
          const incoming: Clip[] = result.clips ?? [];
          const byId = new Map(incoming.map(c=>[c.id,c]));
          return [...incoming.filter(c=>!old.some(v=>v.id===c.id)), ...old.filter(c=>byId.has(c.id)).map(c=>byId.get(c.id)!)];
        });setError('');}
      } catch(reason) { if(live)setError(reason instanceof Error?reason.message:'Clip library unavailable.'); }
      finally { inFlight = false; }
    };
    void refresh(true);
    const timer = setInterval(()=>void refresh(),20000);
    const focus = () => void refresh(true);
    window.addEventListener('focus',focus);
    document.addEventListener('visibilitychange',focus);
    return () => { live = false; clearInterval(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus); };
  }, [user?.id]);
  const params = new URLSearchParams(window.location.search);
  return <>{error && <p role="alert" style={{ padding: 16 }}>{error}</p>}<CommunityPage uploadUrl={uploadUrl} currentUser={user ? { ...user, display_name: user.display_name || user.handle } : undefined} clips={clips} initialBoard={params.get('board') || 'faze-cs2'} initialClipId={params.get('clip') || ''} /></>;
}
