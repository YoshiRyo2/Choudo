import { describe, expect, it } from 'vitest';
import { estimateBody, type BodyMeasurements, type BodyModel } from '../body';
import { normalizeGarment, type SeedGarment, type WaistDefinition } from '../garments';
import { fitGarment } from './fitEngine';
import { girthAtHeight } from './pants';
import { legGirthAt, skirtBandHeight, skirtHemHeight, skirtHipHeight, STRIDE_ANGLE_DEG, strideGirthCm } from './skirt';

/** A women's body with round numbers: navel 98, hip line 83.5, crotch 78, knee 48. */
const m: BodyMeasurements = {
  ...estimateBody({ heightCm: 163, weightKg: 68, bodyType: 'womens' }).measurements,
  waistCm: 86,
  hipsCm: 102,
  waistHeightCm: 98,
  hipHeightCm: 83.5,
  inseamCm: 78,
  kneeHeightCm: 48,
  thighCm: 61,
  kneeCm: 40,
  calfCm: 36,
};
const body: BodyModel = { ...estimateBody({ heightCm: 163, weightKg: 68, bodyType: 'womens' }), measurements: m };

const skirtSeed = (
  size: Record<string, number> = {},
  chart: Partial<SeedGarment['chart']> = {},
): SeedGarment => ({
  id: 'test-skirt',
  brand: 'Test',
  name: 'Skirt',
  category: 'bottom',
  type: 'skirt',
  sizing: 'womens',
  color: '#7a3b4f',
  stretch: 'none',
  fitIntent: 'regular',
  chart: { unit: 'cm', girth: 'circumference', definitions: { length: 'waist', waist: 'mid' }, ...chart },
  source: { placeholder: true },
  sizes: [{ label: 'M', measurements: { waist: 92, hips: 106, length: 60, hemSweep: 120, ...size } }],
});
const skirt = (size?: Record<string, number>, chart?: Partial<SeedGarment['chart']>) => normalizeGarment(skirtSeed(size, chart));
const zoneOf = (g: ReturnType<typeof skirt>, zone: string) => fitGarment(body, g, 'M').zones.find((z) => z.zone === zone)!;
const withWaist = (waist: WaistDefinition | undefined) =>
  skirt({}, { definitions: waist === undefined ? { length: 'waist' } : { length: 'waist', waist } });

describe('skirtBandHeight', () => {
  it('sits at the navel for a natural waist, lower for mid and low', () => {
    expect(skirtBandHeight(m, withWaist('natural'))).toBe(98);
    expect(skirtBandHeight(m, withWaist('mid'))).toBe(94);
    expect(skirtBandHeight(m, withWaist('low'))).toBe(90);
  });

  it('sits at the navel when the chart does not say, as pants without a rise', () => {
    expect(skirtBandHeight(m, withWaist(undefined))).toBe(98);
    expect(skirtBandHeight(m, withWaist('unknown'))).toBe(98);
  });
});

describe('skirtHipHeight', () => {
  it('is the chart’s distance below the band', () => {
    expect(skirtHipHeight(m, skirt({}, { hipsBelowWaist: 18 }))).toBe(76);
  });

  it('is the body’s hip line when the chart gives no distance', () => {
    expect(skirtHipHeight(m, skirt())).toBe(83.5);
  });

  it('converts an inch distance to cm', () => {
    expect(skirtHipHeight(m, skirt({}, { unit: 'in', hipsBelowWaist: 7 }))).toBeCloseTo(94 - 7 * 2.54);
  });
});

describe('skirtHemHeight', () => {
  it('is the band less the length', () => {
    const g = skirt();
    expect(skirtHemHeight(m, g, g.sizes[0]!.measurements)).toBe(34);
  });
});

describe('legGirthAt', () => {
  it('runs from the thigh at the crotch to the knee girth at the knee, then the calf', () => {
    expect(legGirthAt(m, 78)).toBe(61);
    expect(legGirthAt(m, 48)).toBe(40);
    expect(legGirthAt(m, 63)).toBeCloseTo(50.5);
    expect(legGirthAt(m, 30)).toBe(36);
  });
});

