import { describe, expect, it } from 'vitest';
import { estimateBody } from '../../../../domain/body';
import { bandHeight, riseForBand } from '../../../../domain/fit';
import { findGarment, type Garment } from '../../../../domain/garments';
import { foldedPieces, SLEEVE_STRIPS, warpPantsPieces } from '../photoWarp';
import { SYNTHETIC_JEANS_LANDMARKS } from '../pantsFixture';
import { bodyGeometry, halfWidth } from '../geometry';
import { HEM_HALF, pantsShape } from './pants';

const m = estimateBody({ heightCm: 176, weightKg: 85, bodyType: 'mens' }).measurements;
const g = bodyGeometry(m);
const jean = findGarment('corvo-slim-jean')!;
const size = jean.sizes.find((s) => s.label === '32x32')!.measurements;

describe('pantsShape', () => {
  it('draws the band at bandHeight, the same number the fit uses', () => {
    const shape = pantsShape(g, m, jean, size);
    expect(shape.markers.waist!.y).toBeCloseTo(m.heightCm - bandHeight(m, riseForBand(jean, size)));
    expect(shape.markers.rise!.y).toBeCloseTo(shape.markers.waist!.y);
  });

  it('draws a lower rise with a lower band', () => {
    const low = pantsShape(g, m, jean, { ...size, rise: size.rise! - 6 });
    expect(low.markers.waist!.y).toBeGreaterThan(pantsShape(g, m, jean, size).markers.waist!.y);
  });

  it('draws the band at the navel when the rise isn’t the front rise', () => {
    const chino = findGarment('fieldline-slim-chino')!;
    const shape = pantsShape(g, m, chino, chino.sizes[1]!.measurements);
    expect(shape.markers.waist!.y).toBeCloseTo(g.y.waist);
  });

  it('draws the thigh, knee and opening widths from the chart', () => {
    // A thigh roomier than this body's (62.8 cm), so the chart's width shows.
    const shape = pantsShape(g, m, jean, { ...size, thigh: 70 });
    expect(shape.markers.thigh!.x).toBeCloseTo(g.leg.thighX + halfWidth.leg(70));
    const wide = pantsShape(g, m, jean, { ...size, legOpening: size.legOpening! + 12 });
    // Half the opening either side of the leg's centre line (the inner edge may meet the middle).
    expect(wide.limbEdges.right.outer.at(-1)!.x - wide.markers.legOpening!.x).toBeCloseTo(halfWidth.leg(size.legOpening! + 12));
    expect(shape.approximate).toBe(false);
  });

  it('never draws a leg narrower than the body under it', () => {
    const tiny = pantsShape(g, m, jean, { ...size, thigh: 30, knee: 20, legOpening: 15 });
    expect(tiny.markers.thigh!.x).toBeGreaterThan(g.leg.thighX + g.leg.thighHalf);
  });

  it('falls back, dashed, when the chart has no leg opening, thigh or knee', () => {
    const chino = findGarment('fieldline-slim-chino')!;
    const shape = pantsShape(g, m, chino, chino.sizes[1]!.measurements);
    expect(shape.approximate).toBe(true);
    const extra = shape.pooled ? 1.2 : 0;
    expect(shape.limbEdges.right.outer.at(-1)!.x - shape.markers.legOpening!.x).toBeCloseTo(Math.max(HEM_HALF.chinos + extra, g.leg.ankleHalf + 0.3));
  });

  it('is dashed when a girth method is unknown', () => {
    const unknown: Garment = { ...jean, girthVerified: false };
    expect(pantsShape(g, m, unknown, size).approximate).toBe(true);
  });

  it('runs each leg edge from the hip and the crotch down to the hem, for the warp strips', () => {
    const shape = pantsShape(g, m, jean, size);
    for (const side of ['left', 'right'] as const) {
      const { outer, inner } = shape.limbEdges[side];
      expect(outer).toHaveLength(SLEEVE_STRIPS + 1);
      expect(inner).toHaveLength(SLEEVE_STRIPS + 1);
      expect(outer[0]!.y).toBeCloseTo(g.y.hip);
      expect(outer.at(-1)!.y).toBeCloseTo(shape.markers.inseam!.y);
      expect(inner.at(-1)!.y).toBeCloseTo(shape.markers.inseam!.y);
      for (let k = 1; k <= SLEEVE_STRIPS; k++) expect(outer[k]!.y).toBeGreaterThan(outer[k - 1]!.y);
    }
    expect(shape.limbEdges.left.outer[2]!.x).toBeCloseTo(-shape.limbEdges.right.outer[2]!.x);
  });

  it('puts a short inseam hem above a long one, and pools anything past the floor', () => {
    const short = pantsShape(g, m, jean, { ...size, inseam: 70 });
    const long = pantsShape(g, m, jean, { ...size, inseam: 120 });
    expect(short.markers.inseam!.y).toBeLessThan(long.markers.inseam!.y);
    expect(long.pooled).toBe(true);
    expect(long.markers.inseam!.y).toBeLessThanOrEqual(g.y.floor);
  });
});

describe('pantsShape edge cases (from the branch review)', () => {
  it('a band below the hip line still draws the right way up, and the photo doesn’t fold', () => {
    // A rise so short the band lands below the hip line: the fit's "won't stay up" case.
    const low = { ...size, rise: 5 };
    expect(m.heightCm - bandHeight(m, riseForBand(jean, low))).toBeGreaterThan(g.y.hip);
    const shape = pantsShape(g, m, jean, low);
    const l = shape.landmarks;
    expect(l.waistRight.y).toBeLessThan(l.hipRight.y);
    expect(l.hipRight.y).toBeLessThan(shape.markers.thigh!.y);
    expect(shape.limbEdges.right.outer[0]!.y).toBeCloseTo(l.hipRight.y);
    const pieces = warpPantsPieces(SYNTHETIC_JEANS_LANDMARKS, l, shape.limbEdges);
    expect(foldedPieces(pieces)).toEqual([]);
  });

  it("clips each leg's photo to the same outline as the pants, through the outer thigh", () => {
    const shape = pantsShape(g, m, jean, { ...size, thigh: 70 });
    const r = (v: number) => (Math.round(v * 100) / 100).toString();
    const thigh = shape.markers.thigh!;
    expect(shape.legs.right).toContain(`${r(thigh.x)} ${r(thigh.y)}`);
    expect(shape.legs.left).toContain(`${r(-thigh.x)} ${r(thigh.y)}`);
  });
});
