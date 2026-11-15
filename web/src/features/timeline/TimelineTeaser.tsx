// Home-page teaser for /timeline. Owner: Omar. Self-contained so Home only needs one line.
import { ALL_EVENTS, ERAS, STARS } from './data';
import './teaser.css';

export function TimelineTeaser() {
  return (
    <section className="tl-teaser" aria-labelledby="tl-teaser-h">
      <a className="tl-teaser__card" href="/timeline">
        <div className="tl-teaser__text">
          <p className="tl-teaser__kicker">
            <span className="tl-teaser__bar" />
            2010 → 2026 · The legacy
          </p>
          <h2 id="tl-teaser-h" className="tl-teaser__title">
            The FaZe Tree<span>.</span>
          </h2>
          <p className="tl-teaser__lede">From three kids with a sniper rifle to five world titles. Every era, every trophy, every star it made.</p>
          <span className="tl-teaser__cta">
            Climb the tree <span aria-hidden>→</span>
          </span>
        </div>
        <div className="tl-teaser__side" aria-hidden="true">
          <span className="tl-teaser__stars">{'★'.repeat(STARS.length)}</span>
          <dl className="tl-teaser__stats">
            <div>
              <dt>Moments</dt>
              <dd>{ALL_EVENTS.length}</dd>
            </div>
            <div>
              <dt>Eras</dt>
              <dd>{ERAS.length}</dd>
            </div>
            <div>
              <dt>World titles</dt>
              <dd>{STARS.length}</dd>
            </div>
          </dl>
        </div>
      </a>
    </section>
  );
}
