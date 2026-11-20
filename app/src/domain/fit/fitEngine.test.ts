import { describe, expect, it } from 'vitest';
import { estimateBody, type BodyModel } from '../body';
import { findGarment, normalizeGarment, type Garment, type SeedGarment } from '../garments';
import { cmToIn, inToCm } from '../units';
import { fitAllSizes, fitGarment, labelGirth, labelLength } from './fitEngine';
import { BOTTOM_WAIST, INSEAM, TOP_CHEST, WOMENS_TOP_CHEST } from './rules';
import { UNKNOWN_CHEST_TEE } from '../garments/testFixtures';

/** A body with exact, entered measurements so tests don't depend on the estimator. */
function bodyWith(m: Partial<BodyModel['measurements']>): BodyModel {
  const model = estimateBody({ heightCm: 176, weightKg: 85, bodyType: 'mens' });
  return { ...model, measurements: { ...model.measurements, ...m } };
}

const seedTeeBase: SeedGarment = {
  id: 'tee',
  brand: 'Test',
  name: 'Tee',
  category: 'top',
  type: 'tee',
  sizing: 'mens',
  color: '#000000',
  sleeve: 'short',
  stretch: 'none',
  fitIntent: 'regular',
  chart: { unit: 'in', girth: 'flat', lengthDefinition: 'hps' },
  source: { placeholder: true },
  sizes: [],
};

/** A one-size tee with the given flat chest width in inches. */
function seedTee(chestFlatIn: number): Garment {
  return normalizeGarment({
    ...seedTeeBase,
    sizes: [{ label: 'M', measurements: { chest: chestFlatIn, length: 29 } }],
  });
}

const chestOf = (fit: ReturnType<typeof fitGarment>) => fit.zones.find((z) => z.zone === 'chest')!;

describe('women’s top thresholds (by the garment’s sizing)', () => {
  it.each([
    [-1.01, 'tight'],
    [-1.0, 'fitted'],
    [1.0, 'fitted'],
    [1.01, 'relaxed'],
    [3.0, 'relaxed'],
    [3.01, 'loose'],
  ] as const)('ease %s in -> %s', (easeIn, expected) => {
    expect(labelGirth(inToCm(easeIn), WOMENS_TOP_CHEST)).toBe(expected);
  });

  it('runs closer to the body than men’s, which are unchanged', () => {
    expect(WOMENS_TOP_CHEST.fittedMax).toBeLessThan(TOP_CHEST.fittedMax);
    expect(WOMENS_TOP_CHEST.relaxedMax).toBeLessThan(TOP_CHEST.relaxedMax);
    expect(WOMENS_TOP_CHEST.tightBelow).toBe(TOP_CHEST.tightBelow);
    expect(cmToIn(TOP_CHEST.tightBelow)).toBeCloseTo(-1);
    expect(cmToIn(TOP_CHEST.fittedMax)).toBeCloseTo(2);
    expect(cmToIn(TOP_CHEST.relaxedMax)).toBeCloseTo(4);
  });

  it('a women’s tee uses them; a unisex tee keeps the men’s on any body', () => {
    // 1.5 in of ease: relaxed in a women’s cut, fitted in a men’s or unisex one.
    const womens = estimateBody({ heightCm: 165, weightKg: 60, bodyType: 'womens', overrides: { chestCm: inToCm(36) } });
    const tee = (sizing: 'womens' | 'unisex' | 'mens') =>
      normalizeGarment({ ...seedTeeBase, sizing, sizes: [{ label: 'M', measurements: { chest: 18.75, length: 25 } }] });
    expect(chestOf(fitGarment(womens, tee('womens'), 'M')).label).toBe('relaxed');
    expect(chestOf(fitGarment(womens, tee('unisex'), 'M')).label).toBe('fitted');
    expect(chestOf(fitGarment(womens, tee('mens'), 'M')).label).toBe('fitted');
    expect(fitGarment(womens, tee('womens'), 'M').bodyType).toBe('womens');
  });
});

