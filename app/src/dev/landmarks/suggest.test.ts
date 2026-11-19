import { describe, expect, it } from 'vitest';
import {
  alphaMask,
  convexHull,
  convexityDefects,
  insetMask,
  suggestLandmarks,
  traceOutline,
  type Landmarks,
  type XY,
} from './suggest';

const W = 200, H = 200;

/** Fill polygons (even-odd, pixel centres) into a W×H mask, then clear `holes`. */
function draw(polys: XY[][], holes: ((x: number, y: number) => boolean)[] = []): Uint8Array {
  const mask = new Uint8Array(W * H);
  const inside = (poly: XY[], x: number, y: number) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [a, b] = [poly[i]!, poly[j]!];
      if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (polys.some((p) => inside(p, x + 0.5, y + 0.5)) && !holes.some((f) => f(x, y))) mask[y * W + x] = 1;
    }
  }
  return mask;
}
const P = (x: number, y: number): XY => ({ x, y });
const mirror = (poly: XY[]) => poly.map((p) => P(200 - p.x, p.y));
const neck = (x: number, y: number) => ((x - 100) / 18) ** 2 + ((y - 40) / 8) ** 2 < 1;

const near = (lm: Landmarks, name: keyof Landmarks, want: XY, tol = 5) => {
  const got = lm[name];
  expect(Math.hypot(got.x - want.x, got.y - want.y), `${name} at ${got.x},${got.y}, want ${want.x},${want.y}`).toBeLessThanOrEqual(tol);
};

describe('outline helpers', () => {
  const square = draw([[P(10, 10), P(30, 10), P(30, 30), P(10, 30)]]);
  it('traces a closed outline clockwise round the shape', () => {
    const outline = traceOutline(square, W, H);
    expect(outline[0]).toEqual({ x: 10, y: 10 });
    expect(outline[1]).toEqual({ x: 11, y: 10 }); // heading east along the top: clockwise on screen
    expect(outline).toHaveLength(4 * 19);
    expect(outline.every((p) => p.x === 10 || p.x === 29 || p.y === 10 || p.y === 29)).toBe(true);
  });
  it('returns nothing for an empty mask', () => {
    expect(traceOutline(new Uint8Array(W * H), W, H)).toEqual([]);
  });
  it('hull drops points inside and on edges', () => {
    const pts = [P(0, 0), P(10, 0), P(5, 0), P(10, 10), P(0, 10), P(5, 5)];
    expect(convexHull(pts).map((i) => pts[i]).sort((a, b) => a!.x - b!.x || a!.y - b!.y)).toEqual([
      P(0, 0), P(0, 10), P(10, 0), P(10, 10),
    ]);
  });
  it('finds the notch of an L shape at its inner corner', () => {
    const L = draw([[P(10, 10), P(20, 10), P(20, 40), P(50, 40), P(50, 50), P(10, 50)]]);
    const outline = traceOutline(L, W, H);
    const deepest = convexityDefects(outline).reduce((a, b) => (b.depth > a.depth ? b : a));
    const p = outline[deepest.at]!;
    expect(Math.hypot(p.x - 19, p.y - 40)).toBeLessThanOrEqual(2);
  });
  it('alphaMask reads the last channel and insetMask peels the edge', () => {
    expect([...alphaMask(Uint8Array.from([9, 9, 9, 255, 9, 9, 9, 0]), 2, 1)]).toEqual([1, 0]);
    const inset = insetMask(square, W, H, 3);
    expect(inset[13 * W + 13]).toBe(1);
    expect(inset[12 * W + 12]).toBe(0);
    expect(insetMask(square, W, H, 0)).toEqual(square);
  });
});

describe('suggestLandmarks', () => {
  it('reads a short-sleeve tee', () => {
    const sleeve = [P(62, 40), P(22, 66), P(36, 90), P(62, 80)];
    const tee = draw([[P(60, 40), P(140, 40), P(140, 190), P(60, 190)], sleeve, mirror(sleeve)], [neck]);
    const lm = suggestLandmarks(tee, W, H)!;
    near(lm, 'hemLeft', P(60, 189));
    near(lm, 'hemRight', P(139, 189));
    near(lm, 'armpitLeft', P(60, 80), 6);
    near(lm, 'armpitRight', P(139, 80), 6);
    near(lm, 'shoulderLeft', P(60, 40), 6);
    near(lm, 'sleeveOuterLeft', P(22, 66));
    near(lm, 'sleeveInnerLeft', P(36, 89));
    near(lm, 'sleeveOuterRight', P(177, 66));
    near(lm, 'sleeveInnerRight', P(163, 89));
    // Collar points either side of the neck dip, neckFront below them on the centre line.
    expect(lm.collarLeft.x).toBeLessThan(83);
    expect(lm.collarLeft.y).toBe(40);
    expect(lm.collarRight.x).toBeGreaterThan(117);
    expect(lm.neckFront.x).toBeCloseTo(100, -1);
    expect(lm.neckFront.y).toBeGreaterThan(48);
  });

  it('reads a long-sleeve top with sleeves hanging down and out', () => {
    const sleeve = [P(62, 40), P(12, 140), P(28, 152), P(62, 76)];
    const top = draw([[P(60, 40), P(140, 40), P(140, 180), P(60, 180)], sleeve, mirror(sleeve)], [neck]);
    const lm = suggestLandmarks(top, W, H)!;
    near(lm, 'armpitLeft', P(60, 77), 6);
    near(lm, 'armpitRight', P(139, 77), 6);
    near(lm, 'hemLeft', P(60, 179));
    near(lm, 'sleeveOuterLeft', P(12, 140), 6);
    near(lm, 'sleeveInnerLeft', P(28, 151), 6);
    near(lm, 'sleeveOuterRight', P(188, 140), 6);
    near(lm, 'sleeveInnerRight', P(172, 151), 6);
  });

  it('ignores cuffs hanging as low as the hem when finding the hem corners', () => {
    const sleeve = [P(62, 40), P(30, 175), P(44, 178), P(62, 80)];
    const top = draw([[P(60, 40), P(140, 40), P(140, 180), P(60, 180)], sleeve, mirror(sleeve)], [neck]);
    const lm = suggestLandmarks(top, W, H)!;
    near(lm, 'hemLeft', P(60, 179));
    near(lm, 'hemRight', P(139, 179));
  });

  it('returns null for an empty or tiny mask', () => {
    expect(suggestLandmarks(new Uint8Array(W * H), W, H)).toBeNull();
    expect(suggestLandmarks(draw([[P(5, 5), P(9, 5), P(9, 9), P(5, 9)]]), W, H)).toBeNull();
  });
});
