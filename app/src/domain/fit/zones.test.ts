import { describe, expect, it } from 'vitest';
import { findGarment, normalizeGarment, type SeedGarment } from '../garments';
import { UNKNOWN_CHEST_SEED } from '../garments/testFixtures';
import { TOP_CHEST, TOP_LENGTH, WOMENS_TOP_CHEST, BOTTOM_HIPS } from './rules';
import { measurableKeys, ruleFor, templateZones, zoneRule, zoneSpecsFor } from './zones';

const tee = (extra: Partial<SeedGarment> = {}) => normalizeGarment({ ...UNKNOWN_CHEST_SEED, chart: { ...UNKNOWN_CHEST_SEED.chart, girth: 'flat' }, ...extra });
const zonesOf = (g: ReturnType<typeof tee>) => zoneSpecsFor(g, g.sizes[0]!.measurements).map((z) => z.zone);

describe('zones per template', () => {
  it('scores a short-sleeve tee on chest and length', () => {
    expect(zonesOf(tee())).toEqual(['chest', 'length']);
  });

  it('adds the sleeve on a long sleeve, and the waist when the size lists one', () => {
    expect(zonesOf(tee({ sleeve: 'long' }))).toEqual(['chest', 'length', 'sleeve']);
    const withWaist = tee({ sizes: [{ label: 'M', measurements: { chest: 44, waist: 42, length: 29 } }] });
    expect(zonesOf(withWaist)).toEqual(['chest', 'waist', 'length']);
  });

  it('scores pants on waist, hips and inseam', () => {
    const chino = findGarment('fieldline-slim-chino')!;
    expect(zonesOf(chino)).toEqual(['waist', 'hips', 'inseam']);
  });

  it("picks a top's chest rule by the garment's sizing", () => {
    const chest = templateZones(tee()).zones[0]!;
    expect(ruleFor(chest, { sizing: 'mens' })).toBe(TOP_CHEST);
    expect(ruleFor(chest, { sizing: 'unisex' })).toBe(TOP_CHEST);
    expect(ruleFor(chest, { sizing: 'womens' })).toBe(WOMENS_TOP_CHEST);
  });

  it('finds the rule for one zone, or null for a zone the template lacks', () => {
    expect(zoneRule(tee(), 'length')).toBe(TOP_LENGTH);
    expect(zoneRule(findGarment('fieldline-slim-chino')!, 'hips')).toBe(BOTTOM_HIPS);
    expect(zoneRule(tee(), 'inseam')).toBeNull();
  });

  it('gives tops a personal chest and length, and pants none', () => {
    expect(templateZones(tee()).personal).toEqual({ girth: 'chest', length: 'length' });
    expect(templateZones(findGarment('fieldline-slim-chino')!).personal).toBeNull();
  });
});

describe('measurableKeys', () => {
  it('lists the body measurements a garment is compared against', () => {
    expect(measurableKeys(tee())).toEqual(['chestCm']);
    expect(measurableKeys(findGarment('fieldline-oxford')!)).toEqual(['chestCm', 'waistCm']);
    expect(measurableKeys(findGarment('fieldline-slim-chino')!)).toEqual(['waistCm', 'hipsCm', 'inseamCm']);
  });
});
