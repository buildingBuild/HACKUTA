// /timeline: FaZe's history drawn as a glowing world tree. Roots = 2010, crown = everything FaZe branched into.
// Owner: Omar.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ALL_EVENTS, ERAS, FALLEN, KIND_LABEL, PATHS, STARS, type Era, type PathId, type TimelineEvent } from './data';
import { BraidedTrunk, Canopy, Roots } from './TreeArt';
import './timeline.css';

type PathSel = PathId | 'all';

const FIRST_YEAR = 2010;
const LAST_YEAR = 2026;
const TRUNK_TOP = 40;
const TRUNK_BOTTOM = 130;

function Branch({ side }: { side: 'left' | 'right' }) {
  return (
    <svg className={`tl-branch tl-branch--${side}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path className="tl-branch__wood" d="M0,60 C34,60 56,48 100,49 L100,51 C60,51 38,74 0,76 Z" />
      <path className="tl-branch__twig" d="M42,60 C52,72 60,78 70,80" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

interface NodeProps {
  ev: TimelineEvent;
  side: 'left' | 'right';
  dim: boolean;
  open: boolean;
  active: boolean;
  onToggle: (id: string) => void;
}

function EventNode({ ev, side, dim, open, active, onToggle }: NodeProps) {
  return (
    <li
      id={`ev-${ev.id}`}
      className={`tl-node tl-node--${side} kind-${ev.kind} ${dim ? 'is-dim' : ''} ${active ? 'is-active' : ''} ${ev.star ? 'has-star' : ''}`}
      data-reveal
    >
      <Branch side={side} />
      <div className="tl-card">
      <button type="button" className="tl-card__toggle" aria-expanded={open} onClick={() => onToggle(ev.id)}>
        <span className="tl-card__top">
          <span className="tl-card__date">{ev.date}</span>
          <span className={`tl-tag kind-${ev.kind}`}>{KIND_LABEL[ev.kind]}</span>
          {ev.star && (
            <span className="tl-card__star" title={`Crest star ${ev.star}`}>
              ★ {ev.star}
            </span>
          )}
        </span>
        <span className="tl-card__title">{ev.title}</span>
        <span className="tl-card__blurb">{ev.blurb}</span>
      </button>
        {open && (ev.more || ev.source) && (
          <span className="tl-card__more">
            {ev.more && <span>{ev.more}</span>}
            {ev.source && <span className="tl-card__src">Source · {ev.sourceLinks?.length ? ev.sourceLinks.map((source, i) => (
              <span key={source.url}>
                {i > 0 && ' · '}
                <a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a>
              </span>
            )) : ev.source}</span>}
          </span>
        )}
      </div>
    </li>
  );
}

function EraBlock({
  era,
  path,
  openId,
  activeId,
  onToggle,
}: {
  era: Era;
  path: PathSel;
  openId: string | null;
  activeId: string | null;
  onToggle: (id: string) => void;
}) {
  const events = [...era.events].reverse(); // newest at the top of the era
  return (
    <section className="tl-era" id={era.id} aria-labelledby={`${era.id}-h`} data-era={era.id}>
      <ol className="tl-era__nodes">
        {events.map((ev, i) => (
          <EventNode
            key={ev.id}
            ev={ev}
            side={i % 2 === 0 ? 'right' : 'left'}
            dim={path !== 'all' && !(ev.paths ?? []).includes(path)}
            open={openId === ev.id}
            active={activeId === ev.id}
            onToggle={onToggle}
          />
        ))}
      </ol>
      <header className="tl-era__head" data-reveal>
        <div className="tl-era__left">
          <span className="tl-era__years">{era.years}</span>
        </div>
        <span className="tl-era__ring">
          <span className="tl-era__runes" aria-hidden="true" />
          {era.num}
        </span>
        <div className="tl-era__right">
          <span className="tl-era__years tl-era__years--m">{era.years}</span>
          <h2 id={`${era.id}-h`} className="tl-era__title">
            {era.title}
          </h2>
          <p className="tl-era__tag">{era.tagline}</p>
        </div>
      </header>
    </section>
  );
}

/** Creator photo: custom cutout if provided, else public avatar, else a monogram. */
function CreatorPhoto({ name, avatar, photo }: { name: string; avatar?: string; photo?: string }) {
  const sources = useMemo(() => [photo, avatar && `https://unavatar.io/${avatar}?fallback=false`].filter(Boolean) as string[], [photo, avatar]);
  const [idx, setIdx] = useState(0);
  if (idx >= sources.length) {
    return (
      <span className="tl-creator__mono" aria-hidden="true">
        {name.slice(0, 2)}
      </span>
    );
  }
  return <img src={sources[idx]} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setIdx((n) => n + 1)} />;
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export function TimelinePage() {
  const [path, setPath] = useState<PathSel>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [step, setStep] = useState(-1);
  const [eraOn, setEraOn] = useState<string>('canopy');
  const [treeH, setTreeH] = useState(0);
  const [bend, setBend] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  // Path steps run oldest -> newest: you climb the tree.
  const pathEvents = useMemo(() => (path === 'all' ? [] : ALL_EVENTS.filter((e) => (e.paths ?? []).includes(path))), [path]);

  const goStep = useCallback(
    (n: number) => {
      const ev = pathEvents[n];
      if (!ev) return;
      setStep(n);
      setActiveId(ev.id);
      setOpenId(ev.id);
      scrollToId(`ev-${ev.id}`);
    },
    [pathEvents],
  );

  const choosePath = (p: PathSel) => {
    setPath(p);
    setStep(-1);
    setActiveId(null);
    setOpenId(null);
  };

  const jumpTo = (eventId: string) => {
    setActiveId(eventId);
    setOpenId(eventId);
    scrollToId(`ev-${eventId}`);
  };

  // Trunk spans the whole timeline: keep its height in sync with the content.
  useEffect(() => {
    const el = treeRef.current;
    if (!el) return;
    const sync = () => setTreeH(Math.round(el.getBoundingClientRect().height));
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Phones: the trunk runs down the left edge but the crown is centred, so the top of the trunk leans over to meet it.
  useEffect(() => {
    const calc = () => {
      const crown = document.querySelector('.tl-canopy')?.getBoundingClientRect();
      const trunk = document.querySelector('.tl-btrunk')?.getBoundingClientRect();
      if (!crown || !trunk || !trunk.width) return;
      const scale = trunk.width / 280; // the trunk svg is 280 wide, squeezed on phones
      const off = (crown.left + crown.width / 2 - (trunk.left + trunk.width / 2)) / scale;
      setBend(Math.abs(off) < 2 ? 0 : Math.round(off));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [treeH]);

  // Reveal-on-scroll + which era is in view (for the rail).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const items = root.querySelectorAll<HTMLElement>('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.setAttribute('data-in', ''));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.setAttribute('data-in', ''); // not a class: React rewrites className on re-render
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    items.forEach((el) => io.observe(el));

    const sections = root.querySelectorAll<HTMLElement>('[data-era]');
    const eraIo = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setEraOn((e.target as HTMLElement).dataset.era ?? 'canopy');
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    sections.forEach((el) => eraIo.observe(el));
    return () => {
      io.disconnect();
      eraIo.disconnect();
    };
  }, []);

  // Arrow keys walk the path when one is chosen.
  useEffect(() => {
    if (path === 'all') return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        goStep(Math.min(pathEvents.length - 1, step + 1));
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        goStep(Math.max(0, step - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [path, step, pathEvents, goStep]);

  const erasDesc = [...ERAS].reverse(); // crown (newest) first, roots last
  const pathMeta = PATHS.find((p) => p.id === path)!;

  return (
    <div className="tl-root" ref={rootRef}>
      <nav className="tl-rail" aria-label="Eras">
        <button type="button" className={eraOn === 'canopy' ? 'is-on' : ''} onClick={() => scrollToId('tl-top')}>
          <span>Now</span>
          <small>crown</small>
        </button>
        {erasDesc.map((e) => (
          <button key={e.id} type="button" className={eraOn === e.id ? 'is-on' : ''} onClick={() => scrollToId(`${e.id}-h`)}>
            <span>{e.num}</span>
            <small>{e.years}</small>
          </button>
        ))}
        <button type="button" className={eraOn === 'roots' ? 'is-on' : ''} onClick={() => scrollToId('tl-roots')}>
          <span>2010</span>
          <small>roots</small>
        </button>
      </nav>

      <header className="tl-hero" id="tl-top" data-era="canopy">
        <p className="tl-kicker">
          <span className="tl-kicker__bar" />
          {FIRST_YEAR} → {LAST_YEAR} · The legacy
        </p>
        <h1 className="tl-title">
          The FaZe Tree<span className="tl-dot">.</span>
        </h1>
        <p className="tl-lede">
          Three kids and a sniper rifle grew into five world titles, a Nasdaq listing and a generation of gaming’s biggest stars. Nobody
          else in gaming has roots this deep. Climb it.
        </p>
        <div className="tl-crest" aria-label="Stars on the FaZe Esports crest">
          {STARS.map((s) => (
            <button key={s.n} type="button" className="tl-star" onClick={() => jumpTo(s.event)} title={`★ ${s.n} · ${s.label}`}>
              ★<span className="tl-star__tip">{s.label}</span>
            </button>
          ))}
        </div>
        <div className="tl-paths" role="radiogroup" aria-label="Choose a path">
          {PATHS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={path === p.id}
              className={`tl-path ${path === p.id ? 'is-on' : ''}`}
              onClick={() => choosePath(p.id)}
            >
              <span className="tl-path__label">{p.label}</span>
              <span className="tl-path__hint">{p.hint}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="tl-crown">
        <span className="tl-rays" aria-hidden="true" />
        <Canopy trunkWidth={TRUNK_TOP} />
      </div>

      <div className="tl-tree" ref={treeRef}>
        <span className="tl-aura" aria-hidden="true" />
        <BraidedTrunk height={treeH} top={TRUNK_TOP} bottom={TRUNK_BOTTOM} bend={bend} />
        {erasDesc.map((era) => (
          <EraBlock
            key={era.id}
            era={era}
            path={path}
            openId={openId}
            activeId={activeId}
            onToggle={(id) => setOpenId((cur) => (cur === id ? null : id))}
          />
        ))}
      </div>

      <section className="tl-ground" id="tl-roots" data-era="roots" aria-labelledby="tl-roots-h">
        <div className="tl-roots-wrap">
          <span className="tl-pool" aria-hidden="true" />
          <Roots trunkWidth={TRUNK_BOTTOM} trunkHeight={treeH} />
        </div>
        <div className="tl-seed" data-reveal>
          <p className="tl-kicker tl-kicker--center">
            <span className="tl-kicker__bar" />
            May 31, 2010
          </p>
          <h2 id="tl-roots-h" className="tl-seed__title">
            Every branch started here.
          </h2>
          <p className="tl-seed__text">“FaZe Sniping Intro.” Three players, one Intervention, and the start of something nobody saw coming.</p>
          {path !== 'all' && step < 0 && (
            <button type="button" className="tl-btn" onClick={() => goStep(0)}>
              Start climbing ↑
            </button>
          )}
        </div>
      </section>

      <section className="tl-fallen" aria-labelledby="tl-fallen-h">
        <p className="tl-kicker">
          <span className="tl-kicker__bar" />
          Grown at FaZe
        </p>
        <h2 id="tl-fallen-h" className="tl-fallen__title">
          FaZe didn’t sign stars. It made them.
        </h2>
        <p className="tl-lede">Some of the biggest names in gaming came up wearing the tag before they branched out on their own.</p>
        <ol className="tl-creators">
          {FALLEN.map((p, i) => {
            const span = LAST_YEAR - FIRST_YEAR;
            const years = Math.max(1, p.to - p.from);
            return (
              <li key={p.id} className="tl-creator" data-reveal style={{ ['--i' as string]: i }}>
                <span className="tl-creator__ghost" aria-hidden="true">
                  {p.name}
                </span>
                <span className="tl-creator__photo">
                  <CreatorPhoto name={p.name} avatar={p.avatar} photo={p.photo} />
                </span>
                <span className="tl-creator__body">
                  <strong className="tl-creator__name">{p.name}</strong>
                  <span className="tl-creator__years">
                    {p.from}–{String(p.to).slice(2)} · {years} yr{years === 1 ? '' : 's'}
                  </span>
                  <span className="tl-creator__bar" aria-hidden="true">
                    <i style={{ left: `${((p.from - FIRST_YEAR) / span) * 100}%`, width: `${(years / span) * 100}%` }} />
                  </span>
                  <span className="tl-creator__known">{p.known}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="tl-fine">Condensed from FaZe’s own 2010–2026 timeline. Fan project; not affiliated with or endorsed by FaZe Clan.</p>
      </section>

      {path !== 'all' && (
        <div className="tl-walker" role="region" aria-label={`${pathMeta.label} path`}>
          <span className="tl-walker__label">
            {pathMeta.label}
            <small>{step < 0 ? `${pathEvents.length} moments` : `${step + 1} / ${pathEvents.length}`}</small>
          </span>
          {step < 0 ? (
            <button type="button" className="tl-btn" onClick={() => goStep(0)}>
              Start at the roots
            </button>
          ) : (
            <>
              <button type="button" className="tl-btn tl-btn--ghost" onClick={() => goStep(step - 1)} disabled={step <= 0}>
                ↓ Older
              </button>
              <button type="button" className="tl-btn" onClick={() => goStep(step + 1)} disabled={step >= pathEvents.length - 1}>
                Newer ↑
              </button>
            </>
          )}
          <button type="button" className="tl-walker__close" onClick={() => choosePath('all')} aria-label="Show everything">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
