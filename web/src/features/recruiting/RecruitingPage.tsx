// Recruiting tab (owner: Yao; recruiter + admin only, the API enforces the role too).
//   /recruiting          pipeline board (Omar's ProspectBoard), polls every 5s
//   /recruiting/p/:id    prospect detail: scout report, criteria, 30-day trends, status
//   /recruiting/rules    scouting thresholds (read-only for recruiters, editable by admins)
import { ProspectBoard } from '../profile';
import type { SessionUser } from '../../components/session';
import { ProspectDetail } from './ProspectDetail';
import { RulesEditor } from './RulesEditor';
import './hud.css';
import './recruiter.css';
import './recruiting.css';

export function RecruitingPage({ path, user }: { path: string; user: SessionUser | null }) {
  const prospectId = path.match(/^\/recruiting\/p\/([^/]+)$/)?.[1];
  const tab = prospectId ? 'pipeline' : path === '/recruiting/rules' ? 'rules' : 'pipeline';

  return (
    <div className="rc">
      <nav className="rc-tabs" aria-label="Recruiting">
        <span className="rc-tabs__title">Recruiting</span>
        <a href="/recruiting" className={`rc-tab ${tab === 'pipeline' ? 'is-on' : ''}`} aria-current={tab === 'pipeline' ? 'page' : undefined}>Pipeline</a>
        <a href="/recruiting/rules" className={`rc-tab ${tab === 'rules' ? 'is-on' : ''}`} aria-current={tab === 'rules' ? 'page' : undefined}>Scouting bar</a>
        <span className="rc-tabs__note">Staff only · thresholds from FACEIT stats</span>
      </nav>

      {prospectId ? (
        <div className="yao-page">
          <ProspectDetail id={decodeURIComponent(prospectId)} onBack={() => window.location.assign('/recruiting')} />
        </div>
      ) : tab === 'rules' ? (
        <div className="yao-page">
          <header className="yao-page__head">
            <div>
              <p className="yao-kicker">FaZe Up Next · player track</p>
              <h1 className="yao-heading">Scouting bar<em>.</em></h1>
              <p className="yao-lede">
                A player becomes a prospect when every bar passes on their latest FACEIT stats. {user?.role === 'admin' ? 'Changes apply on the next stats sync.' : 'Only admins can change thresholds.'}
              </p>
            </div>
          </header>
          <RulesEditor canEdit={user?.role === 'admin'} />
        </div>
      ) : (
        <ProspectBoard hrefFor={(p) => `/recruiting/p/${encodeURIComponent(p.id)}`} />
      )}
    </div>
  );
}
