import { describe, expect, it } from 'vitest';
import { estimateBody, type BodyModel } from '../body';
import { JACKET, KNIT_HOODIE } from '../garments/testFixtures';
import { layerAllowanceCm } from './layers';
import { preferenceSpec } from './preference';
import { measurementHint, recommendSize, sampleFit } from './sampleFit';

const body = estimateBody({ heightCm: 176, weightKg: 85, bodyType: 'mens' });
const spec = preferenceSpec(null, null);
const shifted = (b: BodyModel, chestCm: number): BodyModel => ({ ...b, measurements: { ...b.measurements, chestCm: b.measurements.chestCm + chestCm } });

describe('sampleFit over a layer', () => {
  it('without a layer, draws exactly as before', () => {
    expect(sampleFit(body, JACKET, spec, { under: undefined })).toEqual(sampleFit(body, JACKET, spec));
  });

  it('adds the layer to each drawn body, leaving every other draw where it was', () => {
    // Hoodie S has no spare ease on this body in any draw, so the layer adds a constant 1.5 cm:
    // the same as drawing the jacket on a body 1.5 cm fuller in the chest.
    const under = { garment: KNIT_HOODIE, sizeLabel: 'S' };
    expect(layerAllowanceCm(body.measurements, under).chestCm).toBeCloseTo(1.5, 9);
    const layered = sampleFit(body, JACKET, spec, { under });
    const fuller = sampleFit(shifted(body, 1.5), JACKET, spec);
    expect(layered.sizes.map((s) => s.verdicts)).toEqual(fuller.sizes.map((s) => s.verdicts));
    expect(layered.recommended).toBe(fuller.recommended);
  });

  it('is seeded, and a roomy hoodie moves the odds towards roomier sizes', () => {
    const under = { garment: KNIT_HOODIE, sizeLabel: 'XL' };
    const a = sampleFit(body, JACKET, spec, { under });
    expect(sampleFit(body, JACKET, spec, { under })).toEqual(a);
    const bare = sampleFit(body, JACKET, spec);
    const tightOdds = (o: typeof a) => o.sizes.find((s) => s.sizeLabel === 'S')!.verdicts['too-tight'];
    expect(tightOdds(a)).toBeGreaterThan(tightOdds(bare));
  });

  it('passes the layer through recommendSize and measurementHint', () => {
    const under = { garment: KNIT_HOODIE, sizeLabel: 'XL' };
    expect(recommendSize(body, JACKET, spec, { under })).toBe(sampleFit(body, JACKET, spec, { under }).recommended);
    const hint = measurementHint(body, JACKET, spec, { under });
    const bareHint = measurementHint(body, JACKET, spec);
    expect(hint === null || hint.key === 'chestCm').toBe(true);
    expect(bareHint === null || bareHint.key === 'chestCm').toBe(true);
  });
});
