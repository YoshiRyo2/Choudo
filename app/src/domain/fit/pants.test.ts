import { describe, expect, it } from 'vitest';
import { estimateBody, type BodyMeasurements, type BodyModel } from '../body';
import { normalizeGarment, type SeedGarment } from '../garments';
import { fitGarment } from './fitEngine';
import { bandHeight, girthAtHeight, riseForBand } from './pants';

/** A women's body with round numbers, so the arithmetic is easy to follow. */
const m: BodyMeasurements = {
  ...estimateBody({ heightCm: 163, weightKg: 68, bodyType: 'womens' }).measurements,
  waistCm: 86,
  hipsCm: 102,
  waistHeightCm: 98,
  hipHeightCm: 83.5,
  frontRiseCm: 27.9,
  inseamCm: 78,
  thighCm: 61,
  heelAnkleCm: 31,
};
const model = (over: Partial<BodyMeasurements> = {}): BodyModel => {
  const base = estimateBody({ heightCm: 163, weightKg: 68, bodyType: 'womens' });
  return { ...base, measurements: { ...m, ...over } };
};

const jeanSeed = (over: Partial<SeedGarment> = {}, size: Record<string, number> = {}): SeedGarment => ({
  id: 'test-jean',
  brand: 'Test',
  name: 'Jean',
  category: 'bottom',
  type: 'jeans',
  sizing: 'womens',
  color: '#2b3f66',
  stretch: 'none',
  fitIntent: 'regular',
  chart: { unit: 'cm', girth: 'circumference', definitions: { rise: 'front', thigh: 'below_crotch_2_5cm' } },
  source: { placeholder: true },
  sizes: [{ label: '28', measurements: { waist: 88, hips: 104, inseam: 78, rise: 24.9, thigh: 64, knee: 40, legOpening: 38, ...size } }],
  ...over,
});
const jean = (over?: Partial<SeedGarment>, size?: Record<string, number>) => normalizeGarment(jeanSeed(over, size));
const zoneOf = (g: ReturnType<typeof jean>, zone: string, body = model()) =>
  fitGarment(body, g, '28').zones.find((z) => z.zone === zone)!;

describe('bandHeight', () => {
  it('sits at the navel without a rise', () => {
    expect(bandHeight(m, null)).toBe(98);
  });

  it('drops 0.71 cm per cm of rise short of your own', () => {
    expect(bandHeight(m, 24.9)).toBeCloseTo(98 - 0.71 * 3);
    expect(bandHeight(m, 30.9)).toBeCloseTo(98 + 0.71 * 3);
  });

  it("uses the men's ratio for a men's body", () => {
    expect(bandHeight({ ...m, bodyType: 'mens' }, 24.9)).toBeCloseTo(98 - 0.79 * 3);
  });
});

describe('girthAtHeight', () => {
  it('interpolates between navel and hip line', () => {
    expect(girthAtHeight(m, 90.75)).toBeCloseTo(94);
  });

  it('clamps outside them', () => {
    expect(girthAtHeight(m, 105)).toBe(86);
    expect(girthAtHeight(m, 70)).toBe(102);
  });

  it('is finite when the hip line is at or above the navel', () => {
    expect(girthAtHeight({ ...m, hipHeightCm: 98 }, 95)).toBe(86);
    expect(girthAtHeight({ ...m, hipHeightCm: 100 }, 99)).toBe(86);
    expect(Number.isFinite(bandHeight({ ...m, hipHeightCm: 100 }, 20))).toBe(true);
  });
});

describe('riseForBand', () => {
  it('reads the rise only when the chart says it is the front rise', () => {
    const g = jean();
    expect(riseForBand(g, g.sizes[0]!.measurements)).toBe(24.9);
    const back = jean({ chart: { unit: 'cm', girth: 'circumference', definitions: { rise: 'back' } } });
    expect(riseForBand(back, back.sizes[0]!.measurements)).toBeNull();
  });
});

