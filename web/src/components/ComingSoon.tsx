// Branded placeholder for Phase 2 features so every nav link works. SHARED.
import type { FeatureInfo } from './features';
import { Badge, Button, Kicker, Page } from './ui';

export function ComingSoon({ feature }: { feature: FeatureInfo }) {
  return (
    <Page>
      <section className="ui-soon">
        <div>
          <Kicker>
            FaZe HQ · {feature.name} <Badge tone="red">Coming soon</Badge>
          </Kicker>
          <h1 className="ui-display ui-h1" style={{ marginTop: 14 }}>{feature.name}</h1>
          <p className="ui-lede">{feature.tagline}</p>
          <ul className="ui-soon__list">
            {feature.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <div className="ui-soon__actions">
            <Button href="/community" variant="primary" arrow>Talk about it in Community</Button>
            <Button href="/">Back to HQ</Button>
          </div>
        </div>
        <div className="ui-soon__mark" aria-hidden>{feature.mark}</div>
      </section>
    </Page>
  );
}
