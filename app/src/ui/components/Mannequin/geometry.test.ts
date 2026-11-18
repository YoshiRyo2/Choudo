import { describe, expect, it } from 'vitest';
import { estimateBody } from '../../../domain/body';
import { findGarment } from '../../../domain/garments';
import { bodyGeometry, bodyHalfAt, bottomShape, mirrorPath, smoothPath, topShape } from './geometry';

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
    const le = findGarment('landsend-super-t')!;
    expect(topShape(g, le, le.sizes[1]!.measurements, 104).approximate).toBe(true);
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