describe('girth labels (ported from tests/test_fit.py)', () => {
  // Same boundaries as the Python suite, which works in inches.
  it.each([
    [-1.01, 'tight'],
    [-1.0, 'fitted'],
    [0.0, 'fitted'],
    [2.0, 'fitted'],
    [2.01, 'relaxed'],
    [4.0, 'relaxed'],
    [4.01, 'loose'],
  ] as const)('ease %s in -> %s', (easeIn, expected) => {
    expect(labelGirth(inToCm(easeIn), TOP_CHEST)).toBe(expected);
  });

  // test_worked_examples: 38 in body chest against flat chart values.
  it.each([
    [19, 'fitted'], // garment 38, ease 0
    [17, 'tight'], // garment 34, ease -4
    [18, 'tight'], // garment 36, ease -2
    [18.5, 'fitted'], // garment 37, ease -1
  ] as const)('%s in flat on a 38 in chest -> %s', (flat, expected) => {
    const fit = fitGarment(bodyWith({ chestCm: inToCm(38) }), seedTee(flat), 'M');
    expect(chestOf(fit).label).toBe(expected);
  });

  it('lets stretch fabric sit under the body without being tight', () => {
    expect(labelGirth(-4, BOTTOM_WAIST)).toBe('tight');
    expect(labelGirth(-4, BOTTOM_WAIST, 0.04 * 90)).toBe('fitted');
  });
});

describe('length labels', () => {
  it('uses short / good / long around the thresholds', () => {
    expect(labelLength(-2.6, INSEAM)).toBe('short');
    expect(labelLength(-2.5, INSEAM)).toBe('good');
    expect(labelLength(3, INSEAM)).toBe('good');
    expect(labelLength(3.1, INSEAM)).toBe('long');
  });
});