describe('strideGirthCm', () => {
  const sagittal = (d: number) => 2 * d * Math.sin(((STRIDE_ANGLE_DEG / 2) * Math.PI) / 180);

  it('is both legs side by side at the crotch, where there is no stride', () => {
    expect(strideGirthCm(m, 78)).toBeCloseTo(61 + (2 * 61) / Math.PI);
  });

  it('wraps both legs a stride apart lower down', () => {
    expect(strideGirthCm(m, 48)).toBeCloseTo(40 + 2 * Math.hypot(40 / Math.PI, sagittal(30)));
  });

  it('grows the further below the crotch the hem is', () => {
    expect(strideGirthCm(m, 20)).toBeGreaterThan(strideGirthCm(m, 48));
  });

  it('is the body’s own girth above the crotch (a micro mini has no stride to allow for)', () => {
    expect(strideGirthCm(m, 85)).toBeCloseTo(girthAtHeight(m, 85));
  });
});

describe('skirt zones', () => {
  it('are waist, hips, length and walking room', () => {
    expect(fitGarment(body, skirt(), 'M').zones.map((z) => z.zone)).toEqual(['waist', 'hips', 'length', 'walkingRoom']);
  });

  it('compare the waist where the band sits', () => {
    const z = zoneOf(skirt(), 'waist');
    expect(z.bodyCm).toBeCloseTo(girthAtHeight(m, 94));
    expect(z.bodyAt).toBe('band');
  });

  it('compare the hips at the chart’s hip point, or the full hips without one', () => {
    const at = zoneOf(skirt({}, { hipsBelowWaist: 10 }), 'hips');
    expect(at.bodyCm).toBeCloseTo(girthAtHeight(m, 84));
    expect(at.bodyAt).toBe('hip_point');
    expect(zoneOf(skirt(), 'hips').bodyCm).toBe(102);
  });

  it('land the hem against the knee: mini, above knee, knee, midi, maxi', () => {
    // Band at 94, knee at 48: a 46 cm skirt ends at the knee.
    const landing = (length: number) => zoneOf(skirt({ length }), 'length');
    expect(landing(46).bodyCm).toBe(46);
    expect(landing(46).bodyAt).toBe('knee');
    expect(landing(46).kind).toBe('landing');
    expect(landing(28).landing).toBe('mini');
    expect(landing(36).landing).toBe('above-knee');
    expect(landing(46).landing).toBe('knee');
    expect(landing(60).landing).toBe('midi');
    expect(landing(80).landing).toBe('maxi');
  });

  it('can’t place the hem when the chart doesn’t measure length from the waist', () => {
    const z = zoneOf(skirt({}, { definitions: { waist: 'mid', length: 'unknown' } }), 'length');
    expect(z.label).toBe('unknown');
  });

  it('warn when the hem is too narrow to stride in, but never decide the size on it', () => {
    const pencil = skirt({ length: 46, hemSweep: 80 });
    const z = zoneOf(pencil, 'walkingRoom');
    expect(z.kind).toBe('landing');
    expect(z.bodyAt).toBe('stride');
    expect(z.landing).toBe('restricted');
    expect(z.tone).toBe('warn');
    expect(zoneOf(skirt({ length: 46, hemSweep: 130 }), 'walkingRoom').landing).toBe('free');
    expect(fitGarment(body, pencil, 'M').overall).toBe(fitGarment(body, skirt({ length: 46, hemSweep: 130 }), 'M').overall);
  });

  it('leave walking room unscored, not the size, when the chart has no sweep', () => {
    const g = skirt({ hemSweep: undefined as unknown as number });
    const z = zoneOf(g, 'walkingRoom');
    expect(z.label).toBe('unknown');
    expect(z.optional).toBe(true);
    expect(fitGarment(body, g, 'M').overall).not.toBe('unknown');
  });
});
