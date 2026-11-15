import type { ReactNode } from 'react';
import './GridBackground.css';

/** White HUD grid with a slow red scan line. Wrap a full page in it. */
export function GridBackground({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="grid-bg" aria-hidden="true">
        <span className="grid-bg__corner grid-bg__corner--tl" />
        <span className="grid-bg__corner grid-bg__corner--tr" />
        <span className="grid-bg__corner grid-bg__corner--bl" />
        <span className="grid-bg__corner grid-bg__corner--br" />
      </div>
      <div className="grid-bg__content">{children}</div>
    </>
  );
}
