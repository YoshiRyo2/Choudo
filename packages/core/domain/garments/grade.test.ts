import { describe, expect, it } from 'vitest';
import { findGarment } from './garments';
import { gradeGarment, hasEstimatedValues } from './grade';
import type { SeedGarment } from './types';
import { checkGarment, type GarmentCheck } from './verify';
import { UNKNOWN_CHEST_TEE } from './testFixtures';

const real: SeedGarment = {
  id: 'tee',
  brand: 'Test',
  name: 'Tee',
  category: 'top',
  type: 'tee',
  sizing: 'mens',
  color: '#000000',
  sleeve: 'short',
  stretch: 'none',
  fitIntent: 'regular',
  chart: { unit: 'in', girth: 'flat', lengthDefinition: 'hps' },
  source: { placeholder: false, tier: 'B', url: 'https://example.com', capturedOn: '2026-11-18' },
  sizes: [
    { label: 'M', measurements: { chest: 20, length: 29 } },
    { label: 'L', measurements: { chest: 22, length: 30 } },
  ],
};
const audit = { measuredSize: 'M', measuredOn: '2026-11-18', afterWash: true, unit: 'in' as const, measurements: { chest: 20, length: 29 } };
const clean: GarmentCheck = { garmentId: 'tee', errors: [], warnings: [], unscorable: [], audit: null };
const grade = (g: SeedGarment, check: Partial<GarmentCheck> = {}) => gradeGarment(g, { ...clean, ...check });

describe('gradeGarment', () => {
  it('grades a tier B chart without an audit as charted', () => {
    expect(grade(real)).toBe('charted');
  });

  it('grades a clean, audited tier A–C chart as verified', () => {
    for (const tier of ['A', 'B', 'C'] as const) {
      expect(grade({ ...real, audit, source: { ...real.source, tier } })).toBe('verified');
    }
  });

  it('holds back verified while there are warnings, and for retailer data', () => {
    expect(grade({ ...real, audit }, { warnings: [{ check: 'audit', message: 'off' }] })).toBe('charted');
    expect(grade({ ...real, audit, source: { ...real.source, tier: 'D' } })).toBe('charted');
  });

  it('grades estimated values, weak tiers and placeholders as estimated', () => {
    const est = { ...real, sizes: [{ label: 'M', measurements: { chest: 20, length: { value: 29, origin: 'estimated' as const, how: 'test' } } }] };
    expect(grade(est)).toBe('estimated');
    for (const tier of ['E', 'F', 'G'] as const) expect(grade({ ...real, source: { ...real.source, tier } })).toBe('estimated');
    expect(grade({ ...real, source: { placeholder: true } })).toBe('estimated');
  });

  it('grades unscored when a required zone has no definition, ahead of everything else', () => {
    const unscorable = [{ key: 'chest' as const, reason: 'x', required: true }];
    expect(grade({ ...real, source: { placeholder: true } }, { unscorable })).toBe('unscored');
    expect(grade(real, { unscorable: [{ key: 'sleeve', reason: 'x', required: false }] })).toBe('charted');
  });

  it('gives no grade to a garment with errors', () => {
    expect(grade(real, { errors: [{ check: 'monotonic', message: 'x' }] })).toBeNull();
  });

  it('works end to end with checkGarment', () => {
    const unknown = { ...real, chart: { ...real.chart, lengthDefinition: 'unknown' as const } };
    expect(gradeGarment(unknown, checkGarment(unknown))).toBe('unscored');
  });
});

describe('hasEstimatedValues', () => {
  it('is false for plain chart numbers and audited values', () => {
    expect(hasEstimatedValues(real)).toBe(false);
    expect(hasEstimatedValues({ ...real, sizes: [{ label: 'M', measurements: { chest: { value: 20, origin: 'audited' }, length: 29 } }] })).toBe(false);
  });
});

describe('the seed', () => {
  it('grades the real tees and a placeholder as expected', () => {
    expect(findGarment('gildan-5000')?.grade).toBe('charted');
    expect(findGarment('knightweave-tee')?.grade).toBe('charted');
    expect(findGarment('landsend-super-t')?.grade).toBe('charted');
    expect(findGarment('fieldline-oxford')?.grade).toBe('estimated');
  });

  it('grades a chart with an unknown chest method as unscored', () => {
    expect(UNKNOWN_CHEST_TEE.grade).toBe('unscored');
  });
});
