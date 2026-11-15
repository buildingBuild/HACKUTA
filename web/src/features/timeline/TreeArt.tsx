// SVG art for the FaZe tree: the canopy (everything FaZe branched into) and the roots (who it grew from).
// Geometry is generated from the data with a seeded RNG so it looks organic but renders the same every time.
import { useMemo, useState } from 'react';
import { CANOPY, LIMB_LABEL, ROOTS, type Limb } from './data';

type Pt = { x: number; y: number };

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const polar = (o: Pt, deg: number, r: number): Pt => ({ x: o.x + Math.cos(rad(deg)) * r, y: o.y + Math.sin(rad(deg)) * r });
/** Canopy points sit on an ellipse so the crown spreads wide. */
const CROWN_X = 1.32;
const wide = (o: Pt, deg: number, r: number): Pt => ({ x: o.x + Math.cos(rad(deg)) * r * CROWN_X, y: o.y + Math.sin(rad(deg)) * r });
const f = (n: number) => n.toFixed(1);

/** Organic curve from a to b: leaves a along dirA, arrives at b along dirB. */
function curve(a: Pt, b: Pt, dirA: number, dirB: number, k = 0.42) {
  const d = Math.hypot(b.x - a.x, b.y - a.y) * k;
  const c1 = polar(a, dirA, d);
  const c2 = polar(b, dirB + 180, d);
  return `M${f(a.x)},${f(a.y)} C${f(c1.x)},${f(c1.y)} ${f(c2.x)},${f(c2.y)} ${f(b.x)},${f(b.y)}`;
}

/** Tapered branch: a filled shape whose width shrinks from w0 to w1. */
function taper(a: Pt, b: Pt, dirA: number, dirB: number, w0: number, w1: number, k = 0.42) {
  const d = Math.hypot(b.x - a.x, b.y - a.y) * k;
  const c1 = polar(a, dirA, d);
  const c2 = polar(b, dirB + 180, d);
  const side = (p: Pt, dir: number, w: number, s: 1 | -1) => polar(p, dir + 90 * s, w / 2);
  const wm = (w0 + w1) / 2;
  const L = [side(a, dirA, w0, -1), side(c1, dirA, wm, -1), side(c2, dirB, wm, -1), side(b, dirB, w1, -1)];
  const Rr = [side(b, dirB, w1, 1), side(c2, dirB, wm, 1), side(c1, dirA, wm, 1), side(a, dirA, w0, 1)];
  const p = (q: Pt) => `${f(q.x)},${f(q.y)}`;
  return `M${p(L[0])} C${p(L[1])} ${p(L[2])} ${p(L[3])} L${p(Rr[0])} C${p(Rr[1])} ${p(Rr[2])} ${p(Rr[3])} Z`;
}

const LIMBS: Limb[] = ['esports', 'content', 'culture'];
const W = 1600;
const H = 780;
const BASE: Pt = { x: W / 2, y: H };

interface Tip {
  label: string;
  year: number;
  limb: Limb;
  angle: number;
  at: Pt;
  group: number;
}

