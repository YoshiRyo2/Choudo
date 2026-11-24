import { describe, expect, it } from 'vitest';
import { estimateBody } from '../body';
import { DRESS, DRESS_SEED, JACKET_SEED } from '../garments/testFixtures';
import { normalizeGarment, type SeedGarment } from '../garments';
import { dressHemHeight, dressSeamHeight, hpsToKneeCm } from './dress';
import { fitGarment } from './fitEngine';
import { layerAllowanceCm } from './layers';
import { fitOutfit } from './outfit';
import { preferenceSpec } from './preference';
import { recommendSize, sampleFit } from './sampleFit';
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

describe('dress zones', () => {
  const model = estimateBody({ heightCm: 163, weightKg: 68, bodyType: 'womens' });
  const m = model.measurements;
  /** One size cut round this body: bust +5, waist +6, hips +6, HPS length 99, a full hem. */
  const fitted = (over: Record<string, number> = {}, defs: Record<string, string> = { length: 'hps', waistSeam: 'natural' }) =>
    withDefs(defs, [
      { label: 'M', measurements: { chest: m.chestCm + 5, waist: m.waistCm + 6, hips: m.hipsCm + 6, length: 99, hemSweep: 160, ...over } },
    ]);
  const zones = (g: typeof DRESS) => fitGarment(model, g, 'M').zones;
  const zone = (g: typeof DRESS, id: string) => zones(g).find((z) => z.zone === id)!;

  it('scores bust, waist, hips, hem and walking room, in that order (no short sleeve)', () => {
    expect(zones(fitted()).map((z) => z.zone)).toEqual(['chest', 'waist', 'hips', 'length', 'walkingRoom']);
  });

  it('lands the hem by HPS length against HPS to knee, with the skirt marks', () => {
    const z = zone(fitted(), 'length');
    expect(z.kind).toBe('landing');
    expect(z.diffCm).toBeCloseTo(99 - hpsToKneeCm(m), 6);
    expect(['mini', 'above-knee', 'knee', 'midi', 'maxi']).toContain(z.landing);
  });

  it('lands a centre-back length as its HPS length', () => {
    const cb = fitted({ length: 97 }, { length: 'center_back', waistSeam: 'natural' });
    expect(zone(cb, 'length').diffCm).toBeCloseTo(99 - hpsToKneeCm(m), 6);
  });

  it('compares the waist at the navel for a sheath with no seam', () => {
    const z = zone(fitted({}, { length: 'hps', waistSeam: 'none' }), 'waist');
    expect(z.bodyCm).toBe(m.waistCm);
    expect(z.label).not.toBe('unknown');
  });

  it('leaves an empire waist unscored but still sizes the dress', () => {
    const g = fitted({}, { length: 'hps', waistSeam: 'empire' });
    const z = zone(g, 'waist');
    expect(z.label).toBe('unknown');
    expect(z.note).toMatch(/under the bust/);
    expect(fitGarment(model, g, 'M').overall).not.toBe('unknown');
    expect(recommendSize(model, g, preferenceSpec(null, null))).toBe('M');
  });

  it('says so when the chart doesn’t place the seam', () => {
    expect(zone(fitted({}, { length: 'hps' }), 'waist').note).toMatch(/doesn’t say where the waist seam is/);
  });

  it('sizes a dress with no waist or hip rows on its bust', () => {
    const g = withDefs({ length: 'hps', waistSeam: 'natural' }, [{ label: 'M', measurements: { chest: m.chestCm + 5, length: 99, hemSweep: 160 } }]);
    expect(fitGarment(model, g, 'M').overall).not.toBe('unknown');
    // Like a top's waist, a waist or hips the chart doesn't list isn't reported.
    expect(zones(g).map((z) => z.zone)).toEqual(['chest', 'length', 'walkingRoom']);
  });

  it('scores a charted shoulder and a long sleeve', () => {
    const g = normalizeGarment({
      ...DRESS_SEED,
      sleeve: 'long',
      chart: { ...DRESS_SEED.chart, definitions: { length: 'hps', sleeve: 'shoulder_to_cuff', waistSeam: 'natural' } },
      sizes: [{ label: 'M', measurements: { chest: m.chestCm + 5, shoulder: m.shoulderWidthCm, sleeve: m.armLengthCm, length: 99 } }],
    } as SeedGarment);
    const ids = zones(g).map((z) => z.zone);
    expect(ids).toContain('shoulder');
    expect(ids).toContain('sleeve');
  });

  it('is too tight with a bust 10 cm under the body', () => {
    const g = fitted({ chest: m.chestCm - 10 });
    expect(zone(g, 'chest').label).toBe('tight');
    expect(fitGarment(model, g, 'M').overall).toBe('bad');
  });

  it('samples odds for every size', () => {
    const odds = sampleFit(model, DRESS, preferenceSpec(null, null), { samples: 50 });
    for (const s of odds.sizes) {
      const total = Object.values(s.verdicts).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1, 6);
    }
  });
});

describe('a jacket over a dress', () => {
  const model = estimateBody({ heightCm: 163, weightKg: 68, bodyType: 'womens' });
  const jacket = normalizeGarment({ ...JACKET_SEED, sizing: 'womens' });
  /** DRESS in XL: its bust well past fitted, so some of that room stays under a jacket. */
  const dressXL = { garment: DRESS, sizeLabel: 'XL' };

  it('fits the dress bare and the jacket over it', () => {
    const out = fitOutfit(model, { onepiece: dressXL, outer: { garment: jacket, sizeLabel: 'L' } });
    expect(out.onepiece).toEqual(fitGarment(model, DRESS, 'XL'));
    expect(out.outer).toEqual(fitGarment(model, jacket, 'L', dressXL));
    expect(out.outer!.over).toEqual({ garmentId: DRESS.id, type: 'dress' });
  });

  it('never notes the dress hem showing below the jacket', () => {
    const notes = fitOutfit(model, { onepiece: dressXL, outer: { garment: jacket, sizeLabel: 'S' } }).notes;
    expect(notes.some((n) => n.kind === 'hem-shows')).toBe(false);
  });

  it('counts the dress’s spare bust room under the jacket', () => {
    expect(layerAllowanceCm(model.measurements, dressXL).chestCm).toBeGreaterThan(0);
  });
});

describe('a dress whose chart doesn’t say where length is measured', () => {
  const model = estimateBody({ heightCm: 163, weightKg: 68, bodyType: 'womens' });
  const g = withDefs({ length: 'unknown', waistSeam: 'natural' });

  it('leaves the hem unscored and has no walking room to guess at', () => {
    const zones = fitGarment(model, g, 'M').zones;
    expect(zones.find((z) => z.zone === 'length')!.label).toBe('unknown');
    expect(zones.some((z) => z.zone === 'walkingRoom')).toBe(false);
  });
});
