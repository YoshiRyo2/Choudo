import { describe, expect, it } from 'vitest';
import { checkGarment } from './verify';
import { normalizeGarment } from './garments';
import { templateOf, CATEGORY_SPECS } from './categories';
import { buildReport, formatReport } from './report';
import { validateGarment } from './validate';
import { MEASUREMENT_KEYS } from './normalize';
import type { SeedGarment } from './types';

/** A legging chart printed like Sport-Tek's: inches, girths laid flat. */
const leggings = (size: Record<string, number> = {}, over: Partial<SeedGarment> = {}): SeedGarment => ({
  id: 'test-leggings',
  brand: 'Test',
  name: 'Leggings',
  category: 'bottom',
  type: 'leggings',
  sizing: 'womens',
  color: '#222222',
  stretch: 'compression',
  stretchAssumed: true,
  fitIntent: 'slim',
  chart: { unit: 'in', girth: 'flat' },
  source: { placeholder: true },
  sizes: [{ label: 'M', measurements: { waist: 15, hips: 16.75, inseam: 31, ...size } }],
  ...over,
});

const warnings = (g: SeedGarment) => checkGarment(g).warnings.map((w) => w.message);

describe('leggings garments', () => {
  it('use the leggings template, worn as a bottom', () => {
    expect(templateOf({ type: 'leggings' })).toBe('leggings');
    expect(CATEGORY_SPECS.leggings.category).toBe('bottom');
    expect(CATEGORY_SPECS.leggings.landmarks).toBeNull();
  });

  it('pass a plausible chart printed flat', () => {
    expect(checkGarment(leggings())).toMatchObject({ errors: [], warnings: [] });
  });

  it('take a calf girth, last in the key list, doubled when flat', () => {
    expect(MEASUREMENT_KEYS.at(-1)).toBe('calf');
    const g = normalizeGarment(leggings({ calf: 6, thigh: 9 }));
    expect(g.sizes[0]!.measurements.calf).toBeCloseTo(2 * 6 * 2.54);
  });

  it('keep an assumed stretch marked as assumed', () => {
    expect(normalizeGarment(leggings()).stretchAssumed).toBe(true);
    expect(normalizeGarment(leggings({}, { stretchAssumed: undefined })).stretchAssumed).toBeUndefined();
  });

  it('warn on a calf wider than the thigh', () => {
    expect(warnings(leggings({ calf: 10, thigh: 9 }))).toContain('calf in M (50.8 cm) is wider than its thigh (45.7 cm)');
  });

  it('warn on an inseam too short for leggings', () => {
    expect(warnings(leggings({ inseam: 8 }))).toContain('inseam in M is 20.3 cm, outside 30–85 cm');
  });

  it('are bottoms only', () => {
    expect(validateGarment(leggings({}, { category: 'top' }))).toContain('a leggings is a bottom, not a top');
  });

  it('say in the data report when the stretch is assumed', () => {
    const g = leggings();
    const text = formatReport(buildReport([g], () => false, () => ({ width: null, gitIgnored: false })));
    expect(text).toContain('  Stretch:  compression (assumed: the chart gives no stretch data)');
  });
});
