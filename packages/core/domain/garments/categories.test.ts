import { describe, expect, it } from 'vitest';
import { CATEGORY_SPECS, categorySpec, GARMENT_TYPES, isGarmentType, templateOf, TYPE_TEMPLATE } from './categories';
import { SEED_GARMENTS } from './garments';
import type { SeedGarment } from './types';
import { validateGarment } from './validate';
import { UNKNOWN_CHEST_SEED } from './testFixtures';

describe('garment templates', () => {
  it('gives every type a template whose spec names it', () => {
    for (const type of GARMENT_TYPES) {
      expect(CATEGORY_SPECS[TYPE_TEMPLATE[type]].template).toBe(TYPE_TEMPLATE[type]);
    }
  });

  it("puts every seed row in its template's category", () => {
    for (const g of SEED_GARMENTS) expect(categorySpec(g).category).toBe(g.category);
  });

  it('maps tees, polos and long sleeves to tee, button-ups to shirt, and every bottom to pants', () => {
    expect(['tee', 'long-sleeve-tee', 'polo'].map((type) => templateOf({ type: type as SeedGarment['type'] }))).toEqual(['tee', 'tee', 'tee']);
    expect(templateOf({ type: 'button-up' })).toBe('shirt');
    expect(['jeans', 'chinos', 'joggers', 'trousers'].map((type) => templateOf({ type: type as SeedGarment['type'] }))).toEqual([
      'pants',
      'pants',
      'pants',
      'pants',
    ]);
  });

  it('knows which strings are garment types', () => {
    expect(isGarmentType('jeans')).toBe(true);
    expect(isGarmentType('cape')).toBe(false);
    expect(isGarmentType('toString')).toBe(false);
  });
});

describe('validateGarment with templates', () => {
  it('stops at an unknown type', () => {
    const row = { ...UNKNOWN_CHEST_SEED, type: 'cape' } as unknown as SeedGarment;
    expect(validateGarment(row)).toEqual([`type must be one of ${GARMENT_TYPES.join(', ')}`]);
  });

  it("flags a category that isn't the type's", () => {
    const row: SeedGarment = { ...UNKNOWN_CHEST_SEED, category: 'bottom' };
    expect(validateGarment(row)).toContain('a tee is a top, not a bottom');
  });

  it("reads a template's required measurements", () => {
    const row: SeedGarment = { ...UNKNOWN_CHEST_SEED, sizes: [{ label: 'M', measurements: { chest: 44 } }] };
    expect(validateGarment(row)).toContain('size M: missing length');
  });
});

describe('ankle zip', () => {
  it('is a problem on a top, fine on pants', () => {
    expect(validateGarment({ ...UNKNOWN_CHEST_SEED, ankleZip: true })).toContain("tops can't have an ankle zip");
    const jeans = SEED_GARMENTS.find((g) => g.id === 'corvo-slim-jean')!;
    expect(validateGarment({ ...jeans, ankleZip: true })).toEqual([]);
  });
});
