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

import type { PantsLandmarkName, TopLandmarkName } from '@choudo/core/domain/garments';
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

export type WarpRegion = 'body' | 'sleeveLeft' | 'sleeveRight' | 'legLeft' | 'legRight';

export interface WarpPiece {
  region: WarpRegion;
  /** The triangle's corners: landmark names, centre points (`shoulderMid`) or sleeve points (`sleeveO2Right`). */
  corners: [string, string, string];
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

/**
 * Corner names: the landmarks, centre points halfway between a left/right pair,
 * and points along each sleeve (`sleeveO2Right`: the outer edge, 2 strips down).
 */
type Corner = TopLandmarkName | 'shoulderMid' | 'armpitMid' | 'hemMid' | `sleeve${'O' | 'I'}${number}${'Left' | 'Right'}`;

/**
 * Each sleeve is cut into this many strips along its length, two triangles each.
 * One quad of two triangles shears the photo's sleeve into chevrons wherever the
 * sleeve's two ends differ in shape (always, on a long sleeve); strips that
 * follow the drawn sleeve's edges keep bands across the sleeve straight.
 */
export const SLEEVE_STRIPS = 4;
/**
 * Strips need a real inner sleeve edge in the photo (armpit to inner corner),
 * as a garment laid flat has. On a worn tee photographed with the arms down
 * that edge is a few pixels, so strips would be slivers; such a sleeve stays
 * one quad. Minimum inner edge, as a fraction of the outer edge.
 */
const MIN_INNER_EDGE = 0.3;

/**
 * A drawn sleeve's two edges, from its root to its opening, SLEEVE_STRIPS + 1
 * points each: outer from the shoulder seam to the outer corner, inner from the
 * armpit to the inner corner.
 */
export interface SleeveEdges {
  outer: XY[];
  inner: XY[];
}

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
/** Name of the k-th point along a sleeve edge; the ends are the landmarks themselves. */
function sleevePoint(edge: 'O' | 'I', k: number, side: 'Left' | 'Right'): Corner {
  if (k === 0) return edge === 'O' ? `shoulder${side}` : `armpit${side}`;
  if (k === SLEEVE_STRIPS) return edge === 'O' ? `sleeveOuter${side}` : `sleeveInner${side}`;
  return `sleeve${edge}${k}${side}`;
}

/** One sleeve in `strips` strips (1 or SLEEVE_STRIPS) from the root (shoulder seam to armpit) out to the opening. */
function sleeveTriangles(strips: number, side: 'Left' | 'Right'): [Corner, Corner, Corner][] {
  const step = SLEEVE_STRIPS / strips;
  return Array.from({ length: strips }, (_, k) => {
    const [o0, o1] = [sleevePoint('O', k * step, side), sleevePoint('O', (k + 1) * step, side)];
    const [i0, i1] = [sleevePoint('I', k * step, side), sleevePoint('I', (k + 1) * step, side)];
    return [
      [o0, o1, i1],
      [o0, i1, i0],
    ] as [Corner, Corner, Corner][];
  }).flat();
}

/** How many strips a photo's sleeve on this side gets: see MIN_INNER_EDGE. */
export function sleeveStrips(photo: Record<TopLandmarkName, XY>, side: 'Left' | 'Right'): number {
  const dist = (p: XY, q: XY) => Math.hypot(p.x - q.x, p.y - q.y);
  const outer = dist(photo[`shoulder${side}`], photo[`sleeveOuter${side}`]);
  const inner = dist(photo[`armpit${side}`], photo[`sleeveInner${side}`]);
  return inner >= outer * MIN_INNER_EDGE ? SLEEVE_STRIPS : 1;
}

const toLeft = (c: Corner): Corner => (c.endsWith('Right') ? (c.replace(/Right$/, 'Left') as Corner) : c);

const mid = (p: XY, q: XY): XY => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

const lerpXY = (p: XY, q: XY, t: number): XY => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });

