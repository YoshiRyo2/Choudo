/**
 * Mannequin geometry: body measurements (cm) -> SVG shapes, in cm.
 *
 * The SVG viewBox is in centimetres, so a 190 cm body really is drawn taller than
 * a 160 cm one. Front view, centred on x = 0, y = 0 at the top of the head.
 *
 * Pure functions, no React. If we move to a 3D renderer later, only this folder
 * changes; it reads the same BodyMeasurements / Garment / SizeMeasurements.
 */

import type { BodyMeasurements } from '../../../domain/body';
import type { Garment, GarmentType, SizeMeasurements } from '../../../domain/garments';

export interface Pt {
  x: number;
  y: number;
  /** Keep this point sharp instead of smoothing through it. */
  corner?: boolean;
}

// ---------- path helpers ----------

const f = (v: number) => (Math.round(v * 100) / 100).toString();

/** Catmull-Rom spline through the points, as cubic Bézier SVG path data. */
export function smoothPath(pts: Pt[], closed: boolean, k = 1 / 6): string {
  const n = pts.length;
  if (n < 2) return '';
  const at = (i: number): Pt =>
    closed ? pts[(i + n) % n]! : pts[Math.max(0, Math.min(n - 1, i))]!;
  let d = `M${f(pts[0]!.x)} ${f(pts[0]!.y)}`;
  const segments = closed ? n : n - 1;
  for (let i = 0; i < segments; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = p1.corner ? p1 : { x: p1.x + (p2.x - p0.x) * k, y: p1.y + (p2.y - p0.y) * k };
    const c2 = p2.corner ? p2 : { x: p2.x - (p3.x - p1.x) * k, y: p2.y - (p3.y - p1.y) * k };
    d += ` C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return closed ? `${d} Z` : d;
}

/** Right-side outline (top to bottom) + its mirror image back up the left side. */
export function mirrored(right: Pt[]): Pt[] {
  const left = [...right].reverse().map((p) => ({ ...p, x: -p.x }));
  return [...right, ...left];
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Linear interpolation of x along a top-to-bottom list of points. */
export function xAt(points: Pt[], y: number): number {
  if (y <= points[0]!.y) return points[0]!.x;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (y <= b.y) return lerp(a.x, b.x, (y - a.y) / (b.y - a.y || 1));
  }
  return points[points.length - 1]!.x;
}

/**
 * Circumference -> half the front-view width. A torso cross-section is roughly an
 * ellipse, deeper at the waist than at the chest, so each zone has its own factor:
 * C ≈ π(width + depth)/2, with depth/width ≈ 0.72 chest, 0.8 waist, 0.75 hips.
 */
export const halfWidth = {
  chest: (c: number) => c / 5.4,
  waist: (c: number) => c / 5.65,
  hips: (c: number) => c / 5.5,
};

// ---------- body ----------

export interface Limb {
  top: Pt;
  bottom: Pt;
  halfTop: number;
  halfBottom: number;
}

export interface BodyGeometry {
  height: number;
  y: {
    chin: number;
    neckBase: number;
    /** High point of shoulder, where top lengths are measured from. */
    hps: number;
    shoulder: number;
    armpit: number;
    chest: number;
    waist: number;
    hip: number;
    crotch: number;
    knee: number;
    ankle: number;
    floor: number;
  };
  half: { neck: number; shoulder: number; chest: number; waist: number; hip: number };
  head: { cx: number; cy: number; rx: number; ry: number };
  /** Right arm (mirror for the left), with the elbow's distance down it. */
  arm: Limb & { elbowCm: number };
  /** Right leg: centre line and half-width at the thigh, knee, calf and ankle (mirror for the left). */
  leg: {
    thighY: number;
    thighX: number;
    thighHalf: number;
    kneeX: number;
    kneeHalf: number;
    calfY: number;
    calfHalf: number;
    ankleX: number;
    ankleHalf: number;
  };
  /** Right-side torso outline, top to bottom, for width lookups. */
  outline: Pt[];
  paths: { torso: string; arms: [string, string]; feet: { cx: number; cy: number; rx: number; ry: number }[] };
}

export function bodyGeometry(m: BodyMeasurements): BodyGeometry {
  const H = m.heightCm;
  const s = H / 176; // general scale vs. the reference body
  const girthScale = m.hipsCm / 103;

  const half = {
    neck: 6 * Math.sqrt(m.chestCm / 104),
    shoulder: m.shoulderWidthCm / 2,
    chest: halfWidth.chest(m.chestCm),
    waist: halfWidth.waist(m.waistCm),
    hip: halfWidth.hips(m.hipsCm),
  };
  // Shoulders never narrower than the chest beneath them.
  half.shoulder = Math.max(half.shoulder, half.chest + 1.5);

  const hip = 0.49 * H;
  const knee = 0.72 * H;
  const y = {
    chin: 0.125 * H,
    neckBase: 0.155 * H,
    hps: 0.165 * H,
    shoulder: 0.19 * H,
    armpit: 0.235 * H,
    chest: 0.27 * H,
    waist: 0.385 * H,
    hip,
    // Entered inseams can be anything plausible; keep the crotch between hip and knee.
    crotch: Math.min(Math.max(H - m.inseamCm, hip + 3), knee - 12),
    knee,
    ankle: 0.955 * H,
    floor: H,
  };

  const head = { cx: 0, cy: 0.064 * H, rx: 7.6 * s, ry: 0.064 * H };

  // Legs taper from a full thigh to the knee, swell a little at the calf and
  // narrow to the ankle, standing slightly apart so each leg reads on its own.
  const kneeHalf = Math.max(4.6, 5.6 * girthScale ** 0.9 * s);
  const leg = {
    thighY: y.crotch + 5,
    thighX: half.hip * 0.5 + 0.2,
    thighHalf: half.hip * 0.5 - 0.6,
    kneeX: half.hip * 0.42 + 0.9,
    kneeHalf,
    calfY: lerp(y.knee, y.ankle, 0.3),
    calfHalf: kneeHalf * 1.04,
    ankleX: half.hip * 0.38 + 1.4,
    ankleHalf: 3.1 * s,
  };
  const calfX = lerp(leg.kneeX, leg.ankleX, 0.3);

  // A simple dress-form torso: sloping shoulders, chest, an in-curve to the
  // waist and out again over the hips. Extra points keep the curves soft.
  const outline: Pt[] = [
    { x: half.neck, y: y.chin + 1 },
    { x: half.neck, y: y.neckBase },
    { x: lerp(half.neck, half.shoulder, 0.55), y: lerp(y.neckBase, y.shoulder, 0.7) },
    { x: half.shoulder - 1.5, y: y.shoulder },
    { x: half.chest + 0.8, y: y.armpit },
    { x: half.chest, y: y.chest },
    { x: lerp(half.chest, half.waist, 0.65), y: lerp(y.chest, y.waist, 0.5) },
    { x: half.waist, y: y.waist },
    { x: lerp(half.waist, half.hip, 0.75), y: lerp(y.waist, y.hip, 0.5) },
    { x: half.hip, y: y.hip },
    { x: half.hip * 0.97, y: y.crotch },
  ];

  // Torso + legs as one silhouette: down the right side and right leg, up the
  // inside of the right leg, down the inside of the left, up the left side.
  const right: Pt[] = [
    ...outline.slice(0, -1),
    { x: leg.thighX + leg.thighHalf, y: leg.thighY },
    { x: leg.kneeX + leg.kneeHalf, y: y.knee },
    { x: calfX + leg.calfHalf, y: leg.calfY },
    { x: leg.ankleX + leg.ankleHalf, y: y.ankle, corner: true },
    { x: leg.ankleX - leg.ankleHalf, y: y.ankle, corner: true },
    { x: calfX - leg.calfHalf * 0.9, y: leg.calfY },
    { x: leg.kneeX - leg.kneeHalf, y: y.knee },
    { x: leg.thighX - leg.thighHalf, y: leg.thighY },
    { x: 0, y: y.crotch + 1.5, corner: true },
  ];
  const torsoPts = mirrored(right).filter((p, i, all) => !(i > 0 && p.x === 0 && all[i - 1]!.x === 0));
  // The neck top is a straight edge (the head covers it).
  torsoPts[0] = { ...torsoPts[0]!, corner: true };
  torsoPts[torsoPts.length - 1] = { ...torsoPts[torsoPts.length - 1]!, corner: true };

  const armTop: Pt = { x: half.shoulder - 4.2, y: y.shoulder + 3 };
  // Arms hang a little away from the waist so the torso's shape shows.
  const wristX = Math.max(half.hip, half.waist) + 6;
  const armBottom = { x: wristX, y: armTop.y + m.armLengthCm * 0.97 };
  const arm = {
    top: armTop,
    bottom: armBottom,
    halfTop: 5.2 * Math.sqrt(m.chestCm / 104),
    halfBottom: 2.8 * s,
    // The upper arm is a little over half of shoulder-to-wrist.
    elbowCm: 0.53 * Math.hypot(armBottom.x - armTop.x, armBottom.y - armTop.y),
  };

  return {
    height: H,
    y,
    half,
    head,
    arm,
    leg,
    outline,
    paths: {
      torso: smoothPath(torsoPts, true),
      arms: [limbPath(arm, 0, 1.1, 0, 0), mirrorPath(limbPath(arm, 0, 1.1, 0, 0))],
      feet: [1, -1].map((side) => ({
        cx: side * (leg.ankleX + 1.5),
        cy: y.ankle + 2.2 * s,
        rx: 5 * s,
        ry: 2.6 * s,
      })),
    },
  };
}

/** Body half-width at height y (torso, then hips, then the outside of the legs). */
export function bodyHalfAt(g: BodyGeometry, y: number): number {
  if (y <= g.y.crotch) return xAt(g.outline, y);
  return xAt(
    [
      { x: g.half.hip * 0.97, y: g.y.crotch },
      { x: g.leg.thighX + g.leg.thighHalf, y: g.leg.thighY },
      { x: g.leg.kneeX + g.leg.kneeHalf, y: g.y.knee },
      { x: lerp(g.leg.kneeX, g.leg.ankleX, 0.3) + g.leg.calfHalf, y: g.leg.calfY },
      { x: g.leg.ankleX + g.leg.ankleHalf, y: g.y.ankle },
    ],
    y,
  );
}

// ---------- limbs ----------

export function limbPoint(l: Limb, t: number): Pt {
  return { x: lerp(l.top.x, l.bottom.x, t), y: lerp(l.top.y, l.bottom.y, t) };
}

export const limbHalf = (l: Limb, t: number) => lerp(l.halfTop, l.halfBottom, Math.min(t, 1));

/** A limb's length, its unit direction (top to bottom) and its outward normal. */
export function limbFrame(l: Limb): { len: number; dir: Pt; normal: Pt } {
  const dx = l.bottom.x - l.top.x;
  const dy = l.bottom.y - l.top.y;
  const len = Math.hypot(dx, dy) || 1;
  return { len, dir: { x: dx / len, y: dy / len }, normal: { x: dy / len, y: -dx / len } };
}

/**
 * Outline of a limb segment from t0 to t1 (0 = shoulder, 1 = wrist), widened by
 * `padTop` / `padEnd` cm — sleeves are the arm plus a little room.
 */
export function limbPath(l: Limb, t0: number, t1: number, padTop: number, padEnd: number): string {
  const { normal } = limbFrame(l);
  const nx = normal.x; // pointing outwards/right
  const ny = normal.y;
  const at = (t: number, side: 1 | -1, pad: number, corner = false): Pt => {
    const p = limbPoint(l, t);
    const w = limbHalf(l, t) + pad;
    return { x: p.x + side * nx * w, y: p.y + side * ny * w, corner };
  };
  const mid = (t0 + t1) / 2;
  const padMid = (padTop + padEnd) / 2;
  const pts: Pt[] = [
    at(t0, 1, padTop),
    at(mid, 1, padMid),
    at(t1, 1, padEnd, true),
    at(t1, -1, padEnd, true),
    at(mid, -1, padMid),
    at(t0, -1, padTop),
  ];
  return smoothPath(pts, true);
}

/** Mirror SVG path data across x = 0 (numbers after M/C come in x y pairs). */
export function mirrorPath(d: string): string {
  let isX = true;
  return d.replace(/-?\d+(\.\d+)?/g, (num) => {
    const out = isX ? f(-Number(num)) : num;
    isX = !isX;
    return out;
  });
}

// ---------- garments ----------

export interface Marker {
  x: number;
  y: number;
}

export interface BottomShape {
  body: string;
  markers: Partial<Record<'waist' | 'hips' | 'inseam', Marker>>;
  /** The hem would reach past the floor — drawn bunched at the ankle. */
  pooled: boolean;
  approximate: boolean;
}

/** Half the leg opening, by cut. */
const HEM_HALF: Record<GarmentType, number> = {
  jeans: 9.5,
  chinos: 9,
  joggers: 6.5,
  trousers: 12.5,
  tee: 9,
  'long-sleeve-tee': 9,
  polo: 9,
  'button-up': 9,
};

export function bottomShape(g: BodyGeometry, garment: Garment, size: SizeMeasurements): BottomShape {
  const approximate = !garment.girthVerified;
  // Pants sit a little below the natural waist.
  const bandY = lerp(g.y.waist, g.y.hip, 0.25);
  const bandHalf = Math.max(
    approximate || size.waist === undefined ? 0 : halfWidth.waist(size.waist),
    bodyHalfAt(g, bandY) + 0.5,
  );
  const hipHalf = Math.max(
    approximate || size.hips === undefined ? 0 : halfWidth.hips(size.hips),
    g.half.hip + 0.6,
  );
  const crotchY = g.y.crotch + 2;
  const inseam = size.inseam ?? g.y.floor - crotchY;
  const rawHem = crotchY + inseam;
  const pooled = rawHem > g.y.floor - 0.5;
  const hemY = Math.min(rawHem, g.y.floor - 0.5);
  const hemHalf = Math.max(HEM_HALF[garment.type] + (pooled ? 1.2 : 0), g.leg.ankleHalf + 1.5);
  const kneeHalf = Math.max((hipHalf / 2 + hemHalf) / 2, g.leg.kneeHalf + 1);

  const t = Math.min(1, Math.max(0, (hemY - g.y.knee) / (g.y.ankle - g.y.knee)));
  const hemX = hemY > g.y.knee ? lerp(g.leg.kneeX, g.leg.ankleX, t) : g.leg.kneeX;

  const right: Pt[] = [
    { x: bandHalf, y: bandY, corner: true },
    { x: hipHalf, y: g.y.hip },
    { x: hipHalf - 0.4, y: crotchY + 3 },
  ];
  if (hemY > g.y.knee + 4) right.push({ x: g.leg.kneeX + kneeHalf, y: g.y.knee });
  right.push(
    { x: hemX + hemHalf, y: hemY, corner: true },
    { x: hemX - hemHalf, y: hemY, corner: true },
  );
  if (hemY > g.y.knee + 4) right.push({ x: Math.max(0.6, g.leg.kneeX - kneeHalf), y: g.y.knee });
  right.push({ x: 0, y: crotchY, corner: true });

  const left = [...right].reverse().map((p) => ({ ...p, x: -p.x })).slice(1); // skip duplicate crotch point
  return {
    body: smoothPath([...right, ...left], true),
    markers: {
      waist: { x: bandHalf, y: bandY },
      hips: { x: hipHalf, y: g.y.hip },
      inseam: { x: hemX + hemHalf, y: hemY },
    },
    pooled,
    approximate,
  };
}
