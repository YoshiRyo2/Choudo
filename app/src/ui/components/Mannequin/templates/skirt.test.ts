import { describe, expect, it } from 'vitest';
import { estimateBody } from '../../../../domain/body';
import { skirtBandHeight, skirtHemHeight, skirtHipHeight } from '../../../../domain/fit';
import { findGarment, type Garment } from '../../../../domain/garments';
import { bodyGeometry, bodyHalfAt, halfWidth } from '../geometry';
import { skirtShape } from './skirt';

const m = estimateBody({ heightCm: 163, weightKg: 68, bodyType: 'womens' }).measurements;
const g = bodyGeometry(m);
const skirt = findGarment('landsend-a-line-skirt')!;
const size = skirt.sizes.find((s) => s.label === '12')!.measurements;

describe('skirtShape', () => {
  it('draws the band, hip point and hem at the heights the fit uses', () => {
    const shape = skirtShape(g, m, skirt, size);
    expect(shape.markers.waist.y).toBeCloseTo(m.heightCm - skirtBandHeight(m, skirt));
    expect(shape.markers.hips.y).toBeCloseTo(m.heightCm - skirtHipHeight(m, skirt));
    expect(shape.hemY).toBeCloseTo(m.heightCm - skirtHemHeight(m, skirt, size));
    expect(shape.markers.length.y).toBeCloseTo(shape.hemY);
    expect(shape.markers.walkingRoom.y).toBeCloseTo(shape.hemY);
  });

  it('draws the hips at the chart’s hip point when it gives one', () => {
    const at: Garment = { ...skirt, hipsBelowWaistCm: 12 };
    expect(skirtShape(g, m, at, size).markers.hips.y).toBeCloseTo(m.heightCm - skirtHipHeight(m, at));
  });

  it('draws widths from the chart: an A-line flares, a pencil narrows', () => {
    const aLine = skirtShape(g, m, skirt, size);
    expect(aLine.markers.hips.x).toBeCloseTo(halfWidth.hips(size.hips!));
    expect(aLine.hemHalf).toBeCloseTo(halfWidth.hips(size.hemSweep!));
    const pencil = skirtShape(g, m, skirt, { ...size, hemSweep: 92 });
    expect(pencil.hemHalf).toBeLessThan(pencil.markers.hips.x);
    expect(aLine.approximate).toBe(false);
  });

  it('never draws inside the body', () => {
    const tiny = skirtShape(g, m, skirt, { ...size, waist: 50, hips: 60, hemSweep: 40 });
    expect(tiny.markers.waist.x).toBeGreaterThan(bodyHalfAt(g, tiny.markers.waist.y));
    expect(tiny.markers.hips.x).toBeGreaterThan(bodyHalfAt(g, tiny.markers.hips.y));
    expect(tiny.hemHalf).toBeGreaterThan(bodyHalfAt(g, tiny.hemY));
  });

  it('falls straight down from the hips, dashed, without a sweep', () => {
    const { hemSweep: _sweep, ...noSweep } = size;
    const shape = skirtShape(g, m, skirt, noSweep);
    expect(shape.approximate).toBe(true);
    expect(shape.hemHalf).toBeCloseTo(Math.max(shape.markers.hips.x, bodyHalfAt(g, shape.hemY) + 0.5));
  });

  it('stops a hem that would reach past the floor just above it', () => {
    const shape = skirtShape(g, m, skirt, { ...size, length: 140 });
    expect(shape.hemY).toBeCloseTo(g.y.floor - 0.5);
  });
});
