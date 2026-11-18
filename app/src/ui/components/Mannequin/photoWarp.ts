/**
 * Warping a product photo onto a drawn top: a piecewise-affine (triangle) warp.
 *
 * The photo's landmarks (pixels) and the drawn shape's matching points (cm) are
 * split into the same triangles. Each triangle gets its own affine map, which
 * lands the photo's three corners exactly on the shape's three corners, so the
 * pieces meet edge to edge. The renderer draws the photo once per triangle with
 * that map and clips it to the triangle, then to the garment outline.
 *
 * Pure functions, no React.
 */

import type { TopLandmarkName } from '../../../domain/garments';
import type { Pt } from './geometry';

export interface XY {
  x: number;
  y: number;
}

/** An SVG `matrix(a b c d e f)`: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export type WarpRegion = 'body' | 'sleeveLeft' | 'sleeveRight';

export interface WarpPiece {
  region: WarpRegion;
  /** Maps photo pixels to mannequin cm. */
  transform: Affine;
  /**
   * Where this piece shows, in mannequin cm: its triangle, grown a hair so
   * neighbours overlap instead of leaving a hairline, and stretched outward past
   * any edge on the outside of the landmark outline. The drawn garment outline
   * never matches the landmark outline exactly, so the outer pieces reach beyond
   * it and the garment's own outline clips them.
   */
  clip: XY[];
}

/** Degenerate photo triangles (area under this, px²) are skipped: they'd need an infinite stretch. */
const MIN_AREA_PX = 1;
/** How far each clip triangle is grown, in cm, to hide anti-aliased seams between pieces. */
const SEAM_OVERLAP_CM = 0.12;
/** How far outer pieces reach past the landmark outline, in cm. */
const OUTER_REACH_CM = 6;

/** The affine map taking triangle `from` onto triangle `to`, vertex for vertex. Null if `from` is degenerate. */
export function triangleAffine(from: [XY, XY, XY], to: [XY, XY, XY]): Affine | null {
  const [p0, p1, p2] = from;
  const [q0, q1, q2] = to;
  // Edge vectors from the first corner; solve [a c; b d]·[u v] = [U V].
  const ux = p1.x - p0.x, uy = p1.y - p0.y;
  const vx = p2.x - p0.x, vy = p2.y - p0.y;
  const det = ux * vy - vx * uy;
  if (Math.abs(det) / 2 < MIN_AREA_PX) return null;
  const Ux = q1.x - q0.x, Uy = q1.y - q0.y;
  const Vx = q2.x - q0.x, Vy = q2.y - q0.y;
  const a = (Ux * vy - Vx * uy) / det;
  const c = (Vx * ux - Ux * vx) / det;
  const b = (Uy * vy - Vy * uy) / det;
  const d = (Vy * ux - Uy * vx) / det;
  return { a, b, c, d, e: q0.x - a * p0.x - c * p0.y, f: q0.y - b * p0.x - d * p0.y };
}

export function applyAffine(m: Affine, p: XY): XY {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
}

export const affineToSvg = (m: Affine) => `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`;

/** Corner names, plus centre points halfway between a left/right pair. */
type Corner = TopLandmarkName | 'shoulderMid' | 'armpitMid' | 'hemMid';

/**
 * Right half of the shirt body, fanned from the centre line so the left half can
 * be its mirror image and the texture stays symmetric.
 */
const BODY_RIGHT: [Corner, Corner, Corner][] = [
  ['neckFront', 'collarRight', 'shoulderRight'],
  ['neckFront', 'shoulderRight', 'shoulderMid'],
  ['shoulderMid', 'shoulderRight', 'armpitRight'],
  ['shoulderMid', 'armpitRight', 'armpitMid'],
  ['armpitMid', 'armpitRight', 'hemRight'],
  ['armpitMid', 'hemRight', 'hemMid'],
];
/** The right sleeve, from the shoulder seam to its opening and back up to the armpit. */
const SLEEVE_RIGHT: [Corner, Corner, Corner][] = [
  ['shoulderRight', 'sleeveOuterRight', 'sleeveInnerRight'],
  ['shoulderRight', 'sleeveInnerRight', 'armpitRight'],
];

const toLeft = (c: Corner): Corner => (c.endsWith('Right') ? (c.replace(/Right$/, 'Left') as Corner) : c);

const mid = (p: XY, q: XY): XY => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

function withMids(points: Record<TopLandmarkName, XY>): Record<Corner, XY> {
  return {
    ...points,
    shoulderMid: mid(points.shoulderLeft, points.shoulderRight),
    armpitMid: mid(points.armpitLeft, points.armpitRight),
    hemMid: mid(points.hemLeft, points.hemRight),
  };
}

