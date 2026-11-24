import { describe, expect, it } from 'vitest';
import { estimateBody } from '@choudo/core/domain/body';
import { dressHemHeight, dressSeamHeight } from '@choudo/core/domain/fit';
import { findGarment, normalizeGarment, type SeedGarment } from '@choudo/core/domain/garments';
import { DRESS_SEED } from '@choudo/core/domain/garments/testFixtures';
import { bodyGeometry, bodyHalfAt, halfWidth } from '../geometry';
import { dressShape } from './dress';

const m = estimateBody({ heightCm: 163, weightKg: 68, bodyType: 'womens' }).measurements;
const g = bodyGeometry(m);
const sheath = findGarment('landsend-sheath-dress')!;
const surplice = findGarment('landsend-surplice-dress')!;
const sizeOf = (garment: typeof sheath, label: string) => garment.sizes.find((s) => s.label === label)!.measurements;

describe('dressShape', () => {
  const size = sizeOf(sheath, '10');
  const shape = dressShape(g, m, sheath, size);

  it('ends the skirt at the hem height the fit uses', () => {
    expect(shape.hemY).toBeCloseTo(g.height - dressHemHeight(m, sheath, size), 2);
    expect(shape.markers.length!.y).toBeCloseTo(shape.hemY, 6);
    expect(shape.markers.walkingRoom!.y).toBeCloseTo(shape.hemY, 6);
  });

  it('ends the bodice at the seam, where the skirt starts, at the same width', () => {
    const seamY = g.height - dressSeamHeight(m, sheath);
    const side = shape.bodice.right.sideSeam;
    expect(side[side.length - 1]!.y).toBeCloseTo(seamY, 6);
    expect(shape.markers.waist!.y).toBeCloseTo(seamY, 6);
    expect(side[side.length - 1]!.x).toBeCloseTo(shape.markers.waist!.x, 6);
  });

  it('draws the chart’s waist and hips, never inside the body', () => {
    expect(shape.markers.waist!.x).toBeCloseTo(Math.max(halfWidth.waist(size.waist!), bodyHalfAt(g, shape.markers.waist!.y) + 0.5), 6);
    expect(shape.markers.hips!.x).toBeGreaterThanOrEqual(bodyHalfAt(g, shape.markers.hips!.y));
    expect(shape.markers.chest).toEqual(shape.bodice.markers.chest);
    expect(shape.approximate).toBe(false);
  });

  it('hands a jacket the whole outline, bodice and skirt', () => {
    const side = shape.asUnder.right.sideSeam;
    expect(side[0]).toEqual(shape.bodice.right.sideSeam[0]);
    expect(side[side.length - 1]!.y).toBeCloseTo(shape.hemY, 6);
    for (let i = 1; i < side.length; i++) expect(side[i]!.y).toBeGreaterThan(side[i - 1]!.y);
  });

  it('keeps a long dress on a short body above the floor', () => {
    const short = estimateBody({ heightCm: 150, weightKg: 50, bodyType: 'womens' }).measurements;
    const sg = bodyGeometry(short);
    const long = normalizeGarment({ ...DRESS_SEED, sizes: [{ label: 'M', measurements: { chest: 90, length: 140 } }] } as SeedGarment);
    expect(dressShape(sg, short, long, long.sizes[0]!.measurements).hemY).toBeLessThan(sg.y.floor);
  });

  it('draws a chart with no waist or hips, dashed', () => {
    const s = dressShape(g, m, surplice, sizeOf(surplice, 'M'));
    expect(s.approximate).toBe(true);
    expect(s.markers.waist).toBeUndefined();
    expect(s.markers.hips).toBeUndefined();
    expect(s.hemY).toBeCloseTo(g.height - dressHemHeight(m, surplice, sizeOf(surplice, 'M')), 2);
  });
});

describe('dressShape without a placeable length', () => {
  it('draws the hem at the knee, dashed', () => {
    const unknownLength = normalizeGarment({ ...DRESS_SEED, chart: { ...DRESS_SEED.chart, definitions: { length: 'unknown', waistSeam: 'natural' } } } as SeedGarment);
    const s = dressShape(g, m, unknownLength, unknownLength.sizes[1]!.measurements);
    expect(s.approximate).toBe(true);
    expect(s.hemY).toBeCloseTo(g.y.knee, 6);
  });
});
