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

describe('garment photos', () => {
  const photo = {
    file: 'garments/test-front.png',
    photographedSize: 'M',
    landmarks: {
      collarLeft: { x: 380, y: 60 },
      collarRight: { x: 620, y: 60 },
      neckFront: { x: 500, y: 120 },
      shoulderLeft: { x: 230, y: 110 },
      shoulderRight: { x: 770, y: 110 },
      armpitLeft: { x: 260, y: 360 },
      armpitRight: { x: 740, y: 360 },
      hemLeft: { x: 265, y: 980 },
      hemRight: { x: 735, y: 980 },
      sleeveOuterLeft: { x: 120, y: 420 },
      sleeveInnerLeft: { x: 220, y: 470 },
      sleeveOuterRight: { x: 880, y: 420 },
      sleeveInnerRight: { x: 780, y: 470 },
    },
  };

  it('accepts a complete photo entry', () => {
    expect(validateSeed([{ ...base, image: photo }])).toEqual([]);
  });

  it('is optional', () => {
    expect(validateSeed([base])).toEqual([]);
  });

  it('allows an unknown photographed size', () => {
    expect(validateSeed([{ ...base, image: { ...photo, photographedSize: null } }])).toEqual([]);
  });

  it('rejects remote files, unknown sizes and missing landmarks', () => {
    const { hemRight: _dropped, ...partial } = photo.landmarks;
    const problems = validateSeed([
      {
        ...base,
        image: {
          file: 'https://example.com/tee.png',
          photographedSize: 'XXL',
          landmarks: partial as typeof photo.landmarks,
        },
      },
    ]);
    expect(problems.join('\n')).toMatch(/file must be/);
    expect(problems.join('\n')).toMatch(/photographedSize "XXL"/);
    expect(problems.join('\n')).toMatch(/hemRight/);
  });

  it('rejects landmarks that are swapped or out of order', () => {
    const swapped = {
      ...photo.landmarks,
      collarLeft: photo.landmarks.collarRight,
      collarRight: photo.landmarks.collarLeft,
      hemLeft: { x: 265, y: 100 },
      neckFront: { x: 500, y: 40 },
      sleeveOuterRight: { x: 700, y: 420 },
    };
    const problems = validateSeed([{ ...base, image: { ...photo, landmarks: swapped } }]).join('\n');
    expect(problems).toMatch(/collarLeft must be left of collarRight/);
    expect(problems).toMatch(/left side must run/);
    expect(problems).toMatch(/right sleeve opening/);
    expect(problems).toMatch(/neckFront must sit between/);
  });
});
