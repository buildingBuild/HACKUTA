// Admin area (owner: Yao). Phase 2: the FaZe Live director console lives here.
import { useEffect, useState } from 'react';
import { api } from '../../components/api';
import { Badge, Button, Card, Loading, Page, PageHeader } from '../../components/ui';
import './admin.css';

const LABELS: Record<string, string> = {
  users: 'Accounts',
  staff: 'Staff',
  threads: 'Threads',
  comments: 'Comments',
  new_prospects: 'New prospects',
  live_events: 'Live events',
  pixels: 'Pixels placed',
  guessr_puzzles: 'Guessr puzzles',
};

export function AdminPage() {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ counts: Record<string, number> }>('/api/admin/overview').then((b) => setCounts(b.counts), (e: Error) => setError(e.message));
  }, []);

  return (
    <Page>
      <PageHeader
        kicker="FaZe HQ · Admin"
        title="Control room"
        lede="Platform health at a glance. The director console for live FaZe moments lands here in Phase 2."
        actions={<Button href="/recruiting" arrow>Recruiting</Button>}
      />
      {error && <p className="ui-accent">{error}</p>}
      {!counts && !error && <Loading />}
      {counts && (
        <div className="adm-counts">
          {Object.entries(LABELS).map(([k, label]) => (
            <div key={k} className="adm-count">
              <span className="ui-kicker">{label}</span>
              <strong className="ui-display">{(counts[k] ?? 0).toLocaleString()}</strong>
            </div>
          ))}
        </div>
      )}
      <div className="ui-grid" style={{ marginTop: 28 }}>
        <Card dark>
          <Badge tone="red">Phase 2</Badge>
          <h2 className="ui-display ui-h3" style={{ margin: '14px 0 8px' }}>Director console</h2>
          <p style={{ margin: 0, lineHeight: 1.5, opacity: 0.8 }}>
            Round win, round loss, ace, clutch, match win and a score editor. Every click fires a LiveEvent to the banner, RGB Sync and The Wall.
          </p>
        </Card>
        <Card href="/recruiting/rules">
          <Badge>Recruiting</Badge>
          <h2 className="ui-display ui-h3" style={{ margin: '14px 0 8px' }}>Scouting thresholds</h2>
          <p style={{ margin: 0, lineHeight: 1.5 }} className="ui-muted">Tune the player-track bar live. Changes apply on the next stats sync.</p>
        </Card>
      </div>
    </Page>
  );
}
