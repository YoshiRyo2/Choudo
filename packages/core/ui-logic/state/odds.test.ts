import { describe, expect, it } from 'vitest';
import { estimateBody } from '../../domain/body';
import { preferenceSpec, sampleFit } from '../../domain/fit';
import { JACKET, KNIT_HOODIE } from '../../domain/garments/testFixtures';
import { findGarment } from '../../domain/garments';
import { cachedOdds, garmentOdds } from './odds';

describe('garmentOdds', () => {
  it('keeps bare and layered odds apart in the cache', () => {
    const body = estimateBody({ heightCm: 176, weightKg: 85, bodyType: 'mens' });
    const spec = preferenceSpec(null, null);
    const under = { garment: KNIT_HOODIE, sizeLabel: 'XL' };
    expect(garmentOdds(body, JACKET, spec)).toEqual(sampleFit(body, JACKET, spec));
    expect(garmentOdds(body, JACKET, spec, under)).toEqual(sampleFit(body, JACKET, spec, { under }));
    expect(garmentOdds(body, JACKET, spec, under)).not.toEqual(garmentOdds(body, JACKET, spec));
  });
});

describe('cachedOdds', () => {
  it('gives odds already worked out, and nothing (without sampling) for ones that are not', () => {
    const body = estimateBody({ heightCm: 163, weightKg: 58, bodyType: 'womens' });
    const tee = findGarment('gildan-5000')!;
    const spec = preferenceSpec(null, 'relaxed');
    expect(cachedOdds(body, tee, spec)).toBeUndefined();
    const odds = garmentOdds(body, tee, spec);
    expect(cachedOdds(body, tee, spec)).toBe(odds);
  });
});
