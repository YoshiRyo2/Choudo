import { describe, expect, it } from 'vitest';
import { estimateBody } from '../../domain/body';
import { preferenceSpec, sampleFit } from '../../domain/fit';
import { JACKET, KNIT_HOODIE } from '../../domain/garments/testFixtures';
import { garmentOdds } from './odds';

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
