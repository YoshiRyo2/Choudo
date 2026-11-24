import { describe, expect, it } from 'vitest';
import { categorySpec, templateOf } from './categories';
import { checkGarment } from './verify';
import { DRESS_SEED } from './testFixtures';
import type { SeedGarment } from './types';

const errors = (g: SeedGarment) => checkGarment(g).errors.map((e) => e.message);
const warnings = (g: SeedGarment) => checkGarment(g).warnings.map((w) => w.message);

describe('dress template', () => {
  it('is the dress template, worn in the onepiece slot', () => {
    expect(templateOf({ type: 'dress' })).toBe('dress');
    expect(categorySpec({ type: 'dress' }).category).toBe('onepiece');
  });

  it('passes a plausible dress', () => {
    expect(checkGarment(DRESS_SEED)).toMatchObject({ errors: [], warnings: [] });
  });

  it('needs short or long sleeves', () => {
    const { sleeve: _drop, ...noSleeve } = DRESS_SEED;
    expect(errors(noSleeve as SeedGarment)).toContain('a dress needs a sleeve type');
  });

  it('takes a waist seam only on a dress', () => {
    const skirt: SeedGarment = {
      ...DRESS_SEED,
      id: 'test-skirt-seam',
      category: 'bottom',
      type: 'skirt',
      sleeve: undefined,
      chart: { unit: 'cm', girth: 'circumference', definitions: { length: 'waist', waistSeam: 'natural' } },
      sizes: [{ label: 'M', measurements: { waist: 74, hips: 100, length: 60, hemSweep: 120 } }],
    };
    expect(errors(skirt)).toContain('only dresses give chart.definitions.waistSeam');
  });

  it('rejects a waist seam it doesn’t know', () => {
    const g = { ...DRESS_SEED, chart: { ...DRESS_SEED.chart, definitions: { length: 'hps', waistSeam: 'sideways' } } } as unknown as SeedGarment;
    expect(errors(g).join(' ')).toMatch(/waistSeam must be one of natural, empire, drop, none, unknown/);
  });

  it('warns on a waist wider than the hips', () => {
    const g: SeedGarment = { ...DRESS_SEED, sizes: [{ label: 'M', measurements: { chest: 94, waist: 104, hips: 102, length: 99 } }] };
    expect(warnings(g)).toContain('waist in M (104.0 cm) is wider than its hips (102.0 cm)');
  });
});
