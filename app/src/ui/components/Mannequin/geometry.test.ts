import { describe, expect, it } from 'vitest';
import { estimateBody } from '../../../domain/body';
import { findGarment } from '../../../domain/garments';
import { bodyGeometry, bodyHalfAt, bottomShape, limbFrame, mirrorPath, smoothPath } from './geometry';
import { MAX_SIDE_FLARE_CM, topShape } from './topShape';
import { UNKNOWN_CHEST_TEE } from '../../../domain/garments/testFixtures';

const body = (heightCm: number, weightKg: number) =>
  estimateBody({ heightCm, weightKg, sizing: 'mens' }).measurements;

describe('bodyGeometry', () => {
  it('scales vertically with height and stands on the floor', () => {
    const short = bodyGeometry(body(160, 60));
    const tall = bodyGeometry(body(195, 90));
    expect(tall.y.floor).toBe(195);
    expect(tall.y.waist).toBeGreaterThan(short.y.waist);
    expect(tall.y.crotch).toBeLessThan(tall.y.floor);
  });

  it('puts the crotch at height minus inseam', () => {
    const m = estimateBody({ heightCm: 176, weightKg: 85, sizing: 'mens', overrides: { inseamCm: 80 } });
    expect(bodyGeometry(m.measurements).y.crotch).toBeCloseTo(96);
  });

  it('gets wider with weight', () => {
    const slim = bodyGeometry(body(176, 60));
    const heavy = bodyGeometry(body(176, 110));
    expect(heavy.half.waist).toBeGreaterThan(slim.half.waist);
    expect(bodyHalfAt(heavy, heavy.y.hip)).toBeGreaterThan(bodyHalfAt(slim, slim.y.hip));
  });
});

describe('garment shapes', () => {
  const g = bodyGeometry(body(176, 85));

  it('draws a longer size with a lower hem', () => {
    const tee = findGarment('knightweave-tee')!;
    const s = topShape(g, tee, tee.sizes[0]!.measurements, 104);
    const xl = topShape(g, tee, tee.sizes[3]!.measurements, 104);
    expect(xl.markers.length!.y).toBeGreaterThan(s.markers.length!.y);
    expect(xl.markers.chest!.x).toBeGreaterThan(s.markers.chest!.x);
  });

  it('never draws a garment narrower than the body under it', () => {
    const tee = findGarment('knightweave-tee')!;
    const tiny = topShape(g, tee, { chest: 60, length: 60 }, 104);
    expect(tiny.markers.chest!.x).toBeGreaterThan(g.half.chest);
  });

  it('marks unverified girths as approximate', () => {
    const tee = UNKNOWN_CHEST_TEE;
    expect(topShape(g, tee, tee.sizes[1]!.measurements, 104).approximate).toBe(true);
  });

  it('puts a short inseam hem above a long one, and pools anything past the floor', () => {
    const jean = findGarment('corvo-slim-jean')!;
    const short = bottomShape(g, jean, { waist: 84, hips: 100, inseam: 70 });
    const long = bottomShape(g, jean, { waist: 84, hips: 100, inseam: 120 });
    expect(short.markers.inseam!.y).toBeLessThan(long.markers.inseam!.y);
    expect(long.pooled).toBe(true);
    expect(long.markers.inseam!.y).toBeLessThanOrEqual(g.y.floor);
  });
});

