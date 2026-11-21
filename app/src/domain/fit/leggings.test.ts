import { describe, expect, it } from 'vitest';
import { estimateBody, type BodyMeasurements, type BodyModel } from '../body';
import { normalizeGarment, type SeedGarment, type Stretch, type StretchByKey } from '../garments';
import { fitGarment } from './fitEngine';
import { crotchToAnkleCm, leggingsHemHeight } from './leggings';
import { preferenceSpec } from './preference';
import { recommendSize } from './sampleFit';

/** A women's body with round numbers: waist 80 at the navel, hips 100, crotch 78, ankle bone 6.3 up. */
const m: BodyMeasurements = {
  ...estimateBody({ heightCm: 163, weightKg: 68, bodyType: 'womens' }).measurements,
  waistCm: 80,
  hipsCm: 100,
  thighCm: 60,
  calfCm: 36,
  inseamCm: 78,
  ankleHeightCm: 6.3,
};
const body: BodyModel = { ...estimateBody({ heightCm: 163, weightKg: 68, bodyType: 'womens' }), measurements: m };

const leggingsSeed = (size: Record<string, number> = {}, stretch: Stretch | StretchByKey = 'compression'): SeedGarment => ({
  id: 'test-leggings',
  brand: 'Test',
  name: 'Leggings',
  category: 'bottom',
  type: 'leggings',
  sizing: 'womens',
  color: '#222222',
  stretch,
  fitIntent: 'slim',
  chart: { unit: 'cm', girth: 'circumference', definitions: { thigh: 'at_crotch' } },
  source: { placeholder: true },
  sizes: [{ label: 'M', measurements: { waist: 78, hips: 90, inseam: 63.5, ...size } }],
});
const leggings = (size?: Record<string, number>, stretch?: Stretch | StretchByKey) => normalizeGarment(leggingsSeed(size, stretch));
const fit = (size?: Record<string, number>, stretch?: Stretch | StretchByKey) => fitGarment(body, leggings(size, stretch), 'M');
const zone = (size: Record<string, number> | undefined, name: string, stretch?: Stretch | StretchByKey) =>
  fit(size, stretch).zones.find((z) => z.zone === name)!;

describe('leggings heights', () => {
  it('crotch to ankle bone is what a full-length inseam is set against', () => {
    expect(crotchToAnkleCm(m)).toBeCloseTo(71.7);
  });

  it('the hem sits the inseam below the crotch', () => {
    expect(leggingsHemHeight(m, { inseam: 63.5 })).toBeCloseTo(14.5);
    expect(leggingsHemHeight(m, {})).toBeNull();
  });
});

describe('leggings zones', () => {
  it('are waist, hips, thigh, calf and length, in that order', () => {
    expect(fit({ thigh: 54, calf: 32 }).zones.map((z) => z.zone)).toEqual(['waist', 'hips', 'thigh', 'calf', 'inseam']);
  });

  it('read hips as a share of the body, meant to sit under it', () => {
    expect(zone({ hips: 90 }, 'hips').label).toBe('fitted'); // −10 %
    expect(zone({ hips: 80 }, 'hips').label).toBe('tight'); // −20 %
    expect(zone({ hips: 102 }, 'hips').label).toBe('relaxed'); // +2 %
    expect(zone({ hips: 105 }, 'hips').label).toBe('loose'); // +5 %
  });

  it('start "tight" sooner on a legging with less stretch', () => {
    expect(zone({ hips: 85 }, 'hips', 'compression').label).toBe('fitted'); // −15 %
    expect(zone({ hips: 85 }, 'hips', 'high').label).toBe('tight');
  });

  it('take stretch per zone from the garment', () => {
    expect(zone({ hips: 90 }, 'hips', { default: 'compression', hips: 'some' }).label).toBe('tight');
    expect(zone({ hips: 90, thigh: 54 }, 'thigh', { default: 'compression', hips: 'some' }).label).toBe('fitted');
  });

  it('score the calf against the body calf', () => {
    const calf = zone({ calf: 32 }, 'calf');
    expect(calf.bodyCm).toBe(36);
    expect(calf.label).toBe('fitted'); // −11 %
  });

  it('give the waistband less to squeeze than the leg', () => {
    expect(zone({ waist: 78 }, 'waist').label).toBe('fitted'); // −2.5 %
    expect(zone({ waist: 70 }, 'waist').label).toBe('tight'); // −12.5 %
  });

  it('leave a thigh or calf off the chart unscored without making the size unknown', () => {
    const f = fit();
    expect(f.zones.find((z) => z.zone === 'thigh')!.label).toBe('unknown');
    expect(f.zones.find((z) => z.zone === 'calf')!.label).toBe('unknown');
    expect(f.overall).toBe('good');
  });

  it('make the size unknown without hips, and suggest a size by the waist alone (as pants do)', () => {
    const g = normalizeGarment({
      ...leggingsSeed(),
      sizes: [
        { label: 'S', measurements: { waist: 70, inseam: 63.5 } },
        { label: 'M', measurements: { waist: 80, inseam: 63.5 } },
        { label: 'L', measurements: { waist: 90, inseam: 63.5 } },
      ],
    });
    expect(fitGarment(body, g, 'M').overall).toBe('unknown');
    expect(recommendSize(body, g, preferenceSpec(null, null))).toBe('M');
  });

  it('suggest no size when no girth is charted', () => {
    const g = normalizeGarment({ ...leggingsSeed(), sizes: [{ label: 'M', measurements: { inseam: 63.5 } }] });
    expect(recommendSize(body, g, preferenceSpec(null, null))).toBeNull();
  });
});

describe('leggings length', () => {
  const landing = (inseam: number) => zone({ inseam }, 'inseam');

  it('lands at the ankle, 7/8 or capri against crotch-to-ankle', () => {
    expect(landing(71).landing).toBe('ankle');
    expect(landing(63.5).landing).toBe('7/8');
    expect(landing(50).landing).toBe('capri');
  });

  it('warns when it runs well past the ankle bone, but never decides the size', () => {
    const z = landing(78);
    expect(z.landing).toBe('stacked');
    expect(z.tone).toBe('warn');
    expect(fit({ inseam: 78 }).overall).toBe('good');
  });

  it('says where it was measured to', () => {
    expect(landing(63.5)).toMatchObject({ bodyAt: 'ankle', bodyCm: expect.closeTo(71.7) });
  });
});
