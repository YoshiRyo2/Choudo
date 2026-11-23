/**
 * The mascot heads and the face, as plain geometry (cm, like the rest of the
 * drawing). A skin only: laid out from the head box the body geometry already has
 * (`BodyGeometry.head`), never feeding anything back into the body.
 */
import type { FitTone } from '../../../domain/fit';

export const HEAD_KINDS = ['cloud', 'peach', 'bunny'] as const;
export type HeadKind = (typeof HEAD_KINDS)[number];

export const isHeadKind = (value: unknown): value is HeadKind => HEAD_KINDS.includes(value as HeadKind);

/** "Cloud", for the picker's "Cloud head". */
export const HEAD_NAME: Record<HeadKind, string> = { cloud: 'Cloud', peach: 'Peach', bunny: 'Bunny' };

export interface Circle {
  cx: number;
  cy: number;
  r: number;
}

export interface Ellipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Degrees, about the centre. */
  rotate: number;
}

/** Where a head goes: centred on x, its bottom on the chin line, sized by w = the head's half width. */
export interface HeadAnchor {
  x: number;
  bottom: number;
  w: number;
}

/** The anchor for the body geometry's head ellipse: same centre line, bottom on its chin, its half width. */
export function headAnchor(head: { cx: number; cy: number; rx: number; ry: number }): HeadAnchor {
  return { x: head.cx, bottom: head.cy + head.ry, w: head.rx };
}

export interface HeadShape {
  kind: HeadKind;
  /** Filled as one shape with one outline round the group; [0] is the circle the face sits on. */
  puffs: Circle[];
  /** Behind the puffs (bunny). */
  ears: { outer: Ellipse; inner: Ellipse }[];
  /** Behind the puffs, its base hidden by them (peach). */
  leaf: string | null;
  /** Over the fill (peach). */
  crease: string | null;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const pt = (x: number, y: number) => `${r2(x)} ${r2(y)}`;

/** One head, laid out in units of the anchor's w. Every head stays within 2.96 w of its bottom (the old head's height). */
export function headShape(kind: HeadKind, { x, bottom, w }: HeadAnchor): HeadShape {
  const circle = (dx: number, up: number, r: number): Circle => ({ cx: r2(x + dx * w), cy: r2(bottom - up * w), r: r2(r * w) });
  if (kind === 'cloud') {
    return {
      kind,
      puffs: [circle(0, 0.95, 0.95), circle(-0.8, 0.6, 0.58), circle(0.8, 0.6, 0.58), circle(0.28, 1.78, 0.62)],
      ears: [],
      leaf: null,
      crease: null,
    };
  }
  if (kind === 'peach') {
    const base = { x: x + 0.08 * w, y: bottom - 1.92 * w };
    const tip = { x: x + 0.78 * w, y: bottom - 2.5 * w };
    return {
      kind,
      puffs: [circle(0, 1, 1)],
      ears: [],
      leaf:
        `M${pt(base.x, base.y)} Q${pt(x + 0.18 * w, bottom - 2.62 * w)} ${pt(tip.x, tip.y)}` +
        ` Q${pt(x + 0.72 * w, bottom - 1.92 * w)} ${pt(base.x, base.y)} Z`,
      crease: `M${pt(x, bottom - 1.97 * w)} Q${pt(x - 0.3 * w, bottom - 1.75 * w)} ${pt(x - 0.2 * w, bottom - 1.5 * w)}`,
    };
  }
  const ear = (side: -1 | 1) => ({
    outer: { cx: r2(x + side * 0.42 * w), cy: r2(bottom - 2.05 * w), rx: r2(0.27 * w), ry: r2(0.72 * w), rotate: side * 12 },
    inner: { cx: r2(x + side * 0.42 * w), cy: r2(bottom - 1.97 * w), rx: r2(0.13 * w), ry: r2(0.48 * w), rotate: side * 12 },
  });
  return { kind, puffs: [circle(0, 0.95, 0.95)], ears: [ear(-1), ear(1)], leaf: null, crease: null };
}

/** The highest point a head reaches (smallest y): for checking it keeps within the old head's height. */
export function headTop(shape: HeadShape): number {
  const tops = [
    ...shape.puffs.map((c) => c.cy - c.r),
    // An ellipse tilted by a, its top: cy − sqrt((rx sin a)² + (ry cos a)²).
    ...shape.ears.map(({ outer: e }) => {
      const a = (e.rotate * Math.PI) / 180;
      return e.cy - Math.hypot(e.rx * Math.sin(a), e.ry * Math.cos(a));
    }),
  ];
  return Math.min(...tops);
}

export interface FaceShape {
  eyes: 'closed' | 'dot';
  mouth: 'smile' | 'flat' | 'frown';
  /** Dot eyes (empty when closed). */
  eyeDots: Circle[];
  /** Happy closed eyes, ^ ^ (empty when dots). */
  eyeArcs: string[];
  mouthPath: string;
  blush: Ellipse[];
}

const FACE: Record<FitTone, Pick<FaceShape, 'eyes' | 'mouth'>> = {
  good: { eyes: 'closed', mouth: 'smile' },
  warn: { eyes: 'dot', mouth: 'flat' },
  bad: { eyes: 'dot', mouth: 'frown' },
  unknown: { eyes: 'dot', mouth: 'flat' },
};

/** The face for a fit tone, on the circle it sits on: the same face on every head. */
export function faceShape(tone: FitTone, on: Circle): FaceShape {
  const { cx, cy, r } = on;
  const { eyes, mouth } = FACE[tone];
  const eyeY = cy + 0.02 * r;
  const eyeXs = [cx - 0.36 * r, cx + 0.36 * r];
  const my = cy + 0.36 * r;
  const mouthPath =
    mouth === 'smile'
      ? `M${pt(cx - 0.2 * r, my - 0.04 * r)} Q${pt(cx, my + 0.22 * r)} ${pt(cx + 0.2 * r, my - 0.04 * r)}`
      : mouth === 'frown'
        ? `M${pt(cx - 0.16 * r, my + 0.08 * r)} Q${pt(cx, my - 0.12 * r)} ${pt(cx + 0.16 * r, my + 0.08 * r)}`
        : `M${pt(cx - 0.15 * r, my)} L${pt(cx + 0.15 * r, my)}`;
  return {
    eyes,
    mouth,
    eyeDots: eyes === 'dot' ? eyeXs.map((ex) => ({ cx: r2(ex), cy: r2(eyeY), r: r2(0.13 * r) })) : [],
    eyeArcs:
      eyes === 'closed'
        ? eyeXs.map((ex) => `M${pt(ex - 0.17 * r, eyeY + 0.07 * r)} Q${pt(ex, eyeY - 0.2 * r)} ${pt(ex + 0.17 * r, eyeY + 0.07 * r)}`)
        : [],
    mouthPath,
    blush: [-1, 1].map((side) => ({ cx: r2(cx + side * 0.6 * r), cy: r2(cy + 0.3 * r), rx: r2(0.17 * r), ry: r2(0.1 * r), rotate: 0 })),
  };
}