describe('a tee at every size (Gildan 5000, S to 5XL)', () => {
  const gildan = findGarment('gildan-5000')!;
  const bodies = {
    small: body(160, 52),
    average: body(178, 75),
    large: body(192, 125),
  };

  for (const [name, m] of Object.entries(bodies)) {
    const g = bodyGeometry(m);
    const shapes = gildan.sizes.map((s) => ({
      size: s.label,
      shape: topShape(g, gildan, s.measurements, m.chestCm),
    }));

    describe(`${name} body`, () => {
      it.each(shapes)('$size: sleeves stick out past the shirt body and the torso', ({ shape }) => {
        const { sleeveOuterMid, bodyHalfAtSleeveMid } = shape.right;
        expect(sleeveOuterMid.x).toBeGreaterThan(bodyHalfAtSleeveMid + 1);
        expect(sleeveOuterMid.x).toBeGreaterThan(bodyHalfAt(g, sleeveOuterMid.y) + 1);
      });

      it.each(shapes)('$size: shoulder seam is never inside the body’s shoulder point', ({ shape }) => {
        expect(shape.right.seam.x).toBeGreaterThanOrEqual(g.half.shoulder);
        expect(shape.right.seam.y).toBeGreaterThanOrEqual(g.y.shoulder);
      });

      it.each(shapes)('$size: hem sits below the waist', ({ shape }) => {
        expect(shape.right.hem.y).toBeGreaterThan(g.y.waist);
      });

      it.each(shapes)('$size: short sleeves end on the upper arm, leaving the forearm bare', ({ shape }) => {
        expect(shape.right.sleeveEndCm).toBeLessThanOrEqual(g.arm.elbowCm);
        expect(shape.right.sleeveEndT).toBeLessThan(1);
        expect(shape.arms[0]).toMatch(/^M/);
      });

      it.each(shapes)('$size: sleeve tips hang below the shoulder seam', ({ shape }) => {
        const { seam, sleeveOuterEnd, sleeveInnerEnd } = shape.right;
        expect(sleeveOuterEnd.y).toBeGreaterThan(seam.y);
        expect(sleeveInnerEnd.y).toBeGreaterThan(seam.y);
      });

      it.each(shapes)('$size: sleeves angle down along the arm, not out sideways', ({ shape }) => {
        const { seam, sleeveOuterEnd } = shape.right;
        expect(sleeveOuterEnd.x - seam.x).toBeLessThan(0.45 * (sleeveOuterEnd.y - seam.y));
      });

      it.each(shapes)('$size: side seams fall nearly straight from armpit to hem', ({ shape }) => {
        const [armpit, ...below] = shape.right.sideSeam;
        for (const p of below) expect(p.x - armpit!.x).toBeLessThanOrEqual(MAX_SIDE_FLARE_CM + 0.3);
      });

      it('drops the shoulder seam down and out as the size grows, never back in', () => {
        for (let i = 1; i < shapes.length; i++) {
          const prev = shapes[i - 1]!.shape.right.seam;
          const next = shapes[i]!.shape.right.seam;
          expect(next.x).toBeGreaterThanOrEqual(prev.x - 1e-9);
          expect(next.y).toBeGreaterThanOrEqual(prev.y - 1e-9);
        }
      });

      it('lowers the hem with each size, and never shrinks the sleeve', () => {
        for (let i = 1; i < shapes.length; i++) {
          const prev = shapes[i - 1]!.shape.right;
          const next = shapes[i]!.shape.right;
          // A size smaller than the arm stretches over it, so the sleeve can't get narrower.
          expect(next.sleeveOuterMid.x).toBeGreaterThanOrEqual(prev.sleeveOuterMid.x - 1e-9);
          expect(next.hem.y).toBeGreaterThan(prev.hem.y);
        }
        const first = shapes[0]!.shape.right.sleeveOuterMid.x;
        expect(shapes.at(-1)!.shape.right.sleeveOuterMid.x).toBeGreaterThan(first + 3);
      });
    });
  }

  it('keeps the seam on the shoulder point when there is little chest ease', () => {
    const g = bodyGeometry(bodies.average);
    const m = topShape(g, gildan, gildan.sizes.find((s) => s.label === 'M')!.measurements, bodies.average.chestCm);
    expect(m.right.seam.x - g.half.shoulder).toBeLessThan(2.5);
    expect(m.right.seam.y - g.y.shoulder).toBeLessThan(4);
  });

  it('drops the 5XL seam well down the arm on an average body', () => {
    const g = bodyGeometry(bodies.average);
    const xxl = topShape(g, gildan, gildan.sizes.at(-1)!.measurements, bodies.average.chestCm);
    expect(xxl.right.seam.y - g.y.shoulder).toBeGreaterThan(8);
    expect(xxl.right.sleeveEndCm).toBeLessThan(limbFrame(g.arm).len);
  });

  it('hugs the body at S: seam on the shoulder point, sides on the chest, strain lines', () => {
    const g = bodyGeometry(bodies.average);
    const small = topShape(g, gildan, gildan.sizes[0]!.measurements, bodies.average.chestCm);
    expect(small.right.seam.x).toBeLessThanOrEqual(g.half.shoulder + 0.5);
    expect(small.right.seam.y - g.y.shoulder).toBeLessThan(2);
    expect(small.right.underarm.x).toBeLessThanOrEqual(g.half.chest + 0.5);
    expect(small.strain.length).toBeGreaterThan(0);
  });

  it('pulls a too-small size tight with strain lines, and gives a big one folds instead', () => {
    const g = bodyGeometry(bodies.large);
    const s = topShape(g, gildan, gildan.sizes[0]!.measurements, bodies.large.chestCm);
    const xxl = topShape(g, gildan, gildan.sizes.at(-1)!.measurements, bodies.large.chestCm);
    expect(s.strain.length).toBeGreaterThan(0);
    expect(s.folds).toHaveLength(0);
    expect(xxl.strain).toHaveLength(0);
    const avg = bodyGeometry(bodies.average);
    expect(topShape(avg, gildan, gildan.sizes.at(-1)!.measurements, bodies.average.chestCm).folds.length).toBeGreaterThan(0);
  });
});

describe('path helpers', () => {
  it('builds closed and open paths', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    expect(smoothPath(pts, true)).toMatch(/^M0 0 C.* Z$/);
    expect(smoothPath(pts, false)).not.toMatch(/Z$/);
  });

  it('mirrors x but not y', () => {
    expect(mirrorPath('M1 2 C3 4 5 6 7 8 Z')).toBe('M-1 2 C-3 4 -5 6 -7 8 Z');
  });
});
