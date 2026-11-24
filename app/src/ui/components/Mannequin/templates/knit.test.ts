import { describe, expect, it } from 'vitest';
import { estimateBody } from '@choudo/core/domain/body';
import { findGarment, normalizeGarment } from '@choudo/core/domain/garments';
import { KNIT_HOODIE_SEED } from '@choudo/core/domain/garments/testFixtures';
import { sleeveFromShoulderPointCm } from '@choudo/core/domain/fit';
import { bodyGeometry, bodyHalfAt, halfWidth, limbFrame, limbHalf } from '../geometry';
import { RIB_HEM_CM, topShape } from '../topShape';

const m = estimateBody({ heightCm: 176, weightKg: 85, bodyType: 'mens' }).measurements;
const g = bodyGeometry(m);
const hoodie = findGarment('gildan-18500')!;
const crew = findGarment('comfort-colors-1566')!;
const draw = (garment = hoodie, label = 'L') =>
  topShape(g, garment, garment.sizes.find((s) => s.label === label)!.measurements, m.chestCm, m);

describe('knit rib hem band', () => {
  it('is drawn at the hem, RIB_HEM_CM tall', () => {
    const s = draw();
    expect(s.rib?.hem).toBeDefined();
    expect(s.rib!.hemTopY).toBeCloseTo(s.right.hem.y - RIB_HEM_CM, 6);
  });

  it("takes its width from the chart's hem band when that is wider than the body there", () => {
    const xl = hoodie.sizes.find((s) => s.label === 'XL')!.measurements;
    const s = draw(hoodie, 'XL');
    expect(halfWidth.hips(xl.hemBand!)).toBeGreaterThan(bodyHalfAt(g, s.right.hem.y) + 0.3);
    expect(s.right.hem.x).toBeCloseTo(halfWidth.hips(xl.hemBand!), 6);
  });

  it('stretches onto the body, never inside it, when the band is smaller than the body', () => {
    const s = draw(hoodie, 'S');
    expect(s.right.hem.x).toBeCloseTo(bodyHalfAt(g, s.right.hem.y) + 0.3, 6);
  });

  it('grows with the size where the chart sets the width (a band that hugs follows the body instead)', () => {
    const widths = hoodie.sizes
      .map((s) => ({ s, shape: draw(hoodie, s.label) }))
      .filter(({ s, shape }) => halfWidth.hips(s.measurements.hemBand!) > bodyHalfAt(g, shape.right.hem.y) + 0.3)
      .map(({ shape }) => shape.right.hem.x);
    expect(widths.length).toBeGreaterThan(3);
    for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeGreaterThan(widths[i - 1]!);
  });

  it('gathers in: never wider than the body of the sweatshirt above it', () => {
    for (const size of hoodie.sizes) {
      const s = draw(hoodie, size.label);
      expect(s.right.hem.x).toBeLessThanOrEqual(s.right.underarm.x + 0.01);
    }
  });

  it('pins the hem band zone on the band', () => {
    const s = draw();
    // At the top of the band, clear of the length pin at the hem.
    expect(s.markers.hemBand).toEqual({ x: s.right.hem.x, y: s.rib!.hemTopY + 1 });
  });
});

describe('knit sleeves', () => {
  it("end where the engine's centre-back conversion puts the cuff", () => {
    const l = hoodie.sizes.find((s) => s.label === 'L')!.measurements;
    expect(draw().right.sleeveEndCm).toBeCloseTo(sleeveFromShoulderPointCm(hoodie, l, m)!, 6);
  });

  it('never run past the hand, however long', () => {
    expect(draw(hoodie, '5XL').right.sleeveEndCm).toBeLessThanOrEqual(limbFrame(g.arm).len * 1.06 + 1e-9);
  });

  it('gather into a rib cuff at the wrist', () => {
    const s = draw();
    expect(s.rib?.cuffs).toHaveLength(2);
    const arm = limbFrame(g.arm);
    const end = s.right.sleeveEndCm;
    const opening = Math.hypot(s.right.sleeveOuterEnd.x - s.right.sleeveInnerEnd.x, s.right.sleeveOuterEnd.y - s.right.sleeveInnerEnd.y);
    expect(opening).toBeLessThanOrEqual(2 * limbHalf(g.arm, end / arm.len) + 2);
  });
});

describe('hood', () => {
  it('a hoodie has one, with a hoodTop landmark above the collar', () => {
    const s = draw();
    expect(s.hood).toBeDefined();
    expect(s.hood!.cords).toHaveLength(2);
    expect(s.hoodTop).toBeDefined();
    expect(s.hoodTop!.y).toBeLessThan(s.landmarks.collarRight.y);
    expect(s.hoodTop!.y).toBeGreaterThan(g.y.chin);
  });

  it("a crewneck sweatshirt doesn't", () => {
    const s = draw(crew, 'L');
    expect(s.hood).toBeUndefined();
    expect(s.hoodTop).toBeUndefined();
    expect(s.rib?.hem).toBeDefined();
  });
});

describe('knit length', () => {
  it('hangs a centre-back length from the high shoulder, the back-neck drop longer', () => {
    const cb = normalizeGarment({ ...KNIT_HOODIE_SEED, chart: { ...KNIT_HOODIE_SEED.chart, definitions: { length: 'center_back', sleeve: 'center_back_to_cuff' } } });
    const hps = normalizeGarment(KNIT_HOODIE_SEED);
    const size = (x: typeof cb) => x.sizes.find((s) => s.label === 'L')!.measurements;
    const a = topShape(g, cb, size(cb), m.chestCm, m).right.hem.y;
    const b = topShape(g, hps, size(hps), m.chestCm, m).right.hem.y;
    expect(a).toBeGreaterThan(b);
  });

  it('falls back to the body width for the band when the chart has no hem band', () => {
    const noBand = normalizeGarment({
      ...KNIT_HOODIE_SEED,
      sizes: KNIT_HOODIE_SEED.sizes.map((s) => ({ ...s, measurements: { chest: s.measurements.chest, length: s.measurements.length, sleeve: s.measurements.sleeve } })),
    });
    const s = topShape(g, noBand, noBand.sizes[2]!.measurements, m.chestCm, m);
    expect(s.rib?.hem).toBeDefined();
    expect(s.right.hem.x).toBeGreaterThanOrEqual(bodyHalfAt(g, s.right.hem.y) + 0.3 - 1e-9);
  });
});
