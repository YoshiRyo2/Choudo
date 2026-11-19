/**
 * First guesses for a top's 13 photo landmarks, read off the cut-out's
 * silhouette, so placing them is mostly nudging.
 *
 * The garment is assumed upright (collar at the top), laid flat, front up.
 * Pure: a binary mask in, points (px) out. Steps:
 *  - Trace the outline, in order, round the garment.
 *  - Centre line and torso width from a band just above the hem.
 *  - Hem corners: the outline points furthest down-and-out near each side of the torso.
 *  - Armpits: the outline's convex hull bridges the notch under each sleeve;
 *    the outline point deepest inside that bridge is the armpit.
 *  - Shoulders: the top edge straight above each armpit.
 *  - Collar points: the highest top-edge points either side of the neck dip.
 *    neckFront is the one real guess: the silhouette shows the back of the neck,
 *    not the front neckline, so it sits a typical crew-neck depth below.
 *  - Sleeve openings: on the stretch of outline from shoulder round the sleeve
 *    to the armpit, the two points that make the biggest quadrilateral
 *    shoulder -> outer -> inner -> armpit. That fits short sleeves cut square or
 *    slanted, and long sleeves at any angle.
 */

import type { TopLandmarkName } from '../../domain/garments/types';

export interface XY {
  x: number;
  y: number;
}

export type Landmarks = Record<TopLandmarkName, XY>;

/** Front neckline depth below the collar points, as a fraction of the neck opening's width. */
const NECK_DEPTH = 0.45;

/** Alpha (any channel layout) -> 1/0 mask: `channels` bytes per pixel, alpha last. */
export function alphaMask(data: ArrayLike<number>, w: number, h: number, channels = 4): Uint8Array {
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = data[i * channels + channels - 1]! >= 128 ? 1 : 0;
  return mask;
}

/**
 * Shrink the mask by `px` (8-connected steps). `npm run photos` pads each
 * garment with its own colour, so the PNG's opaque area is bigger than the
 * garment; this takes it back to (about) the real outline.
 */
export function insetMask(mask: Uint8Array, w: number, h: number, px: number): Uint8Array {
  if (px <= 0) return mask.slice();
  // Two-pass chessboard distance to the nearest background cell (off-image counts as background).
  const d = new Int32Array(w * h);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]!);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      d[i] = mask[i] ? 1 + Math.min(at(x - 1, y), at(x - 1, y - 1), at(x, y - 1), at(x + 1, y - 1)) : 0;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (mask[i]) d[i] = Math.min(d[i]!, 1 + Math.min(at(x + 1, y), at(x + 1, y + 1), at(x, y + 1), at(x - 1, y + 1)));
    }
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = d[i]! > px ? 1 : 0;
  return out;
}

/** E, SE, S, SW, W, NW, N, NE: clockwise on screen (y points down). */
const DIRS: [number, number][] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

/**
 * The outer outline of the first shape in raster order, as boundary pixels in
 * clockwise order (radial sweep). Empty for an empty mask.
 */
export function traceOutline(mask: Uint8Array, w: number, h: number): XY[] {
  let start = -1;
  for (let i = 0; i < w * h; i++) if (mask[i]) { start = i; break; }
  if (start < 0) return [];
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  const sx = start % w, sy = (start - sx) / w;
  const out: XY[] = [];
  let x = sx, y = sy;
  let back = 4; // we "came from" the west, which is background
  let firstMove = -1;
  for (let steps = 0; steps < 4 * w * h; steps++) {
    let moved = -1;
    for (let k = 1; k <= 8; k++) {
      const d = (back + k) % 8;
      if (on(x + DIRS[d]![0], y + DIRS[d]![1])) { moved = d; break; }
    }
    if (moved < 0) return [{ x, y }]; // a single pixel
    if (x === sx && y === sy) {
      if (firstMove === moved) break; // round once
      if (firstMove < 0) firstMove = moved;
    }
    out.push({ x, y });
    x += DIRS[moved]![0];
    y += DIRS[moved]![1];
    back = (moved + 4) % 8;
  }
  return out;
}

