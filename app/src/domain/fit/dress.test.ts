import { describe, expect, it } from 'vitest';
import { estimateBody } from '../body';
import { DRESS, DRESS_SEED } from '../garments/testFixtures';
import { normalizeGarment, type SeedGarment } from '../garments';
import { dressHemHeight, dressSeamHeight, hpsToKneeCm } from './dress';
import { hpsHeightCm } from './tops';

const woman = estimateBody({ heightCm: 163, weightKg: 68, bodyType: 'womens' }).measurements;
const sizeOf = (g: typeof DRESS, label: string) => g.sizes.find((s) => s.label === label)!.measurements;
const withDefs = (defs: Record<string, string>, sizes = DRESS_SEED.sizes): typeof DRESS =>
  normalizeGarment({ ...DRESS_SEED, chart: { ...DRESS_SEED.chart, definitions: defs }, sizes } as SeedGarment);

describe('where a dress sits on the body', () => {
  it('puts the high point of the shoulder at 0.835 of height', () => {
    expect(hpsHeightCm({ heightCm: 200 })).toBe(167);
  });

  it('hangs the hem its HPS length below the high point of the shoulder', () => {
    expect(dressHemHeight(woman, DRESS, sizeOf(DRESS, 'M'))).toBeCloseTo(hpsHeightCm(woman) - 99, 6);
  });

  it('reads a centre-back length 2 cm longer from the shoulder', () => {
    const cb = withDefs({ length: 'center_back', waistSeam: 'natural' }, [{ label: 'M', measurements: { chest: 94, length: 97 } }]);
    expect(dressHemHeight(woman, cb, sizeOf(cb, 'M'))).toBeCloseTo(hpsHeightCm(woman) - 99, 6);
  });

  it('puts the seam at the navel, whatever the seam', () => {
    for (const waistSeam of ['natural', 'none', 'empire']) {
      expect(dressSeamHeight(woman, withDefs({ length: 'hps', waistSeam }))).toBe(woman.waistHeightCm);
    }
  });

  it('measures HPS to knee', () => {
    expect(hpsToKneeCm(woman)).toBeCloseTo(hpsHeightCm(woman) - woman.kneeHeightCm, 6);
  });

  it('lets a long dress on a short body end below the floor', () => {
    const short = estimateBody({ heightCm: 150, weightKg: 50, bodyType: 'womens' }).measurements;
    const long = withDefs({ length: 'hps' }, [{ label: 'M', measurements: { chest: 90, length: 140 } }]);
    expect(dressHemHeight(short, long, sizeOf(long, 'M'))).toBeLessThan(0);
  });
});
