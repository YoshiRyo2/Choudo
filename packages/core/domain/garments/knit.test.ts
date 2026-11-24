import { describe, expect, it } from 'vitest';
import { CATEGORY_SPECS, templateOf, weightOf } from './categories';
import { KNIT_HOODIE, KNIT_HOODIE_SEED, UNKNOWN_CHEST_SEED } from './testFixtures';
import { MEASUREMENT_KEYS } from './normalize';
import type { GarmentImage, SeedGarment } from './types';
import { validateGarment, validateImage } from './validate';

describe('knit template', () => {
  it('maps hoodies, sweatshirts, sweaters and cardigans to knit, worn as a top', () => {
    for (const type of ['hoodie', 'sweatshirt', 'sweater', 'cardigan'] as const) expect(templateOf({ type })).toBe('knit');
    expect(CATEGORY_SPECS.knit.category).toBe('top');
  });

  it('accepts a hoodie row', () => {
    expect(validateGarment(KNIT_HOODIE_SEED)).toEqual([]);
  });
});

describe('hem band', () => {
  it('is a girth: a flat hem band is doubled, and it comes after the pants keys', () => {
    const l = KNIT_HOODIE.sizes.find((s) => s.label === 'L')!;
    expect(l.measurements.hemBand).toBeCloseTo(20.5 * 2 * 2.54, 6);
    expect(l.provenance.hemBand?.conversions).toEqual(['flat width doubled to a full circumference', 'inches to cm']);
    expect(MEASUREMENT_KEYS.indexOf('hemBand')).toBe(MEASUREMENT_KEYS.indexOf('legOpening') + 1);
  });
});

describe('weight', () => {
  it('defaults by template: knits mid, tees light', () => {
    expect(weightOf(KNIT_HOODIE_SEED)).toBe('mid');
    expect(weightOf(UNKNOWN_CHEST_SEED)).toBe('light');
  });

  it('reads a weight the row gives', () => {
    expect(weightOf({ ...KNIT_HOODIE_SEED, weight: 'heavy' })).toBe('heavy');
  });

  it('is copied onto the normalized garment only when the row gives one', () => {
    expect('weight' in KNIT_HOODIE).toBe(false);
  });

  it('rejects a weight that is not light, mid or heavy', () => {
    const row = { ...KNIT_HOODIE_SEED, weight: 'bulky' } as unknown as SeedGarment;
    expect(validateGarment(row)).toContain('weight must be one of light, mid, heavy');
  });
});

describe('hoodTop landmark', () => {
  const top: GarmentImage['landmarks'] = {
    collarLeft: { x: 40, y: 10 }, collarRight: { x: 60, y: 10 }, neckFront: { x: 50, y: 15 },
    shoulderLeft: { x: 20, y: 14 }, shoulderRight: { x: 80, y: 14 },
    armpitLeft: { x: 25, y: 40 }, armpitRight: { x: 75, y: 40 },
    hemLeft: { x: 25, y: 90 }, hemRight: { x: 75, y: 90 },
    sleeveOuterLeft: { x: 5, y: 60 }, sleeveInnerLeft: { x: 15, y: 62 },
    sleeveOuterRight: { x: 95, y: 60 }, sleeveInnerRight: { x: 85, y: 62 },
  };
  const image = (landmarks: GarmentImage['landmarks']): GarmentImage => ({
    file: 'garments/x.png',
    licence: 'own',
    photographedSize: null,
    landmarks,
  });

  it('is optional on a knit, and may be given', () => {
    expect(validateImage(image(top), KNIT_HOODIE_SEED)).toEqual([]);
    expect(validateImage(image({ ...top, hoodTop: { x: 50, y: 2 } }), KNIT_HOODIE_SEED)).toEqual([]);
  });

  it('must sit above the collar', () => {
    expect(validateImage(image({ ...top, hoodTop: { x: 50, y: 30 } }), KNIT_HOODIE_SEED)).toContain(
      'hoodTop must sit above the collar points',
    );
  });

  it("isn't a tee landmark", () => {
    expect(validateImage(image({ ...top, hoodTop: { x: 50, y: 2 } }), UNKNOWN_CHEST_SEED)).toContain(
      "hoodTop isn't a landmark for a tee",
    );
  });
});
