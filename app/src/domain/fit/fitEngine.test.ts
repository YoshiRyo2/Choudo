import { describe, expect, it } from 'vitest';
import { estimateBody, type BodyModel } from '../body';
import { findGarment, normalizeGarment, type Garment, type SeedGarment } from '../garments';
import { inToCm } from '../units';
import { fitAllSizes, fitGarment, labelGirth, labelLength, recommendSize } from './fitEngine';
import { BOTTOM_WAIST, INSEAM, TOP_CHEST } from './rules';

/** A body with exact, entered measurements so tests don't depend on the estimator. */
function bodyWith(m: Partial<BodyModel['measurements']>): BodyModel {
  const model = estimateBody({ heightCm: 176, weightKg: 85, sizing: 'mens' });
  return { ...model, measurements: { ...model.measurements, ...m } };
}

const seedTeeBase: SeedGarment = {
  id: 'tee',
  brand: 'Test',
  name: 'Tee',
  category: 'top',
  type: 'tee',
  sizing: 'mens',
  image: null,
  color: '#000000',
  sleeve: 'short',
  stretch: 'none',
  chart: { unit: 'in', girth: 'flat' },
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

  it('never guesses an unverified chest (Lands’ End)', () => {
    const fit = fitGarment(body, findGarment('landsend-super-t')!, 'M');
    const chest = chestOf(fit);
    expect(chest.label).toBe('unknown');
    expect(chest.diffCm).toBeNull();
    expect(chest.note).toMatch(/flat or all the way round/);
    expect(fit.zones.find((z) => z.zone === 'length')?.label).not.toBe('unknown');
  });

  it('scores waist and sleeve when a long-sleeve shirt lists them', () => {
    const fit = fitGarment(body, findGarment('fieldline-oxford')!, 'M');
    expect(fit.zones.map((z) => z.zone)).toEqual(['chest', 'waist', 'length', 'sleeve']);
    expect(fit.zones.every((z) => z.diffCm !== null)).toBe(true);
  });

  it('scores waist, hips and inseam for bottoms', () => {
    const fit = fitGarment(body, findGarment('corvo-slim-jean')!, '32x30');
    expect(fit.zones.map((z) => [z.zone, z.label])).toEqual([
      ['waist', 'fitted'], // 84 vs 84
      ['hips', 'fitted'], // 100 vs 100
      ['inseam', 'short'], // 76 vs 80
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
      sizing: 'mens',
      overrides: { chestCm: 96 },
    });
    const fit = fitGarment(measured, findGarment('knightweave-tee')!, 'M');
    expect(chestOf(fit).bodySource).toBe('entered');
    expect(fit.zones[1]?.bodySource).toBe('estimated');
  });

  it('throws for a size the garment does not have', () => {
    expect(() => fitGarment(body, findGarment('knightweave-tee')!, 'XXXL')).toThrow();
  });

  it('runs for every garment and size in the seed without unknowns on placeholder data', () => {
    const avg = estimateBody({ heightCm: 176, weightKg: 85, sizing: 'mens' });
    for (const id of ['fieldline-boxy-tee', 'fieldline-jogger', 'corvo-relaxed-jean']) {
      for (const fit of fitAllSizes(avg, findGarment(id)!)) {
        expect(fit.zones.every((z) => z.label !== 'unknown')).toBe(true);
      }
    }
  });
});

describe('recommendSize', () => {
  it('picks the Knightweave size closest to ~1 in of chest ease', () => {
    const body = bodyWith({ chestCm: inToCm(38), torsoLengthCm: 72 });
    expect(recommendSize(body, findGarment('knightweave-tee')!)).toBe('M');
    // L is 44 in: exactly 1 in of ease on a 43 in chest. XL (48 in) would be loose.
    const bigger = bodyWith({ chestCm: inToCm(43), torsoLengthCm: 76 });
    expect(recommendSize(bigger, findGarment('knightweave-tee')!)).toBe('L');
  });

  it('skips tight sizes and picks the matching inseam', () => {
    const jean = findGarment('corvo-slim-jean')!;
    const body = bodyWith({ waistCm: 83, hipsCm: 99, inseamCm: 81 });
    // 30x32 has 95 cm hips on a 99 cm seat: tight even with stretch.
    const small = fitGarment(body, jean, '30x32');
    expect(small.zones.find((z) => z.zone === 'hips')?.label).toBe('tight');
    // 32x30 fits the waist but is 5 cm short; 32x32 matches the inseam.
    expect(recommendSize(body, jean)).toBe('32x32');
  });

  it('breaks a tie toward the roomier size', () => {
    // S and M miss the ideal ease (1 in) by the same 3 cm, S under and M over.
    const tee = normalizeGarment({
      ...seedTeeBase,
      chart: { unit: 'cm', girth: 'circumference' },
      sizes: [
        { label: 'S', measurements: { chest: 100, length: 72 } },
        { label: 'M', measurements: { chest: 106, length: 72 } },
      ],
    });
    const body = bodyWith({ chestCm: 100 - TOP_CHEST.ideal + 3, torsoLengthCm: 71 });
    expect(recommendSize(body, tee)).toBe('M');
  });

  it('returns null when no girth can be scored (unverified chart)', () => {
    const body = bodyWith({ chestCm: 100 });
    expect(recommendSize(body, findGarment('landsend-super-t')!)).toBeNull();
  });
});
