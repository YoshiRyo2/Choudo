import { describe, expect, it } from 'vitest';
import { estimateBody } from '@choudo/core/domain/body';
import { GARMENTS } from '@choudo/core/domain/garments';
import { bodyGeometry } from '../geometry';
import { topShape } from '../topShape';

/**
 * Every tee and shirt in the seed, every size, on two bodies: the knit template
 * reuses topShape, so these must not move. Taken before the knit change.
 */
describe('tee and shirt drawings stay as they were', () => {
  const bodies = [
    estimateBody({ heightCm: 176, weightKg: 85, bodyType: 'mens' }),
    estimateBody({ heightCm: 163, weightKg: 68, bodyType: 'womens' }),
  ];
  const tops = GARMENTS.filter((g) => g.category === 'top' && !['hoodie', 'sweatshirt', 'sweater', 'cardigan'].includes(g.type));
  for (const body of bodies) {
    const m = body.measurements;
    const g = bodyGeometry(m);
    for (const garment of tops) {
      it(`${garment.id} on ${m.bodyType} ${m.heightCm}/${m.weightKg}`, () => {
        const shapes = garment.sizes.map((s) => topShape(g, garment, s.measurements, m.chestCm, m));
        expect(JSON.stringify(shapes)).toMatchSnapshot();
      });
    }
  }
});