export function Canopy({ trunkWidth = 22 }: { trunkWidth?: number }) {
  const [hot, setHot] = useState<{ limb: Limb; group?: number; label?: string } | null>(null);

  const g = useMemo(() => {
    const rand = rng(2010);
    const items = LIMBS.flatMap((l) => CANOPY.filter((c) => c.limb === l));
    const a0 = -158;
    const a1 = -22;
    const tips: Tip[] = items.map((c, i) => {
      const angle = a0 + ((a1 - a0) * i) / (items.length - 1);
      const r = 430 + (rand() - 0.5) * 40;
      return { ...c, angle, at: wide(BASE, angle, r), group: 0 };
    });

    const limbs = LIMBS.map((limb) => {
      const mine = tips.filter((t) => t.limb === limb);
      const mid = mine.reduce((s, t) => s + t.angle, 0) / mine.length;
      const at = wide(BASE, mid, 205);
      // split into sub-forks of 3-4
      const per = mine.length > 8 ? 4 : 3;
      const groups: Tip[][] = [];
      for (let i = 0; i < mine.length; i += per) groups.push(mine.slice(i, i + per));
      if (groups.length > 1 && groups[groups.length - 1].length === 1) groups[groups.length - 2].push(...groups.pop()!);
      const forks = groups.map((gr, gi) => {
        gr.forEach((t) => (t.group = gi));
        const ga = gr.reduce((s, t) => s + t.angle, 0) / gr.length;
        return { gi, angle: ga, at: wide(BASE, ga + (rand() - 0.5) * 4, 335 + (rand() - 0.5) * 20), tips: gr };
      });
      return { limb, angle: mid, at, forks };
    });

    // twigs + leaf clusters around each tip
    const twigs: string[] = [];
    const leaves: { x: number; y: number; r: number; o: number; d: number }[] = [];
    for (const t of tips) {
      for (let k = 0; k < 2; k++) {
        const ang = t.angle + (k ? 1 : -1) * (18 + rand() * 18);
        const end = polar(t.at, ang, 18 + rand() * 18);
        twigs.push(curve(t.at, end, t.angle, ang, 0.5));
        for (let j = 0; j < 3; j++) {
          const p = polar(end, rand() * 360, rand() * 14);
          leaves.push({ ...p, r: 1.5 + rand() * 3.2, o: 0.35 + rand() * 0.6, d: rand() * 4 });
        }
      }
      for (let j = 0; j < 4; j++) {
        const p = polar(t.at, rand() * 360, 6 + rand() * 18);
        leaves.push({ ...p, r: 1.5 + rand() * 3.5, o: 0.4 + rand() * 0.6, d: rand() * 4 });
      }
    }
    // loose sparkles in the crown
    for (let j = 0; j < 140; j++) {
      const p = wide(BASE, -165 + rand() * 150, 220 + rand() * 300);
      leaves.push({ ...p, r: 0.8 + rand() * 2.2, o: 0.15 + rand() * 0.5, d: rand() * 5 });
    }
    // soft glowing foliage masses: the crown's "light"
    const foliage: { x: number; y: number; r: number }[] = [];
    for (const t of tips) foliage.push({ ...polar(t.at, t.angle + (rand() - 0.5) * 30, 10 + rand() * 20), r: 46 + rand() * 30 });
    for (const l of limbs) {
      for (const fk of l.forks) foliage.push({ ...fk.at, r: 80 + rand() * 40 });
      foliage.push({ ...polar(l.at, l.angle, 60), r: 110 + rand() * 30 });
    }
    for (let j = 0; j < 34; j++) foliage.push({ ...wide(BASE, -160 + rand() * 140, 280 + rand() * 170), r: 44 + rand() * 54 });
    return { tips, limbs, twigs, leaves, foliage };
  }, []);

  const isHot = (limb: Limb, group?: number, label?: string) => {
    if (!hot || hot.limb !== limb) return false;
    if (group !== undefined && hot.group !== undefined && group !== hot.group) return false;
    if (label !== undefined && hot.label !== undefined && label !== hot.label) return false;
    return true;
  };
  const hc = (on: boolean) => (on ? 'is-hot' : undefined);

  return (
    <svg className={`tl-canopy ${hot ? 'has-hot' : ''}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="tl-canopy-t">
      <title id="tl-canopy-t">
        The FaZe tree's canopy: everything FaZe branched into, from Call of Duty and Counter-Strike to G FUEL, the NFL and Nasdaq.
      </title>
      <defs>
        <radialGradient id="tl-crown" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e4002b" stopOpacity="0.07" />
          <stop offset="45%" stopColor="#e4002b" stopOpacity="0.03" />
          <stop offset="100%" stopColor="#e4002b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tl-leafglow">
          <stop offset="0%" stopColor="#ff4d63" stopOpacity="0.16" />
          <stop offset="40%" stopColor="#e4002b" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#e4002b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="tl-wood" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#e4002b" />
          <stop offset="100%" stopColor="#c4001f" />
        </linearGradient>
        <filter id="tl-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse cx={W / 2} cy={H - 330} rx={800} ry={460} fill="url(#tl-crown)" />

      {/* the halo behind the crown */}
      <g className="tl-halo">
        <ellipse cx={W / 2} cy={H - 360} rx={430} ry={340} />
        <ellipse cx={W / 2} cy={H - 360} rx={458} ry={362} className="tl-halo__thin" />
        <ellipse cx={W / 2} cy={H - 360} rx={396} ry={312} className="tl-halo__runes" />
      </g>

      <g className="tl-foliage">
        {g.foliage.map((p, i) => (
          <circle key={i} cx={f(p.x)} cy={f(p.y)} r={f(p.r)} fill="url(#tl-leafglow)" />
        ))}
      </g>

      <g className="tl-canopy__wood" filter="url(#tl-glow)">
        {g.limbs.map((l) => (
          <g key={l.limb} className={`tl-limb limb-${l.limb}`}>
            <path className={hc(isHot(l.limb))} d={taper(BASE, l.at, -90, l.angle, trunkWidth * 0.62, 16, 0.5)} />
            {l.forks.map((fk) => (
              <g key={fk.gi}>
                <path className={hc(isHot(l.limb, fk.gi))} d={taper(l.at, fk.at, l.angle, fk.angle, 16, 8)} />
                {fk.tips.map((t) => (
                  <path
                    key={t.label}
                    className={hc(isHot(l.limb, fk.gi, t.label))}
                    d={taper(fk.at, t.at, fk.angle, t.angle, 8, 2.4)}
                  />
                ))}
              </g>
            ))}
          </g>
        ))}
        <g className="tl-twigs">
          {g.twigs.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      </g>

      <g className="tl-leaves">
        {g.leaves.map((p, i) => (
          <circle key={i} cx={f(p.x)} cy={f(p.y)} r={f(p.r)} style={{ opacity: p.o, animationDelay: `${p.d}s` }} />
        ))}
      </g>

      {g.limbs.map((l) => {
        const p = polar(l.at, l.angle, 4);
        return (
          <g key={l.limb} className={`tl-limb-label limb-${l.limb}`} transform={`translate(${f(p.x)},${f(p.y)})`}>
            <rect x={-62} y={-15} width={124} height={30} />
            <text textAnchor="middle" dy="5">
              {LIMB_LABEL[l.limb]}
            </text>
          </g>
        );
      })}

      {g.tips.map((t) => {
        const left = t.angle < -90;
        const p = polar(t.at, t.angle, 40);
        const rot = left ? t.angle + 180 : t.angle;
        return (
          <g
            key={t.label}
            className={`tl-tip limb-${t.limb} ${isHot(t.limb, t.group, t.label) ? 'is-hot' : ''}`}
            onMouseEnter={() => setHot({ limb: t.limb, group: t.group, label: t.label })}
            onMouseLeave={() => setHot(null)}
            tabIndex={0}
            onFocus={() => setHot({ limb: t.limb, group: t.group, label: t.label })}
            onBlur={() => setHot(null)}
            aria-label={`${t.label}, since ${t.year}`}
          >
            <circle className="tl-tip__bud" cx={f(t.at.x)} cy={f(t.at.y)} r={4.5} />
            <text transform={`translate(${f(p.x)},${f(p.y)}) rotate(${f(rot)})`} textAnchor={left ? 'end' : 'start'} dy="5">
              {left && <tspan className="tl-tip__year">{t.year} · </tspan>}
              {t.label}
              {!left && <tspan className="tl-tip__year"> · {t.year}</tspan>}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const RW = 1600;
const RH = 600;

/** Braid settings shared by the trunk and the roots so the spiral carries straight through. */
export const BRAID_N = 7;
export const BRAID_PERIOD = 150;

type RootLabel = { label: string; note: string; main?: boolean };

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * The roots. Each braided strand of the trunk keeps spiralling past the bottom of the trunk, then
 * slowly unwinds and peels away to become one of the named roots: the trunk and roots are one shape.
 * `trunkHeight` keeps the spiral's phase continuous with the trunk above.
 */
export function Roots({ trunkWidth = 130, trunkHeight = 0 }: { trunkWidth?: number; trunkHeight?: number }) {
  const g = useMemo(() => {
    const rand = rng(531);
    const cx = RW / 2;
    const H = trunkHeight;
    const dirTo = (a: Pt, b: Pt) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    const A0 = (trunkWidth / 2 - 2) * 0.92; // braid radius where the trunk ends
    const phaseOf = (i: number, v: number) => (H + v) / BRAID_PERIOD + (i * Math.PI * 2) / BRAID_N;

    type Seg = { d: string; w: number; tone: number };
    const roots: Seg[] = [];
    const back: string[] = [];
    const rootlets: { d: string }[] = [];
    const hairs: string[] = [];

    // core: the trunk's solid centre continues and tapers away inside the spiral
    const coreHalf = (trunkWidth * 0.62) / 2;
    const coreL: string[] = [];
    const coreR: string[] = [];
    for (let v = 0; v <= 230; v += 10) {
      const h = coreHalf * Math.pow(1 - v / 230, 0.9);
      coreL.push(`${f(cx - h)},${f(v)}`);
      coreR.unshift(`${f(cx + h)},${f(v)}`);
    }
    const core = `M${coreL.join(' L')} L${coreR.join(' L')} Z`;

    // named roots and where they end
    const founders = ROOTS.filter((r) => r.main);
    const others = ROOTS.filter((r) => !r.main).slice(0, 6);
    const at = (ang: number, rx: number, ry: number): Pt => ({ x: cx + Math.cos(rad(ang)) * rx, y: 40 + Math.sin(rad(ang)) * ry });
    // [Temperrr, Fakie, Apex, Spratt, Ramos, Pamaj]
    const oEnd = [at(170, 540, 250), at(154, 540, 250), at(136, 540, 320), at(44, 540, 320), at(26, 540, 250), at(10, 540, 250)];
    const fEnd = [at(120, 300, 360), { x: cx, y: 460 }, at(60, 300, 360)];
    // seven strands -> seven main roots (left to right); Temperrr and Pamaj split off the outer two
    const mains: { r: RootLabel; end: Pt; w: number; far?: boolean }[] = [
      { r: others[1], end: oEnd[1], w: 1, far: true },
      { r: others[2], end: oEnd[2], w: 1 },
      { r: founders[0], end: fEnd[0], w: 1.5 },
      { r: founders[1], end: fEnd[1], w: 1.6 },
      { r: founders[2], end: fEnd[2], w: 1.5 },
      { r: others[3], end: oEnd[3], w: 1 },
      { r: others[4], end: oEnd[4], w: 1, far: true },
    ];
    // strands ordered by where they leave the trunk, so they peel off without crossing much
    const order = Array.from({ length: BRAID_N }, (_, i) => i).sort((a, b) => Math.sin(phaseOf(a, 0)) - Math.sin(phaseOf(b, 0)));

    const tips: { at: Pt; r: RootLabel; far?: boolean }[] = [];
    const W0 = 8.6; // strand width where the trunk ends
    const SPIRAL = 210; // how far the braid keeps turning before it lets go

    order.forEach((strand, k) => {
      const m = mains[k];
      const { end } = m;
      const P1 = { x: cx + (end.x - cx) * 0.22, y: Math.max(end.y * 0.85, 150) };
      const pts: Pt[] = [];
      const S = 72;
      for (let s = 0; s <= S; s++) {
        const u = s / S;
        const v = u * SPIRAL;
        const amp = A0 * (1 + 0.9 * u);
        const bx = cx + amp * Math.sin(phaseOf(strand, v));
        const by = v;
        // target path: a soft curve from the trunk centre out to the root's end
        const tx = (1 - u) * (1 - u) * cx + 2 * (1 - u) * u * P1.x + u * u * end.x;
        const ty = 2 * (1 - u) * u * P1.y + u * u * end.y;
        const e = smooth(0.06, 1, u);
        pts.push({ x: bx * (1 - e) + tx * e, y: by * (1 - e) + ty * e });
      }
      // stroke in short runs so the width can swell, then taper to a point
      const width = (u: number) => W0 * m.w * (1 + 0.6 * Math.sin(Math.PI * Math.min(1, u * 1.4))) * Math.pow(1 - u, 0.75) + 1.2;
      for (let s = 0; s < S; s += 4) {
        const run = pts.slice(s, s + 5);
        roots.push({ d: `M${run.map((p) => `${f(p.x)},${f(p.y)}`).join(' L')}`, w: width(s / S), tone: strand % 2 });
      }
      tips.push({ at: end, r: m.r, far: m.far });

      // rootlets and hairs off each main root
      for (const u of [0.5, 0.72]) {
        const p = pts[Math.round(u * S)];
        const q = pts[Math.round(u * S) + 1];
        const dir = dirTo(p, q);
        const side = rand() > 0.5 ? 1 : -1;
        const ang = Math.min(168, Math.max(12, dir + side * (25 + rand() * 30) + 10));
        const tip = polar(p, ang, 70 + rand() * 120);
        rootlets.push({ d: taper(p, tip, dir, ang, Math.max(2.5, width(u) * 0.7), 1, 0.5) });
        for (let h = 0; h < 2; h++) {
          const a2 = ang + (rand() - 0.5) * 70;
          hairs.push(curve(tip, polar(tip, a2, 16 + rand() * 28), ang, a2, 0.5));
        }
      }
      const last = pts[S - 1];
      const endDir = dirTo(last, end);
      for (let h = 0; h < 3; h++) {
        const a2 = endDir + (rand() - 0.5) * 90;
        hairs.push(curve(end, polar(end, a2, 18 + rand() * 34), endDir, a2, 0.5));
      }

      // Temperrr / Pamaj split off the outermost roots
      const extra = k === 0 ? { r: others[0], end: oEnd[0] } : k === BRAID_N - 1 ? { r: others[5], end: oEnd[5] } : null;
      if (extra) {
        const p = pts[Math.round(0.45 * S)];
        const q = pts[Math.round(0.45 * S) + 1];
        rootlets.push({ d: taper(p, extra.end, dirTo(p, q), dirTo(p, extra.end), width(0.45) * 0.8, 1.4, 0.5) });
        tips.push({ at: extra.end, r: extra.r, far: true });
      }
    });

    // back layer: darker roots emerging from inside the spiral, for depth
    for (let i = 0; i < 16; i++) {
      const ang = 10 + (160 * i) / 15 + (rand() - 0.5) * 8;
      const start = { x: cx + (rand() - 0.5) * coreHalf, y: 60 + rand() * 90 };
      const end = { x: cx + Math.cos(rad(ang)) * (360 + rand() * 360), y: 60 + Math.sin(rad(ang)) * (160 + rand() * 330) };
      back.push(taper(start, end, 90, dirTo(start, end), 6 + rand() * 8, 1, 0.55));
    }

    const glints: { x: number; y: number; r: number; o: number }[] = [];
    for (let i = 0; i < 70; i++) {
      const a = rand() * 180;
      const p = { x: cx + Math.cos(rad(a)) * rand() * 760, y: 40 + Math.sin(rad(a)) * rand() * 520 };
      glints.push({ ...p, r: 0.8 + rand() * 2, o: 0.2 + rand() * 0.6 });
    }
    return { core, roots, back, rootlets, hairs, tips, glints };
  }, [trunkWidth, trunkHeight]);

  return (
    <svg className="tl-roots" viewBox={`0 0 ${RW} ${RH}`} role="img" aria-labelledby="tl-roots-t">
      <title id="tl-roots-t">The roots: FaZe's founders ClipZ, House Cat and Resistance, and the first names that grew from them.</title>
      <defs>
        <linearGradient id="tl-rootcore" x1="0" x2="1">
          <stop offset="0%" stopColor="#7d0016" />
          <stop offset="35%" stopColor="#e4002b" />
          <stop offset="50%" stopColor="#ff5c72" />
          <stop offset="65%" stopColor="#e4002b" />
          <stop offset="100%" stopColor="#7d0016" />
        </linearGradient>
        <linearGradient id="tl-rootwood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff3b55" />
          <stop offset="55%" stopColor="#e4002b" />
          <stop offset="100%" stopColor="#a3001c" />
        </linearGradient>
      </defs>

      <g className="tl-roots__back">
        {g.back.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g className="tl-roots__hairs">
        {g.hairs.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g className="tl-roots__mid">
        {g.rootlets.map((r, i) => (
          <path key={i} d={r.d} />
        ))}
      </g>
      <g className="tl-roots__spiral">
        <path className="tl-roots__core" d={g.core} fill="url(#tl-rootcore)" />
        {g.roots.map((s, i) => (
          <path key={i} className={`tone-${s.tone}`} d={s.d} strokeWidth={f(s.w)} />
        ))}
      </g>
      <g className="tl-roots__glints">
        {g.glints.map((p, i) => (
          <circle key={i} cx={f(p.x)} cy={f(p.y)} r={f(p.r)} style={{ opacity: p.o }} />
        ))}
      </g>

      {g.tips.map(({ at, r, far }) => {
        const main = Boolean(r.main);
        const w = main ? 210 : Math.max(120, r.label.length * 15 + 40);
        const h = main ? 64 : 50;
        return (
          <g key={r.label} className={`tl-rootnode ${main ? 'is-main' : ''} ${far ? 'is-far' : ''}`} transform={`translate(${f(at.x)},${f(at.y)})`}>
            <circle className="tl-rootnode__glow" r={main ? 26 : 16} />
            <circle className="tl-rootnode__dot" r={main ? 7 : 5} />
            <g transform={`translate(0, ${main ? 22 : 16})`}>
              <rect x={-w / 2} y={0} width={w} height={h} />
              <text className="tl-rootnode__name" textAnchor="middle" y={main ? 34 : 27}>
                {r.label}
              </text>
              <text className="tl-rootnode__note" textAnchor="middle" y={main ? 54 : 43}>
                {main ? 'Co-founder · 2010' : `Joined ${r.note}`}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * The trunk: one braided, glowing column drawn for the full height of the timeline.
 * Thin at the top (where it meets the canopy), thick and twisting at the bottom (the roots).
 */
export function BraidedTrunk({ height, top = 22, bottom = 72 }: { height: number; top?: number; bottom?: number }) {
  const TW = 280;
  const cx = TW / 2;
  const g = useMemo(() => {
    if (height <= 0) return null;
    const H = height;
    const step = 14;
    const widthAt = (y: number) => top + (bottom - top) * Math.pow(y / H, 1.25);

    // solid core (tapered)
    const left: string[] = [];
    const right: string[] = [];
    for (let y = 0; y <= H; y += step * 4) {
      const w = widthAt(y) * 0.62;
      const wob = Math.sin(y / 260) * 2.5;
      left.push(`${f(cx - w / 2 + wob)},${f(y)}`);
      right.unshift(`${f(cx + w / 2 + wob)},${f(y)}`);
    }
    left.push(`${f(cx - (widthAt(H) * 0.62) / 2)},${f(H)}`);
    right.unshift(`${f(cx + (widthAt(H) * 0.62) / 2)},${f(H)}`);
    const core = `M${left.join(' L')} L${right.join(' L')} Z`;

    // braided strands, split into segments so stroke width can grow downward
    const N = BRAID_N;
    const strands: { d: string; w: number; tone: number }[] = [];
    const SEG = 320;
    for (let i = 0; i < N; i++) {
      for (let y0 = 0; y0 < H; y0 += SEG) {
        const pts: string[] = [];
        const yEnd = Math.min(H, y0 + SEG + step);
        const ys: number[] = [];
        for (let y = y0; y < yEnd; y += step) ys.push(y);
        ys.push(yEnd);
        for (const y of ys) {
          const spread = widthAt(y) / 2 - 2;
          const x = cx + spread * Math.sin(y / BRAID_PERIOD + (i * Math.PI * 2) / N) * 0.92;
          pts.push(`${f(x)},${f(y)}`);
        }
        const mid = Math.min(H, y0 + SEG / 2);
        strands.push({ d: `M${pts.join(' L')}`, w: 2.2 + (widthAt(mid) / bottom) * 6.5, tone: i % 2 });
      }
    }
    return { core, strands };
  }, [height, top, bottom, cx]);

  if (!g) return null;
  return (
    <svg className="tl-btrunk" width={TW} height={height} viewBox={`0 0 ${TW} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id="tl-core" x1="0" x2="1">
          <stop offset="0%" stopColor="#7d0016" />
          <stop offset="35%" stopColor="#e4002b" />
          <stop offset="50%" stopColor="#ff5c72" />
          <stop offset="65%" stopColor="#e4002b" />
          <stop offset="100%" stopColor="#7d0016" />
        </linearGradient>
      </defs>
      <path className="tl-btrunk__core" d={g.core} fill="url(#tl-core)" />
      {g.strands.map((s, i) => (
        <path key={i} className={`tl-btrunk__strand tone-${s.tone}`} d={s.d} strokeWidth={f(s.w)} />
      ))}
    </svg>
  );
}