describe('fitGarment', () => {
  const body = bodyWith({
    chestCm: inToCm(38),
    torsoLengthCm: 72,
    armLengthCm: 62,
    waistCm: 84,
    hipsCm: 100,
    inseamCm: 80,
  });

  it('reports cm differences per zone for a real tee (Knightweave M)', () => {
    const fit = fitGarment(body, findGarment('knightweave-tee')!, 'M');
    expect(fit.zones.map((z) => z.zone)).toEqual(['chest', 'length']); // short sleeve: not scored
    const chest = chestOf(fit);
    expect(chest.diffCm).toBeCloseTo(inToCm(2)); // 20 flat = 40 in vs 38 in
    expect(chest.label).toBe('fitted');
    const length = fit.zones[1]!;
    expect(length.diffCm).toBeCloseTo(inToCm(29) - 72);
    expect(length.label).toBe('good');
    expect(fit.overall).toBe('good');
  });

  it('scores the Lands’ End chest as a full circumference, not doubled', () => {
    const chest = chestOf(fitGarment(body, findGarment('landsend-super-t')!, 'M'));
    expect(chest.diffCm).toBeCloseTo(inToCm(44 - 38));
    expect(chest.label).toBe('loose');
  });

  it('never guesses an unverified chest', () => {
    const fit = fitGarment(body, UNKNOWN_CHEST_TEE, 'M');
    const chest = chestOf(fit);
    expect(chest.label).toBe('unknown');
    expect(chest.diffCm).toBeNull();
    expect(chest.note).toMatch(/flat or all the way round/);
    expect(fit.zones.find((z) => z.zone === 'length')?.label).not.toBe('unknown');
    // A good length alone must not make the size look like a good fit.
    expect(fit.overall).toBe('unknown');
  });

  it('scores waist and sleeve when a long-sleeve shirt lists them', () => {
    const fit = fitGarment(body, findGarment('fieldline-oxford')!, 'M');
    expect(fit.zones.map((z) => z.zone)).toEqual(['chest', 'waist', 'length', 'sleeve']);
    expect(fit.zones.every((z) => z.diffCm !== null)).toBe(true);
  });

  it('scores waist, hips and inseam for bottoms, and the leg zones the chart allows', () => {
    const fit = fitGarment(body, findGarment('corvo-slim-jean')!, '32x30');
    expect(fit.zones.map((z) => [z.zone, z.label])).toEqual([
      ['waist', 'fitted'], // 84 vs 84
      ['hips', 'fitted'], // 100 vs 100
      ['thigh', 'unknown'], // no thigh on the chart
      ['rise', 'unknown'], // a rise, but not said to be the front rise
      ['inseam', 'short'], // 76 vs 80
      ['legOpening', 'unknown'],
    ]);
  });

  it('flags a much-too-short length as bad, a little short as warn', () => {
    const jean = findGarment('corvo-slim-jean')!;
    const tall = bodyWith({ waistCm: 84, hipsCm: 100, inseamCm: 88 });
    expect(fitGarment(body, jean, '32x30').overall).toBe('warn'); // 4 cm short
    expect(fitGarment(tall, jean, '32x30').overall).toBe('bad'); // 12 cm short
  });

  it('carries the body source through so the UI can show confidence', () => {
    const measured = estimateBody({
      heightCm: 176,
      weightKg: 85,
      bodyType: 'mens',
      overrides: { chestCm: 96 },
    });
    const fit = fitGarment(measured, findGarment('knightweave-tee')!, 'M');
    expect(chestOf(fit).bodySource).toBe('entered');
    expect(fit.zones[1]?.bodySource).toBe('estimated');
  });

  it('returns bands that agree with the label for every zone', () => {
    for (const id of ['knightweave-tee', 'fieldline-oxford', 'fieldline-jogger', 'corvo-slim-jean']) {
      const g = findGarment(id)!;
      for (const fit of fitAllSizes(body, g)) {
        for (const z of fit.zones) {
          if (z.diffCm === null) continue;
          const band = z.bands.find((b) => z.diffCm! >= b.from && z.diffCm! <= b.to);
          expect(band?.label, `${id} ${fit.sizeLabel} ${z.zone}`).toBe(z.label);
          expect(band?.tone).toBe(z.tone);
        }
      }
    }
  });

  it('only scores a top length measured from the high point of the shoulder', () => {
    const body = bodyWith({ chestCm: inToCm(38), torsoLengthCm: 72 });
    const lengthOf = (def: 'hps' | 'center_back' | 'unknown') => {
      const tee = normalizeGarment({
        ...seedTeeBase,
        chart: { ...seedTeeBase.chart, lengthDefinition: def },
        sizes: [{ label: 'M', measurements: { chest: 19, length: 29 } }],
      });
      return fitGarment(body, tee, 'M').zones.find((z) => z.zone === 'length')!;
    };
    expect(lengthOf('hps').label).not.toBe('unknown');
    expect(lengthOf('center_back')).toMatchObject({ label: 'unknown', diffCm: null });
    expect(lengthOf('center_back').note).toMatch(/back of the neck/);
    expect(lengthOf('unknown').note).toMatch(/doesn't say where length/);
  });

  it('passes each zone the origin of the garment number', () => {
    const tee = normalizeGarment({
      ...seedTeeBase,
      sizes: [{ label: 'M', measurements: { chest: 19, length: { value: 29, origin: 'estimated', how: 'test' } } }],
    });
    const fit = fitGarment(bodyWith({}), tee, 'M');
    expect(fit.zones.find((z) => z.zone === 'chest')?.garmentOrigin).toBe('chart');
    expect(fit.zones.find((z) => z.zone === 'length')?.garmentOrigin).toBe('estimated');
  });

  it('throws for a size the garment does not have', () => {
    expect(() => fitGarment(body, findGarment('knightweave-tee')!, 'XXXL')).toThrow();
  });

  it('runs for every garment and size in the seed without unknown required zones on placeholder data', () => {
    const avg = estimateBody({ heightCm: 176, weightKg: 85, bodyType: 'mens' });
    for (const id of ['fieldline-boxy-tee', 'fieldline-jogger', 'corvo-relaxed-jean']) {
      for (const fit of fitAllSizes(avg, findGarment(id)!)) {
        expect(fit.zones.every((z) => z.optional || z.label !== 'unknown')).toBe(true);
      }
    }
  });
});
