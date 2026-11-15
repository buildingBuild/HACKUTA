// RGB Sync (owner: Yao). A FaZe clip plays; at each moment the virtual keyboard (and, through the local
// companion, a real ASUS keyboard) lights up. Scoped to this page only: no live feed involved.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Page, PageHeader } from '../../components/ui';
import { CLIP } from './clip';
import { autoConnect, companionStatus, sendEffect } from './companion';
import { crossed, type Cue, type EffectName } from './cues';
import { VirtualKeyboard, type FiredEffect } from './VirtualKeyboard';
import { loadYouTube, type YTPlayer } from './youtube';
import './rgb.css';

const LABEL: Record<EffectName, string> = {
  match_start: 'Match start',
  round_win: 'Round win',
  round_loss: 'Round loss',
  ace: 'Ace',
  clutch: 'Clutch',
  match_win: 'Match win',
};
const MARK_KEYS: Record<string, EffectName> = { w: 'round_win', a: 'ace', l: 'round_loss', m: 'match_win', c: 'clutch', s: 'match_start' };
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const sortCues = (c: Cue[]) => [...c].sort((a, b) => a.t - b.t);

export function RgbPage() {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const [cues, setCues] = useState<Cue[]>(() => sortCues(CLIP.cues));
  const cuesRef = useRef(cues);
  cuesRef.current = cues;
  const [effect, setEffect] = useState<FiredEffect>(null);
  const [last, setLast] = useState<Cue | null>(null);
  const [connected, setConnected] = useState(false);
  const connectedRef = useRef(false);
  connectedRef.current = connected;
  const [probing, setProbing] = useState(() => autoConnect(window.location.hostname));
  const [videoError, setVideoError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [copied, setCopied] = useState(false);

  const fire = useCallback((type: EffectName) => {
    setEffect({ name: type, key: performance.now() });
    if (connectedRef.current) void sendEffect(type);
  }, []);

  // YouTube player + playhead loop: fire every cue the playhead crosses during normal playback.
  useEffect(() => {
    let raf = 0;
    let prev = 0;
    let cancelled = false;
    loadYouTube()
      .then((YT) => {
        if (cancelled || !host.current) return;
        player.current = new YT.Player(host.current, {
          videoId: CLIP.videoId,
          width: '100%',
          height: '100%',
          // disablekb: YouTube's own shortcuts (L skips, M mutes, C captions) would swallow the marking keys.
          playerVars: { rel: 0, playsinline: 1, modestbranding: 1, disablekb: 1 },
          events: {
            onError: (e) => setVideoError(`YouTube error ${e.data}`),
            // Clicking play focuses the cross-origin iframe; hand focus back so marking keys reach the page.
            onStateChange: () => {
              if (document.activeElement instanceof HTMLIFrameElement) document.activeElement.blur();
            },
          },
        });
        const tick = () => {
          const p = player.current;
          if (p?.getCurrentTime && p.getPlayerState() === YT.PlayerState.PLAYING) {
            const now = p.getCurrentTime();
            for (const cue of crossed(prev, now, cuesRef.current)) {
              fire(cue.type);
              setLast(cue);
            }
            prev = now;
          } else if (p?.getCurrentTime) {
            prev = p.getCurrentTime();
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      })
      .catch(() => setVideoError('Could not load YouTube. The virtual setup still works with the test buttons.'));
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      player.current?.destroy();
      player.current = null;
    };
  }, [fire]);

  // Companion status (optional local app). Polls only once probing is on (auto on localhost, else on click).
  useEffect(() => {
    if (!probing) return;
    let alive = true;
    const poll = () => companionStatus().then((ok) => alive && setConnected(ok));
    poll();
    const id = setInterval(poll, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [probing]);

  // Marking mode: W/A/L/M/C/S drop a cue at the current playhead.
  useEffect(() => {
    if (!marking) return;
    const onKey = (e: KeyboardEvent) => {
      const type = MARK_KEYS[e.key.toLowerCase()];
      const p = player.current;
      if (!type || !p?.getCurrentTime || e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement).closest('input, textarea')) return;
      e.preventDefault();
      const t = Math.round(p.getCurrentTime() * 10) / 10;
      setCues((c) => sortCues([...c, { t, type }]));
      fire(type);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [marking, fire]);

  const seek = (t: number) => {
    player.current?.seekTo(Math.max(0, t - 3), true);
    player.current?.playVideo();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(cues));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy the cues:', JSON.stringify(cues));
    }
  };

  return (
    <Page>
      <PageHeader
        kicker={<>FaZe HQ · RGB Sync <Badge tone="red">Live</Badge></>}
        title="RGB Sync"
        lede="Watch FaZe play and your keyboard plays along: red on a round win, a strobe on an ace, a colour sweep when FaZe takes the match."
      />

      <div className="rgb">
        <section className="rgb__stage">
          <div className="rgb__video">
            <div ref={host} />
            {videoError && <p className="rgb__video-error">{videoError}</p>}
          </div>
          <p className="rgb__clip">
            <strong>FaZe vs {CLIP.opponent}</strong> · {CLIP.event}
          </p>
        </section>

        <aside className="rgb__side">
          <VirtualKeyboard effect={effect} onDone={() => setEffect(null)} />
          <div className={`rgb__status ${connected ? 'is-on' : ''}`}>
            <span className="rgb__dot" aria-hidden />
            {connected ? (
              'Keyboard connected'
            ) : (
              <span>
                Keyboard not connected: showing virtual setup
                <small>
                  Run <code>cd companion &amp;&amp; npm start</code> on a laptop with an ASUS Aura keyboard
                  {probing ? '.' : ', then '}
                  {!probing && (
                    <button type="button" className="rgb__link" onClick={() => setProbing(true)}>
                      connect my keyboard
                    </button>
                  )}
                </small>
              </span>
            )}
          </div>
          <p className="rgb__now" aria-live="polite">
            {last ? (
              <>
                <span className="ui-kicker">Last moment</span> {LABEL[last.type]} at {fmt(last.t)}
              </>
            ) : (
              <span className="ui-kicker">Press play. Lights fire on each moment.</span>
            )}
          </p>
          <div className="rgb__try">
            <span className="ui-kicker">Try an effect</span>
            <div>
              {(Object.keys(LABEL) as EffectName[]).map((n) => (
                <button key={n} type="button" className="rgb__chip" onClick={() => fire(n)}>
                  {LABEL[n]}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <section className="rgb__cues">
        <div className="rgb__cues-head">
          <h2 className="ui-display">Moments in this clip</h2>
          <div className="rgb__cues-actions">
            <Button size="sm" variant={marking ? 'primary' : 'default'} onClick={() => setMarking((m) => !m)}>
              {marking ? 'Marking: on' : 'Mark moments'}
            </Button>
            {marking && (
              <>
                <Button size="sm" variant="ghost" onClick={copy}>{copied ? 'Copied' : 'Copy cues'}</Button>
                <Button size="sm" variant="ghost" onClick={() => setCues([])}>Clear</Button>
              </>
            )}
          </div>
        </div>
        {marking && (
          <p className="rgb__hint">
            Click anywhere on the page (not the video) once, then while the clip plays press <kbd>W</kbd> round win · <kbd>A</kbd> ace · <kbd>L</kbd> round loss · <kbd>C</kbd> clutch ·{' '}
            <kbd>M</kbd> match win · <kbd>S</kbd> match start. Then copy the cues into <code>web/src/features/rgb/clip.ts</code>.
          </p>
        )}
        <ol className="rgb__list">
          {cues.map((c, i) => (
            <li key={`${c.t}-${c.type}-${i}`}>
              <button type="button" onClick={() => seek(c.t)} className={last === c ? 'is-last' : ''}>
                <span className="rgb__t">{fmt(c.t)}</span>
                <span className={`rgb__tag rgb__tag--${c.type}`}>{LABEL[c.type]}</span>
              </button>
            </li>
          ))}
          {cues.length === 0 && <li className="rgb__empty">No moments yet. Turn on marking and press keys while the clip plays.</li>}
        </ol>
      </section>
    </Page>
  );
}
