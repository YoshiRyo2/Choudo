import { describe, expect, it } from 'vitest';
import {
  GARMENTS,
  findGarment,
  garmentsByCategory,
  normalizeGarment,
  seedGarmentsForTesting,
  validateSeed,
} from './garments';
import type { SeedGarment } from './types';

const base: SeedGarment = {
  id: 'test-tee',
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
  sizes: [{ label: 'M', measurements: { chest: 19, length: 28 } }],
};

describe('seed.json', () => {
  it('passes validation', () => {
    expect(validateSeed(seedGarmentsForTesting)).toEqual([]);
  });

  it('has about six tops and six bottoms from 2+ brands', () => {
    expect(garmentsByCategory('top').length).toBeGreaterThanOrEqual(6);
    expect(garmentsByCategory('bottom').length).toBeGreaterThanOrEqual(6);
    expect(new Set(GARMENTS.map((g) => g.brand)).size).toBeGreaterThanOrEqual(2);
  });

  it('keeps the real Knightweave row identical to data/tees.csv (M: 20 in flat chest)', () => {
    const kw = findGarment('knightweave-tee');
    const m = kw?.sizes.find((s) => s.label === 'M');
    expect(kw?.source.placeholder).toBe(false);
    expect(m?.measurements.chest).toBeCloseTo(40 * 2.54); // 20 flat -> 40 in -> 101.6 cm
    expect(m?.measurements.length).toBeCloseTo(29 * 2.54);
  });

  it('marks the Lands’ End chest as unverified', () => {
    expect(findGarment('landsend-super-t')?.girthVerified).toBe(false);
  });
});

describe('normalizeGarment', () => {
  it('doubles flat girths and converts inches to cm', () => {
    const g = normalizeGarment(base);
    expect(g.sizes[0]?.measurements.chest).toBeCloseTo(96.52); // 19 flat = 38 in
    expect(g.sizes[0]?.measurements.length).toBeCloseTo(71.12);
    expect(g.girthVerified).toBe(true);
  });

  it('passes circumference cm values through', () => {
    const g = normalizeGarment({
      ...base,
      chart: { unit: 'cm', girth: 'circumference' },
      sizes: [{ label: 'M', measurements: { chest: 100, length: 70 } }],
    });
    expect(g.sizes[0]?.measurements).toEqual({ chest: 100, length: 70 });
  });

  it('does not double an unknown-method girth and marks it unverified', () => {
    const g = normalizeGarment({ ...base, chart: { unit: 'in', girth: 'unknown' } });
    expect(g.sizes[0]?.measurements.chest).toBeCloseTo(19 * 2.54);
    expect(g.girthVerified).toBe(false);
  });
});

describe('validateSeed', () => {
  it('flags missing required measurements', () => {
    const bad = { ...base, sizes: [{ label: 'M', measurements: { chest: 19 } }] };
    expect(validateSeed([bad])).toEqual(['garment "test-tee" size M: missing length']);
  });

  it('flags real data without a source url', () => {
    const bad = { ...base, source: { placeholder: false } };
    expect(validateSeed([bad])).toContain(
      'garment "test-tee": real (non-placeholder) data must cite a source url',
    );
  });

  it('flags duplicate ids and size labels', () => {
    const dupSizes = { ...base, sizes: [...base.sizes, ...base.sizes] };
    const problems = validateSeed([dupSizes, base]);
    expect(problems).toContain('garment "test-tee" size M: duplicate size label');
    expect(problems).toContain('garment "test-tee": duplicate id');
  });

  it('flags non-positive numbers', () => {
    const bad = { ...base, sizes: [{ label: 'M', measurements: { chest: -1, length: 28 } }] };
    expect(validateSeed([bad])).toContain('garment "test-tee" size M: chest must be a positive number');
  });
});