type Points = Partial<Record<Corner, XY>>;

function withMids(points: Record<TopLandmarkName, XY>): Points {
  return {
    ...points,
    shoulderMid: mid(points.shoulderLeft, points.shoulderRight),
    armpitMid: mid(points.armpitLeft, points.armpitRight),
    hemMid: mid(points.hemLeft, points.hemRight),
  };
}

/** Points along each sleeve of a flat photo: its edges are straight, so evenly along them. */
function photoSleeves(points: Record<TopLandmarkName, XY>): Points {
  const out: Points = {};
  for (const side of ['Left', 'Right'] as const) {
    for (let k = 1; k < SLEEVE_STRIPS; k++) {
      const t = k / SLEEVE_STRIPS;
      out[sleevePoint('O', k, side)] = lerpXY(points[`shoulder${side}`], points[`sleeveOuter${side}`], t);
      out[sleevePoint('I', k, side)] = lerpXY(points[`armpit${side}`], points[`sleeveInner${side}`], t);
    }
  }
  return out;
}

/** Points along one drawn sleeve, from its edges. */
function drawnSleeve(edges: SleeveEdges, side: 'Left' | 'Right'): Points {
  const out: Points = {};
  for (let k = 0; k <= SLEEVE_STRIPS; k++) {
    out[sleevePoint('O', k, side)] = edges.outer[k];
    out[sleevePoint('I', k, side)] = edges.inner[k];
  }
  return out;
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

const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Clip outlines for one region's triangles. Edges used by only one triangle are
 * on the outside; their corners are pushed out along the averaged outward
 * normal, so neighbouring pieces stretch out side by side without gaps.
 */
function regionClips<C extends string>(tris: [C, C, C][], dst: Partial<Record<C, XY>>): XY[][] {
  const uses = new Map<string, number>();
  for (const t of tris) for (let i = 0; i < 3; i++) {
    const k = edgeKey(t[i]!, t[(i + 1) % 3]!);
    uses.set(k, (uses.get(k) ?? 0) + 1);
  }
  const isOuter = (a: C, b: C) => uses.get(edgeKey(a, b)) === 1;

  // Sum each outer corner's outward edge normals.
  const normals = new Map<C, XY>();
  for (const t of tris) for (let i = 0; i < 3; i++) {
    const [a, b, c] = [t[i]!, t[(i + 1) % 3]!, t[(i + 2) % 3]!];
    if (!isOuter(a, b)) continue;
    const [p, q, r] = [dst[a]!, dst[b]!, dst[c]!];
    let n = { x: q.y - p.y, y: p.x - q.x };
    if (n.x * (r.x - p.x) + n.y * (r.y - p.y) > 0) n = { x: -n.x, y: -n.y }; // away from the third corner
    const len = Math.hypot(n.x, n.y) || 1;
    for (const v of [a, b]) {
      const sum = normals.get(v) ?? { x: 0, y: 0 };
      normals.set(v, { x: sum.x + n.x / len, y: sum.y + n.y / len });
    }
  }
  const pushed = (v: C): XY => {
    const n = normals.get(v)!;
    const len = Math.hypot(n.x, n.y) || 1;
    return { x: dst[v]!.x + (n.x / len) * OUTER_REACH_CM, y: dst[v]!.y + (n.y / len) * OUTER_REACH_CM };
  };

  return tris.map((t) => {
    const tri = t.map((n) => dst[n]!) as [XY, XY, XY];
    const outline: XY[] = [];
    for (let i = 0; i < 3; i++) {
      const [a, b] = [t[i]!, t[(i + 1) % 3]!];
      outline.push(dst[a]!);
      if (isOuter(a, b)) outline.push(pushed(a), pushed(b));
    }
    return grow(outline, tri, SEAM_OVERLAP_CM);
  });
}

/**
 * Every triangle of the warp, photo landmarks (px) -> shape points (cm).
 * The sleeves follow the drawn sleeve's own edges (`sleeves`), which start at
 * the shoulder seam and the sleeve's own armpit corner rather than the body's.
 */
export function warpPieces(
  photo: Record<TopLandmarkName, XY>,
  shape: Record<TopLandmarkName, Pt>,
  sleeves: { left: SleeveEdges; right: SleeveEdges },
): WarpPiece[] {
  const src = { ...withMids(photo), ...photoSleeves(photo) };
  const bodyDst = withMids(shape);
  const sleeveDst = (side: 'Left' | 'Right'): Points => ({
    ...bodyDst,
    ...drawnSleeve(side === 'Left' ? sleeves.left : sleeves.right, side),
  });

  const sets: { region: WarpRegion; tris: [Corner, Corner, Corner][]; dst: Points }[] = [
    { region: 'body', tris: [...BODY_RIGHT, ...BODY_RIGHT.map((t) => t.map(toLeft) as typeof t)], dst: bodyDst },
    { region: 'sleeveRight', tris: sleeveTriangles(sleeveStrips(photo, 'Right'), 'Right'), dst: sleeveDst('Right') },
    { region: 'sleeveLeft', tris: sleeveTriangles(sleeveStrips(photo, 'Left'), 'Left'), dst: sleeveDst('Left') },
  ];

  const pieces: WarpPiece[] = [];
  for (const { region, tris, dst } of sets) {
    const clips = regionClips(tris, dst);
    tris.forEach((names, i) => {
      const from = names.map((n) => src[n]!) as [XY, XY, XY];
      const to = names.map((n) => ({ x: dst[n]!.x, y: dst[n]!.y })) as [XY, XY, XY];
      const transform = triangleAffine(from, to);
      if (transform) pieces.push({ region, corners: names, transform, clip: clips[i]! });
    });
  }
  return pieces;
}

/**
 * Pieces whose photo triangle and drawn triangle wind opposite ways, so the
 * photo shows mirrored there: the landmarks disagree with the drawn shape about
 * which point is above or beside which.
 */
export const foldedPieces = (pieces: WarpPiece[]) =>
  pieces.filter((p) => p.transform.a * p.transform.d - p.transform.b * p.transform.c <= 0);

// ---------- pants ----------

/**
 * Pants corner names: the landmarks, and points along each leg's edges
 * (`legO1Right`: the outer edge, one strip down from the hip). A leg's outer edge
 * runs hip → knee → hem, its inner edge crotch → knee → hem; the knee is always
 * the middle point, so the photo's knee lands on the drawn knee.
 */
type PantsCorner = PantsLandmarkName | `leg${'O' | 'I'}${number}${'Left' | 'Right'}`;

/** The top half of a pair of pants (band to crotch), right side; the left mirrors it. */
const PANTS_BODY_RIGHT: [PantsCorner, PantsCorner, PantsCorner][] = [
  ['waistMid', 'waistRight', 'hipRight'],
  ['waistMid', 'hipRight', 'crotch'],
];

function legPoint(edge: 'O' | 'I', k: number, side: 'Left' | 'Right'): PantsCorner {
  const half = SLEEVE_STRIPS / 2;
  if (k === 0) return edge === 'O' ? `hip${side}` : 'crotch';
  if (k === half) return edge === 'O' ? `kneeOuter${side}` : `kneeInner${side}`;
  if (k === SLEEVE_STRIPS) return edge === 'O' ? `hemOuter${side}` : `hemInner${side}`;
  return `leg${edge}${k}${side}`;
}

/** A leg in SLEEVE_STRIPS strips, hip/crotch down to the hem, two triangles each (as a sleeve). */
function legTriangles(side: 'Left' | 'Right'): [PantsCorner, PantsCorner, PantsCorner][] {
  return Array.from({ length: SLEEVE_STRIPS }, (_, k) => {
    const [o0, o1, i0, i1] = [legPoint('O', k, side), legPoint('O', k + 1, side), legPoint('I', k, side), legPoint('I', k + 1, side)];
    return [
      [o0, o1, i1],
      [o0, i1, i0],
    ] as [PantsCorner, PantsCorner, PantsCorner][];
  }).flat();
}

/** Points along a flat photo's legs: straight from hip (or crotch) to knee, and knee to hem. */
function photoLegs(p: Record<PantsLandmarkName, XY>): Partial<Record<PantsCorner, XY>> {
  const out: Partial<Record<PantsCorner, XY>> = {};
  const half = SLEEVE_STRIPS / 2;
  for (const side of ['Left', 'Right'] as const) {
    for (const [edge, top, knee, hem] of [
      ['O', p[`hip${side}`], p[`kneeOuter${side}`], p[`hemOuter${side}`]],
      ['I', p.crotch, p[`kneeInner${side}`], p[`hemInner${side}`]],
    ] as const) {
      for (let k = 1; k < SLEEVE_STRIPS; k++) {
        if (k === half) continue;
        out[legPoint(edge, k, side)] = k < half ? lerpXY(top, knee, k / half) : lerpXY(knee, hem, (k - half) / half);
      }
    }
  }
  return out;
}

/** Points along one drawn leg, from its edges (SLEEVE_STRIPS + 1 points each). */
function drawnLeg(edges: SleeveEdges, side: 'Left' | 'Right'): Partial<Record<PantsCorner, XY>> {
  const out: Partial<Record<PantsCorner, XY>> = {};
  for (let k = 0; k <= SLEEVE_STRIPS; k++) {
    out[legPoint('O', k, side)] = edges.outer[k];
    out[legPoint('I', k, side)] = edges.inner[k];
  }
  return out;
}

const toLeftPants = (c: PantsCorner): PantsCorner => (c.endsWith('Right') ? (c.replace(/Right$/, 'Left') as PantsCorner) : c);

/**
 * Every triangle of a pants warp, photo landmarks (px) -> drawn points (cm): the
 * top (band to crotch) as two fans mirrored about the centre line, and each leg
 * in strips that follow the drawn leg's own edges, the same way a long sleeve does.
 */
export function warpPantsPieces(
  photo: Record<PantsLandmarkName, XY>,
  drawn: Record<PantsLandmarkName, Pt>,
  legs: { left: SleeveEdges; right: SleeveEdges },
): WarpPiece[] {
  const src: Partial<Record<PantsCorner, XY>> = { ...photo, ...photoLegs(photo) };
  const bodyDst: Partial<Record<PantsCorner, XY>> = { ...drawn };
  const sets: { region: WarpRegion; tris: [PantsCorner, PantsCorner, PantsCorner][]; dst: Partial<Record<PantsCorner, XY>> }[] = [
    { region: 'body', tris: [...PANTS_BODY_RIGHT, ...PANTS_BODY_RIGHT.map((t) => t.map(toLeftPants) as typeof t)], dst: bodyDst },
    { region: 'legRight', tris: legTriangles('Right'), dst: { ...bodyDst, ...drawnLeg(legs.right, 'Right') } },
    { region: 'legLeft', tris: legTriangles('Left'), dst: { ...bodyDst, ...drawnLeg(legs.left, 'Left') } },
  ];
  const pieces: WarpPiece[] = [];
  for (const { region, tris, dst } of sets) {
    const clips = regionClips(tris, dst);
    tris.forEach((names, i) => {
      const from = names.map((n) => src[n]!) as [XY, XY, XY];
      const to = names.map((n) => ({ x: dst[n]!.x, y: dst[n]!.y })) as [XY, XY, XY];
      const transform = triangleAffine(from, to);
      if (transform) pieces.push({ region, corners: names, transform, clip: clips[i]! });
    });
  }
  return pieces;
}
