import { describe, expect, it } from 'vitest';
import { estimateBody, type BodyMeasurements, type BodyModel } from '../body';
import { normalizeGarment, type SeedGarment } from '../garments';
import { fitGarment } from './fitEngine';
import { crotchToKneeCm } from './shorts';

/** A women's body with round numbers: 78 cm crotch height, knee at 48 cm, so 30 cm crotch to knee. */
const m: BodyMeasurements = {
  ...estimateBody({ heightCm: 163, weightKg: 68, bodyType: 'womens' }).measurements,
  waistCm: 86,
  hipsCm: 102,
  waistHeightCm: 98,
  hipHeightCm: 83.5,
  frontRiseCm: 27.9,
  inseamCm: 78,
  kneeHeightCm: 48,
  thighCm: 61,
};
const body: BodyModel = { ...estimateBody({ heightCm: 163, weightKg: 68, bodyType: 'womens' }), measurements: m };

const shortsSeed = (inseam: number): SeedGarment => ({
  id: 'test-shorts',
  brand: 'Test',
  name: 'Shorts',
  category: 'bottom',
  type: 'shorts',
  sizing: 'womens',
  color: '#c2a878',
  stretch: 'none',
  fitIntent: 'regular',
  chart: { unit: 'cm', girth: 'circumference', definitions: { rise: 'front', thigh: 'at_crotch' } },
  source: { placeholder: true },
  sizes: [{ label: 'M', measurements: { waist: 90, hips: 106, inseam, rise: 26, thigh: 66, legOpening: 62 } }],
});
const fit = (inseam: number) => fitGarment(body, normalizeGarment(shortsSeed(inseam)), 'M');
const inseamZone = (inseam: number) => fit(inseam).zones.find((z) => z.zone === 'inseam')!;

describe('crotchToKneeCm', () => {
  it('is the crotch height less the knee height', () => {
    expect(crotchToKneeCm(m)).toBe(30);
  });
});

describe('shorts zones', () => {
  it('are the pants girths and rise, with the inseam last and no leg opening', () => {
    expect(fit(14).zones.map((z) => z.zone)).toEqual(['waist', 'hips', 'thigh', 'rise', 'inseam']);
  });

  it('measure the inseam as a landing against the crotch-to-knee distance', () => {
    const z = inseamZone(14);
    expect(z.kind).toBe('landing');
    expect(z.bodyCm).toBe(30);
    expect(z.bodyAt).toBe('knee');
    expect(z.diffCm).toBe(-16);
  });

  it('land mid-thigh, above the knee or at the knee by inseam', () => {
    expect(inseamZone(14).landing).toBe('mid-thigh');
    expect(inseamZone(23).landing).toBe('above-knee');
    expect(inseamZone(30).landing).toBe('knee');
    // Past the knee still reads "knee": shorts have no lower mark.
    expect(inseamZone(36).landing).toBe('knee');
  });

  it('never let where the hem lands decide the size', () => {
    expect(fit(14).overall).toBe(fit(30).overall);
    expect(fit(14).overall).toBe('good');
  });
});
