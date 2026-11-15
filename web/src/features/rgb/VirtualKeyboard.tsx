// On-screen stand-in for the real keyboard: 4 lighting zones + front light bar. Rests on dim red while the clip
// plays (base), dark otherwise.
import type { EffectName } from './cues';

export type FiredEffect = { name: EffectName; key: number } | null;

const ROWS = [14, 14, 13, 12, 9];
const ZONES = 4;

export function VirtualKeyboard({ effect, base, onDone }: { effect: FiredEffect; base?: boolean; onDone?: () => void }) {
  return (
    <div
      key={effect?.key ?? 'idle'}
      className={`vk ${effect ? `vk--${effect.name}` : 'vk--idle'}${base ? ' vk--base' : ''}`}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) onDone?.();
      }}
      role="img"
      aria-label={effect ? `Keyboard lighting: ${effect.name.replace('_', ' ')}` : base ? 'Keyboard glowing dim red' : 'Keyboard lights off'}
    >
      <div className="vk__deck">
        {ROWS.map((n, r) => (
          <div className="vk__row" key={r}>
            {Array.from({ length: n }, (_, c) => (
              <span key={c} className="vk__key" data-zone={Math.min(ZONES - 1, Math.floor((c / n) * ZONES))} />
            ))}
          </div>
        ))}
      </div>
      <div className="vk__bar" />
    </div>
  );
}
