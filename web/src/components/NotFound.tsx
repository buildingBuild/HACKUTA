import { Button, EmptyState, Page } from './ui';

export function NotFound() {
  return (
    <Page narrow>
      <EmptyState title="404 · Off the map" action={<Button href="/" variant="primary" arrow>Back to HQ</Button>}>
        That page doesn't exist. It might be a Phase 2 feature that hasn't dropped yet.
      </EmptyState>
    </Page>
  );
}