/** Convex hull (Andrew's monotone chain) of the given points, as indexes into `points`. */
export function convexHull(points: XY[]): number[] {
  const idx = points.map((_, i) => i).sort((a, b) => points[a]!.x - points[b]!.x || points[a]!.y - points[b]!.y);
  if (idx.length < 3) return idx;
  const cross = (o: number, a: number, b: number) => {
    const [O, A, B] = [points[o]!, points[a]!, points[b]!];
    return (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
  };
  const chain = (list: number[]) => {
    const out: number[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...chain(idx), ...chain([...idx].reverse())];
}

/** A notch in the outline: the deepest point between two hull points, and how deep (px). */
export interface Defect {
  at: number;
  depth: number;
}

/** Every notch in a closed outline, measured from the hull edge that bridges it. */
export function convexityDefects(outline: XY[]): Defect[] {
  const n = outline.length;
  const hull = convexHull(outline).sort((a, b) => a - b);
  const defects: Defect[] = [];
  for (let h = 0; h < hull.length; h++) {
    const i = hull[h]!;
    const j = hull[(h + 1) % hull.length]!;
    const a = outline[i]!, b = outline[j]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    let best: Defect = { at: -1, depth: 0 };
    for (let k = (i + 1) % n; k !== j; k = (k + 1) % n) {
      const p = outline[k]!;
      const depth = Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / len;
      if (depth > best.depth) best = { at: k, depth };
    }
    if (best.at >= 0) defects.push(best);
  }
  return defects;
}

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s[s.length >> 1]!;
};

/** Suggested landmarks, or null when the mask doesn't look like a top. */
export function suggestLandmarks(mask: Uint8Array, w: number, h: number): Landmarks | null {
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + Math.round(x)] === 1;
  const outline = traceOutline(mask, w, h);
  if (outline.length < 40) return null;
  const n = outline.length;

  let top = Infinity, bottom = -Infinity;
  for (const p of outline) { top = Math.min(top, p.y); bottom = Math.max(bottom, p.y); }
  const H = bottom - top;
  if (H < 20) return null;

  // ----- centre line and torso width, from a band just above the hem -----
  const band: { l: number; r: number }[] = [];
  for (let y = Math.round(bottom - H * 0.2); y <= bottom - H * 0.06; y++) {
    let best: { l: number; r: number } | null = null;
    for (let x = 0; x < w; x++) {
      if (!on(x, y)) continue;
      let r = x;
      while (on(r + 1, y)) r++;
      if (!best || r - x > best.r - best.l) best = { l: x, r };
      x = r;
    }
    if (best) band.push(best);
  }
  if (!band.length) return null;
  const cx = median(band.map((r) => (r.l + r.r) / 2));
  const half = median(band.map((r) => (r.r - r.l) / 2));

  /** Index of the outline point nearest to p. */
  const nearest = (p: XY) => {
    let best = 0, d = Infinity;
    outline.forEach((q, i) => {
      const e = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
      if (e < d) { d = e; best = i; }
    });
    return best;
  };

  // ----- hem corners: furthest down-and-out, but no further out than the torso (cuffs can hang that low) -----
  const hemIndex = (dir: -1 | 1) => {
    let best = -1, score = -Infinity;
    outline.forEach((p, i) => {
      const s = (p.x - cx) * dir;
      if (s <= 0 || s > half * 1.25 || p.y < bottom - H * 0.25) return;
      if (p.y + s > score) { score = p.y + s; best = i; }
    });
    return best >= 0 ? best : nearest({ x: cx + dir * half, y: bottom });
  };
  const hemL = hemIndex(-1);
  const hemR = hemIndex(1);

  // ----- armpits: the deepest notch on each side, below the neck -----
  const defects = convexityDefects(outline);
  const armpitIndex = (dir: -1 | 1) => {
    let best: Defect | null = null;
    for (const d of defects) {
      const p = outline[d.at]!;
      if ((p.x - cx) * dir <= 0 || p.y < top + H * 0.15 || p.y > bottom - H * 0.05) continue;
      if (!best || d.depth > best.depth) best = d;
    }
    return best ? best.at : nearest({ x: cx + dir * half, y: top + H * 0.3 });
  };
  const pitL = armpitIndex(-1);
  const pitR = armpitIndex(1);
  const armpitLeft = outline[pitL]!;
  const armpitRight = outline[pitR]!;

  // ----- top edge -----
  const topAt = (x: number) => {
    x = Math.round(x);
    for (let y = top; y <= bottom; y++) if (on(x, y)) return y;
    return bottom;
  };
  const shoulderL = nearest({ x: armpitLeft.x, y: topAt(armpitLeft.x) });
  const shoulderR = nearest({ x: armpitRight.x, y: topAt(armpitRight.x) });

  // ----- collar points: the highest top edge between centre and shoulder, innermost on ties -----
  const collar = (dir: -1 | 1, shoulderX: number): XY => {
    const reach = Math.abs(shoulderX - cx) * 0.75;
    let best = { x: cx + dir * reach, y: Infinity };
    for (let d = Math.round(reach * 0.08); d <= reach; d++) {
      const x = cx + dir * d;
      const y = topAt(x);
      if (y < best.y) best = { x, y };
    }
    return best;
  };
  const collarLeft = collar(-1, outline[shoulderL]!.x);
  const collarRight = collar(1, outline[shoulderR]!.x);
  const neckFront = {
    x: cx,
    y: Math.max(topAt(cx), Math.max(collarLeft.y, collarRight.y) + NECK_DEPTH * (collarRight.x - collarLeft.x)),
  };

  // ----- sleeve openings -----
  /** Outline indexes from a to b going forward (clockwise), inclusive. */
  const arc = (a: number, b: number) => {
    const out: number[] = [];
    for (let k = a; ; k = (k + 1) % n) {
      out.push(k);
      if (k === b) break;
    }
    return out;
  };
  // Clockwise on screen, the left sleeve runs armpit -> sleeve -> shoulder and the right one shoulder -> sleeve -> armpit.
  const sleeve = (from: number, to: number, shoulder: XY, pit: XY, outerFirst: boolean) => {
    const path = arc(from, to);
    const pts = path.map((k) => outline[k]!);
    // Candidates: the stretch's hull points (corners are always on it), in outline order.
    const cand = convexHull(pts).sort((a, b) => a - b);
    const area = (o: XY, i: XY) =>
      Math.abs(
        shoulder.x * o.y - o.x * shoulder.y + (o.x * i.y - i.x * o.y) + (i.x * pit.y - pit.x * i.y) + (pit.x * shoulder.y - shoulder.x * pit.y),
      );
    let best = { outer: pts[0]!, inner: pts[pts.length - 1]!, area: -1 };
    for (let a = 0; a < cand.length; a++) {
      for (let b = a + 1; b < cand.length; b++) {
        // Along the stretch, the outer corner comes first from the shoulder's end.
        const [o, i] = outerFirst ? [pts[cand[a]!]!, pts[cand[b]!]!] : [pts[cand[b]!]!, pts[cand[a]!]!];
        const s = area(o, i);
        if (s > best.area) best = { outer: o, inner: i, area: s };
      }
    }
    return best;
  };
  const left = sleeve(pitL, shoulderL, outline[shoulderL]!, armpitLeft, false);
  const right = sleeve(shoulderR, pitR, outline[shoulderR]!, armpitRight, true);

  const r = (p: XY): XY => ({ x: Math.round(p.x), y: Math.round(p.y) });
  return {
    collarLeft: r(collarLeft),
    collarRight: r(collarRight),
    neckFront: r(neckFront),
    shoulderLeft: r(outline[shoulderL]!),
    shoulderRight: r(outline[shoulderR]!),
    armpitLeft: r(armpitLeft),
    armpitRight: r(armpitRight),
    hemLeft: r(outline[hemL]!),
    hemRight: r(outline[hemR]!),
    sleeveOuterLeft: r(left.outer),
    sleeveInnerLeft: r(left.inner),
    sleeveOuterRight: r(right.outer),
    sleeveInnerRight: r(right.inner),
  };
}
