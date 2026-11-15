import { useEffect, useState } from 'react';
import { TICKER_LINES } from './quotes';

export function Ticker() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((n) => (n + 1) % TICKER_LINES.length), 5200);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="ticker" aria-live="off">
      <span className="ticker__dot" />
      <span key={i} className="ticker__line">
        {TICKER_LINES[i]}
      </span>
    </div>
  );
}
