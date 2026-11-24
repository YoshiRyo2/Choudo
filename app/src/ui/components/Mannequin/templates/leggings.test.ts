import { describe, expect, it } from 'vitest';
import { estimateBody } from '@choudo/core/domain/body';
import { bandHeight, leggingsHemHeight, riseForBand } from '@choudo/core/domain/fit';
import { findGarment } from '@choudo/core/domain/garments';
import { bodyGeometry, halfWidth } from '../geometry';
import { bodyLegAt, LEGGINGS_ROOM_CM, leggingsShape } from './leggings';

const m = estimateBody({ heightCm: 163, weightKg: 68, bodyType: 'womens' }).measurements;
const g = bodyGeometry(m);
const lpst880 = findGarment('sporttek-lpst880')!;
const lpst890 = findGarment('sporttek-lpst890')!;
const sizeOf = (g0: typeof lpst880, label: string) => g0.sizes.find((s) => s.label === label)!.measurements;

describe('bodyGeometry ankle', () => {
  it('draws the ankle at the body’s ankle height', () => {
    expect(g.y.ankle).toBeCloseTo(m.heightCm - m.ankleHeightCm);
  });
});

describe('leggingsShape', () => {
  it('draws the band where the fit says it sits', () => {
    const size = sizeOf(lpst890, 'M');
    expect(leggingsShape(g, m, lpst890, size).markers.waist!.y).toBeCloseTo(m.heightCm - bandHeight(m, riseForBand(lpst890, size)));
  });

  it('ends the hem the inseam below the crotch: a 7/8 above the ankle', () => {
    const size = sizeOf(lpst890, 'M');
    const shape = leggingsShape(g, m, lpst890, size);
    expect(shape.markers.inseam!.y).toBeCloseTo(m.heightCm - leggingsHemHeight(m, size)!);
    expect(shape.markers.inseam!.y).toBeLessThan(g.y.ankle);
    expect(shape.pooled).toBe(false);
  });

  it('stops a hem that runs past the ankle bone at the ankle, bunched', () => {
    const shape = leggingsShape(g, m, lpst880, sizeOf(lpst880, 'M'));
    expect(shape.markers.inseam!.y).toBeCloseTo(g.y.ankle);
    expect(shape.pooled).toBe(true);
  });

  it('follows the body’s own leg when the chart is cut under it', () => {
    const shape = leggingsShape(g, m, lpst880, sizeOf(lpst880, 'M'));
    expect(shape.markers.thigh!.x).toBeCloseTo(g.leg.thighX + g.leg.thighHalf + LEGGINGS_ROOM_CM);
    expect(shape.markers.hips!.x).toBeCloseTo(g.half.hip + LEGGINGS_ROOM_CM);
    const hemY = shape.markers.inseam!.y;
    const leg = bodyLegAt(g, hemY);
    expect(shape.landmarks.hemOuterRight.x).toBeCloseTo(leg.x + leg.half + LEGGINGS_ROOM_CM);
  });

  it('draws a chart bigger than the body at the chart’s width', () => {
    const shape = leggingsShape(g, m, lpst880, { ...sizeOf(lpst880, 'M'), hips: m.hipsCm + 10, thigh: m.thighCm + 8 });
    expect(shape.markers.hips!.x).toBeCloseTo(halfWidth.hips(m.hipsCm + 10));
    expect(shape.markers.thigh!.x).toBeCloseTo(g.leg.thighX + halfWidth.leg(m.thighCm + 8));
  });

  it('draws dashed only when the chart has no inseam to end it', () => {
    expect(leggingsShape(g, m, lpst890, sizeOf(lpst890, 'M')).approximate).toBe(false);
    const { inseam: _drop, ...noInseam } = sizeOf(lpst890, 'M');
    const shape = leggingsShape(g, m, lpst890, noInseam);
    expect(shape.approximate).toBe(true);
    expect(shape.markers.inseam!.y).toBeCloseTo(g.y.ankle);
  });
});
