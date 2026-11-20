import { describe, expect, it } from 'vitest';
import { chartDefinition, definitionOf, girthKnown, girthMethodOf, stretchOf } from './chart';
import { normalizeGarment } from './garments';
import type { SeedGarment } from './types';
import { validateChart, validateGarment, validateStretch } from './validate';
import { checkGarment, unscorableZones } from './verify';

const pants: SeedGarment = {
  id: 'test-pants',
  brand: 'Test',
  name: 'Pants',
  category: 'bottom',
  type: 'chinos',
  sizing: 'mens',
  color: '#333333',
  stretch: 'none',
  fitIntent: 'regular',
  chart: { unit: 'cm', girth: 'circumference' },
  source: { placeholder: false, tier: 'B', url: 'https://example.com', capturedOn: '2026-11-20' },
  sizes: [
    { label: '30', measurements: { waist: 78, hips: 98, inseam: 81 } },
    { label: '32', measurements: { waist: 83, hips: 103, inseam: 81 } },
  ],
};

describe('girth method per measurement', () => {
  const mixed: SeedGarment = {
    ...pants,
    chart: { unit: 'cm', girth: { default: 'circumference', hips: 'flat' } },
    sizes: [{ label: '30', measurements: { waist: 78, hips: 49, inseam: 81 } }],
  };

  it('doubles only the girths marked flat', () => {
    const g = normalizeGarment(mixed);
    expect(g.sizes[0]!.measurements).toEqual({ waist: 78, hips: 98, inseam: 81 });
    expect(g.sizes[0]!.provenance.hips!.conversions).toEqual(['flat width doubled to a full circumference']);
    expect(g.sizes[0]!.provenance.waist!.conversions).toEqual([]);
  });

  it('reads one method for every girth, or the default', () => {
    expect(girthMethodOf(pants.chart, 'hips')).toBe('circumference');
    expect(girthMethodOf(mixed.chart, 'hips')).toBe('flat');
    expect(girthMethodOf(mixed.chart, 'waist')).toBe('circumference');
  });

  it('leaves only the unknown girth unscorable', () => {
    const oneUnknown: SeedGarment = { ...pants, chart: { unit: 'cm', girth: { default: 'circumference', hips: 'unknown' } } };
    const g = normalizeGarment(oneUnknown);
    expect(g.girthVerified).toBe(false);
    expect(g.girthUnknown).toEqual(['hips']);
    expect(girthKnown(g, 'waist')).toBe(true);
    expect(girthKnown(g, 'hips')).toBe(false);
    expect(unscorableZones(oneUnknown).map((z) => z.key)).toEqual(['hips']);
  });

  it('keeps a one-method garment as before (no girthUnknown field)', () => {
    const g = normalizeGarment(pants);
    expect(g.girthVerified).toBe(true);
    expect('girthUnknown' in g).toBe(false);
    expect(girthKnown(g, 'hips')).toBe(true);
  });

  it('rejects a method that does not exist, a non-girth key, or a missing default', () => {
    expect(validateChart({ unit: 'cm', girth: 'half' as never })).toEqual(['chart.girth must be one of flat, circumference, unknown']);
    expect(validateChart({ unit: 'cm', girth: { default: 'flat', inseam: 'flat' } as never })).toEqual([
      'chart.girth: "inseam" isn\'t a girth',
    ]);
    expect(validateChart({ unit: 'cm', girth: { hips: 'flat' } as never })).toEqual(['a per-girth chart.girth needs a "default"']);
  });
});

describe('stretch per measurement', () => {
  const jogger: SeedGarment = { ...pants, type: 'joggers', stretch: { default: 'none', waist: 'high' } };

  it('keeps the default as the garment stretch and the rest as overrides', () => {
    const g = normalizeGarment(jogger);
    expect(g.stretch).toBe('none');
    expect(g.stretchByKey).toEqual({ waist: 'high' });
    expect(stretchOf(g, 'waist')).toBe('high');
    expect(stretchOf(g, 'hips')).toBe('none');
  });

  it('validates levels and keys', () => {
    expect(validateStretch('compression')).toEqual([]);
    expect(validateStretch('stretchy')).toEqual(['stretch must be one of none, some, high, compression']);
    expect(validateStretch({ default: 'none', ankle: 'high' })).toEqual(['stretch: "ankle" isn\'t a measurement']);
    expect(validateStretch({ waist: 'high' })).toEqual(['a per-measurement stretch needs a "default"']);
    expect(validateGarment(jogger)).toEqual([]);
  });
});

describe('definitions', () => {
  const tee: SeedGarment = {
    ...pants,
    category: 'top',
    type: 'tee',
    sleeve: 'long',
    chart: { unit: 'cm', girth: 'circumference', definitions: { length: 'hps', sleeve: 'shoulder_to_cuff' } },
    sizes: [{ label: 'M', measurements: { chest: 104, length: 72, sleeve: 63 } }],
  };

  it('reads definitions.length and .sleeve like the older fields', () => {
    expect(chartDefinition(tee.chart, 'length')).toBe('hps');
    const g = normalizeGarment(tee);
    expect(g.lengthDefinition).toBe('hps');
    expect(g.sleeveDefinition).toBe('shoulder_to_cuff');
    expect('definitions' in g).toBe(false);
    expect(checkGarment(tee).errors).toEqual([]);
    expect(unscorableZones(tee)).toEqual([]);
  });

  it('keeps other definitions on the garment', () => {
    const g = normalizeGarment({ ...pants, chart: { unit: 'cm', girth: 'circumference', definitions: { rise: 'front' } } });
    expect(g.definitions).toEqual({ rise: 'front' });
    expect(definitionOf(g, 'rise')).toBe('front');
    expect(definitionOf(g, 'thigh')).toBeUndefined();
  });

  it('rejects unknown definitions and values, and length given twice', () => {
    expect(validateChart({ unit: 'cm', girth: 'flat', definitions: { rise: 'side' as never } })).toEqual([
      'chart.definitions.rise must be one of front, back, total, unknown',
    ]);
    expect(validateChart({ unit: 'cm', girth: 'flat', definitions: { inseam: 'x' } as never })).toEqual([
      'chart.definitions: "inseam" isn\'t a definition',
    ]);
    expect(validateChart({ unit: 'cm', girth: 'flat', lengthDefinition: 'hps', definitions: { length: 'hps' } })).toEqual([
      'give length in chart.definitions or chart.lengthDefinition, not both',
    ]);
  });

  it('still keeps a top length off bottoms, in either spelling', () => {
    const row = { ...pants, chart: { unit: 'cm' as const, girth: 'circumference' as const, definitions: { length: 'hps' as const } } };
    expect(validateGarment(row)).toContain('bottoms have no top length: leave out chart.lengthDefinition');
  });
});