/** Push each point away from the triangle's centroid by `by`. */
function grow(points: XY[], tri: [XY, XY, XY], by: number): XY[] {
  const cx = (tri[0].x + tri[1].x + tri[2].x) / 3;
  const cy = (tri[0].y + tri[1].y + tri[2].y) / 3;
  return points.map((p) => {
    const len = Math.hypot(p.x - cx, p.y - cy) || 1;
    return { x: p.x + ((p.x - cx) / len) * by, y: p.y + ((p.y - cy) / len) * by };
  });
}

const edgeKey = (a: Corner, b: Corner) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Clip outlines for one region's triangles. Edges used by only one triangle are
 * on the outside; their corners are pushed out along the averaged outward
 * normal, so neighbouring pieces stretch out side by side without gaps.
 */
function regionClips(tris: [Corner, Corner, Corner][], dst: Record<Corner, XY>): XY[][] {
  const uses = new Map<string, number>();
  for (const t of tris) for (let i = 0; i < 3; i++) {
    const k = edgeKey(t[i]!, t[(i + 1) % 3]!);
    uses.set(k, (uses.get(k) ?? 0) + 1);
  }
  const isOuter = (a: Corner, b: Corner) => uses.get(edgeKey(a, b)) === 1;

  // Sum each outer corner's outward edge normals.
  const normals = new Map<Corner, XY>();
  for (const t of tris) for (let i = 0; i < 3; i++) {
    const [a, b, c] = [t[i]!, t[(i + 1) % 3]!, t[(i + 2) % 3]!];
    if (!isOuter(a, b)) continue;
    const [p, q, r] = [dst[a], dst[b], dst[c]];
    let n = { x: q.y - p.y, y: p.x - q.x };
    if (n.x * (r.x - p.x) + n.y * (r.y - p.y) > 0) n = { x: -n.x, y: -n.y }; // away from the third corner
    const len = Math.hypot(n.x, n.y) || 1;
    for (const v of [a, b]) {
      const sum = normals.get(v) ?? { x: 0, y: 0 };
      normals.set(v, { x: sum.x + n.x / len, y: sum.y + n.y / len });
    }
  }
  const pushed = (v: Corner): XY => {
    const n = normals.get(v)!;
    const len = Math.hypot(n.x, n.y) || 1;
    return { x: dst[v].x + (n.x / len) * OUTER_REACH_CM, y: dst[v].y + (n.y / len) * OUTER_REACH_CM };
  };

  return tris.map((t) => {
    const tri = t.map((n) => dst[n]) as [XY, XY, XY];
    const outline: XY[] = [];
    for (let i = 0; i < 3; i++) {
      const [a, b] = [t[i]!, t[(i + 1) % 3]!];
      outline.push(dst[a]);
      if (isOuter(a, b)) outline.push(pushed(a), pushed(b));
    }
    return grow(outline, tri, SEAM_OVERLAP_CM);
  });
}

/**
 * Every triangle of the warp, photo landmarks (px) -> shape points (cm).
 * The sleeves use the sleeve's own armpit corner rather than the shirt body's.
 */
export function warpPieces(
  photo: Record<TopLandmarkName, XY>,
  shape: Record<TopLandmarkName, Pt>,
  sleeveArmpits: { left: XY; right: XY },
): WarpPiece[] {
  const src = withMids(photo);
  const bodyDst = withMids(shape);
  const sleeveDst = (side: 'Left' | 'Right'): Record<Corner, XY> => ({
    ...bodyDst,
    [`armpit${side}`]: side === 'Left' ? sleeveArmpits.left : sleeveArmpits.right,
  });

  const sets: { region: WarpRegion; tris: [Corner, Corner, Corner][]; dst: Record<Corner, XY> }[] = [
    { region: 'body', tris: [...BODY_RIGHT, ...BODY_RIGHT.map((t) => t.map(toLeft) as typeof t)], dst: bodyDst },
    { region: 'sleeveRight', tris: SLEEVE_RIGHT, dst: sleeveDst('Right') },
    { region: 'sleeveLeft', tris: SLEEVE_RIGHT.map((t) => t.map(toLeft) as typeof t), dst: sleeveDst('Left') },
  ];

  const pieces: WarpPiece[] = [];
  for (const { region, tris, dst } of sets) {
    const clips = regionClips(tris, dst);
    tris.forEach((names, i) => {
      const from = names.map((n) => src[n]) as [XY, XY, XY];
      const to = names.map((n) => ({ x: dst[n].x, y: dst[n].y })) as [XY, XY, XY];
      const transform = triangleAffine(from, to);
      if (transform) pieces.push({ region, transform, clip: clips[i]! });
    });
  }
  return pieces;
}