describe('pants zones', () => {
  it('reports waist, hips, thigh, rise, inseam and leg opening, in that order', () => {
    expect(fitGarment(model(), jean(), '28').zones.map((z) => z.zone)).toEqual(['waist', 'hips', 'thigh', 'rise', 'inseam', 'legOpening']);
  });

  it('a low rise compares the waist lower on the body', () => {
    const waist = zoneOf(jean(), 'waist');
    expect(waist.bodyCm).toBeCloseTo(girthAtHeight(m, 98 - 0.71 * 3));
    expect(waist.bodyCm).toBeGreaterThan(86);
  });

  it('without a front-rise definition the waist is measured at the navel, as before', () => {
    const g = jean({ chart: { unit: 'cm', girth: 'circumference', definitions: { thigh: 'at_crotch' } } });
    const fit = fitGarment(model(), g, '28');
    expect(fit.zones.find((z) => z.zone === 'waist')!.bodyCm).toBe(86);
    expect(fit.zones.find((z) => z.zone === 'rise')!.label).toBe('unknown');
    expect(fit.overall).not.toBe('unknown');
  });

  it('a chart without thigh or leg opening still gets an overall result', () => {
    const g = normalizeGarment({ ...jeanSeed(), sizes: [{ label: '28', measurements: { waist: 88, hips: 104, inseam: 78 } }] });
    const fit = fitGarment(model(), g, '28');
    expect(fit.zones.filter((z) => z.label === 'unknown').map((z) => z.zone)).toEqual(['thigh', 'rise', 'legOpening']);
    expect(fit.overall).toBe('good');
  });

  it('scores the thigh against the body thigh', () => {
    const thigh = zoneOf(jean(), 'thigh');
    expect(thigh).toMatchObject({ kind: 'girth', bodyCm: 61, diffCm: 3, label: 'fitted' });
  });

  it('a thigh without a definition is unknown', () => {
    const g = jean({ chart: { unit: 'cm', girth: 'circumference', definitions: { rise: 'front' } } });
    expect(zoneOf(g, 'thigh').label).toBe('unknown');
  });

  it('a band below the hip line is bad (short)', () => {
    const rise = zoneOf(jean({}, { rise: 6 }), 'rise');
    expect(rise).toMatchObject({ label: 'short', tone: 'bad' });
    expect(fitGarment(model(), jean({}, { rise: 6 }), '28').overall).toBe('bad');
  });

  it('a narrow opening with no stretch and no zip is bad (tight)', () => {
    const opening = zoneOf(jean({}, { legOpening: 28 }), 'legOpening');
    expect(opening).toMatchObject({ label: 'tight', tone: 'bad', landing: 'skinny' });
  });

  it('the same opening with some stretch, or with an ankle zip, is not blocked', () => {
    expect(zoneOf(jean({ stretch: 'some' }, { legOpening: 28 }), 'legOpening')).toMatchObject({ label: 'noted', landing: 'skinny' });
    expect(zoneOf(jean({ ankleZip: true }, { legOpening: 28 }), 'legOpening').label).toBe('noted');
    expect(zoneOf(jean({ stretch: { default: 'none', legOpening: 'some' } }, { legOpening: 28 }), 'legOpening').label).toBe('noted');
  });

  it('marks the rise low, mid or high against your own front rise', () => {
    expect(zoneOf(jean({}, { rise: 20 }), 'rise').landing).toBe('low');
    expect(zoneOf(jean({}, { rise: 24.9 }), 'rise').landing).toBe('mid');
    expect(zoneOf(jean({}, { rise: 27.9 }), 'rise').landing).toBe('high');
  });

  it('marks the leg opening skinny, slim, straight or wide against your heel', () => {
    const at = (legOpening: number) => zoneOf(jean({ stretch: 'some' }, { legOpening }), 'legOpening').landing;
    expect([at(29), at(33), at(39), at(47)]).toEqual(['skinny', 'slim', 'straight', 'wide']);
  });
});
