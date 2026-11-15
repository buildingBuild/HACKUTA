import { useState } from 'react';
import type { GameOption } from './types';

function GameLogo({ game }: { game: GameOption }) {
  const [ok, setOk] = useState(true);
  return ok ? (
    <img className="tile__logo" src={game.logo} alt={game.name} onError={() => setOk(false)} draggable={false} />
  ) : (
    <span className="tile__code">{game.code}</span>
  );
}

function Player({ src, name, index, depth }: { src?: string; name: string; index: number; depth: number }) {
  const [ok, setOk] = useState(Boolean(src));
  if (!ok || !src) return null;
  return (
    <img
      className="tile__player"
      src={src}
      alt={name}
      title={name}
      onError={() => setOk(false)}
      draggable={false}
      style={{ ['--j' as string]: index, ['--d' as string]: depth, zIndex: 10 - Math.round(depth * 2) }}
    />
  );
}

interface Props {
  game: GameOption;
  index: number;
  selected: boolean;
  onSelect: () => void;
}

export function GameCard({ game, index, selected, onSelect }: Props) {
  const hasRoster = game.roster.length > 0;
  const hasPhotos = game.roster.some((p) => p.photo);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={!game.live}
      aria-label={game.name}
      className={['tile rise', selected && 'tile--on', !game.live && 'tile--off', hasPhotos && 'tile--roster'].filter(Boolean).join(' ')}
      style={{ ['--i' as string]: index + 2 }}
      onClick={() => game.live && onSelect()}
    >
      <span className="tile__num">{String(index + 1).padStart(2, '0')}</span>
      <span className="tile__ghost" aria-hidden="true">
        {game.code}
      </span>
      <span className="tile__logo-wrap">
        <GameLogo game={game} />
      </span>

      {hasPhotos && (
        <span className="tile__stage" aria-hidden="true">
          {game.roster.map((p, i) => (
            <Player
              key={p.name || i}
              src={p.photo}
              name={p.name}
              index={i}
              depth={Math.abs(i - (game.roster.length - 1) / 2)}
            />
          ))}
        </span>
      )}

      <span className="tile__caption">
        {hasRoster ? (
          <>
            <span className="tile__team">{game.team}</span>
            {game.former && <span className="tile__former">{game.former}</span>}
            <span className="tile__names">{game.roster.map((p) => p.name).join(' · ')}</span>
            {game.live ? <span className="tile__you">+ you?</span> : !game.former && <span className="tile__soon">Coming to HQ</span>}
          </>
        ) : (
          <span className="tile__names">{game.live ? 'Roster TBA' : 'Not live on HQ yet'}</span>
        )}
      </span>

      <span className="tile__check" aria-hidden="true">
        ✓
      </span>
    </button>
  );
}
