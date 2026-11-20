import { describe, expect, it } from 'vitest';
import { checkGarment } from './verify';
import { normalizeGarment } from './garments';
import type { SeedGarment } from './types';

const shorts = (size: Record<string, number> = {}, over: Partial<SeedGarment> = {}): SeedGarment => ({
  id: 'test-shorts',
  brand: 'Test',
  name: 'Shorts',
  category: 'bottom',
  type: 'shorts',
  sizing: 'mens',
  color: '#c2a878',
  stretch: 'none',
  fitIntent: 'regular',
  chart: { unit: 'cm', girth: 'circumference', definitions: { rise: 'front', thigh: 'at_crotch' } },
  source: { placeholder: true },
  sizes: [{ label: 'M', measurements: { waist: 84, hips: 108, inseam: 18, rise: 28, thigh: 64, legOpening: 60, ...size } }],
  ...over,
});

const skirt = (size: Record<string, number> = {}, chart: Partial<SeedGarment['chart']> = {}): SeedGarment => ({
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
  sizes: [{ label: 'M', measurements: { waist: 74, hips: 100, length: 60, hemSweep: 120, ...size } }],
});

const warnings = (g: SeedGarment) => checkGarment(g).warnings.map((w) => w.message);
const errors = (g: SeedGarment) => checkGarment(g).errors.map((e) => e.message);

describe('shorts checks', () => {
  it('pass a plausible pair', () => {
    expect(checkGarment(shorts())).toMatchObject({ errors: [], warnings: [] });
  });

  it('warn on an inseam long enough to be trousers', () => {
    expect(warnings(shorts({ inseam: 60 }))).toContain('inseam in M is 60.0 cm, outside 5–35 cm');
  });

  it('warn on a leg opening wider than the thigh', () => {
    expect(warnings(shorts({ legOpening: 70 }))).toContain('legOpening in M (70.0 cm) is wider than its thigh (64.0 cm)');
  });

  it('list a rise that isn’t the front rise as unscorable, as pants do', () => {
    const g = shorts({}, { chart: { unit: 'cm', girth: 'circumference', definitions: { rise: 'back' } } });
    expect(checkGarment(g).unscorable).toContainEqual({ key: 'rise', reason: 'rise isn’t the front rise', required: false });
  });
});

describe('skirt checks', () => {
  it('pass a plausible skirt', () => {
    expect(checkGarment(skirt())).toMatchObject({ errors: [], warnings: [] });
  });

  it('need a length definition', () => {
    expect(errors(skirt({}, { definitions: { waist: 'mid' } }))).toContain('a skirt needs chart.lengthDefinition (waist, unknown)');
  });

  it('grade unscored when the length definition is unknown', () => {
    expect(normalizeGarment(skirt({}, { definitions: { length: 'unknown' } })).grade).toBe('unscored');
  });

  it('warn on a waist wider than the hips', () => {
    expect(warnings(skirt({ waist: 104 }))).toContain('waist in M (104.0 cm) is wider than its hips (100.0 cm)');
  });

  it('error on a flat sweep that reads like a full circumference', () => {
    expect(errors(skirt({ hemSweep: 130 }, { girth: 'flat' }))).toContain(
      'hemSweep is marked flat, but 130.0 cm–130.0 cm as printed looks like a full circumference',
    );
  });

  it('warn on a hip point outside 5–30 cm or below the hem', () => {
    expect(warnings(skirt({}, { hipsBelowWaist: 40 }))).toContain('hipsBelowWaist is 40.0 cm, outside 5–30 cm');
    expect(warnings(skirt({ length: 15 }, { hipsBelowWaist: 18 }))).toContain('hipsBelowWaist (18.0 cm) is below the hem of M (15.0 cm long)');
  });
});

describe('length definitions by template', () => {
  it('don’t let a top measure length from the waist', () => {
    const tee: SeedGarment = {
      ...skirt(),
      type: 'tee',
      category: 'top',
      sleeve: 'short',
      chart: { unit: 'cm', girth: 'flat', lengthDefinition: 'waist' },
      sizes: [{ label: 'M', measurements: { chest: 52, length: 72 } }],
    };
    expect(errors(tee)).toContain('tops need chart.lengthDefinition (hps, center_back, unknown)');
  });

  it('only let skirts give a hip point', () => {
    expect(errors(shorts({}, { chart: { unit: 'cm', girth: 'circumference', hipsBelowWaist: 18 } }))).toContain(
      'only skirts give chart.hipsBelowWaist',
    );
    expect(errors(skirt({}, { hipsBelowWaist: -3 }))).toContain('chart.hipsBelowWaist must be a positive number');
  });
});
