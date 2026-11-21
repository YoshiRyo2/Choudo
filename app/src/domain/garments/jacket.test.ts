import { describe, expect, it } from 'vitest';
import { checkGarment } from './verify';
import { normalizeGarment } from './garments';
import { JACKET_SEED } from './testFixtures';
import type { SeedGarment } from './types';

const jacket = (over: Partial<SeedGarment> = {}): SeedGarment => ({ ...JACKET_SEED, source: { placeholder: true }, ...over });
const sized = (m: Record<string, number>) => jacket({ sizes: [{ label: 'M', measurements: { chest: 60, length: 75, sleeve: 88, ...m } }] });
const warnings = (g: SeedGarment) => checkGarment(g).warnings.map((w) => w.message);
const errors = (g: SeedGarment) => checkGarment(g).errors.map((e) => e.message);

describe('jacket checks', () => {
  it('pass a plausible jacket', () => {
    expect(checkGarment(sized({}))).toMatchObject({ errors: [], warnings: [] });
  });

  it('warn on an implausible chest, shoulder, length or centre-back sleeve', () => {
    expect(warnings(sized({ chest: 100 }))).toContain('chest in M is 200.0 cm, outside 85–190 cm');
    expect(warnings(sized({ shoulder: 70 }))).toContain('shoulder in M is 70.0 cm, outside 38–62 cm');
    expect(warnings(sized({ length: 40 }))).toContain('length in M is 40.0 cm, outside 50–100 cm');
    expect(warnings(sized({ sleeve: 120 }))).toContain('sleeve in M is 120.0 cm, outside 70–110 cm');
  });

  it('let a coat run long', () => {
    expect(warnings(jacket({ type: 'coat', sizes: [{ label: 'M', measurements: { chest: 60, length: 110, sleeve: 88 } }] }))).toEqual([]);
  });

  it('error on a flat chest that reads like a full circumference', () => {
    expect(errors(sized({ chest: 110 }))).toContain('chest is marked flat, but 110.0 cm–110.0 cm as printed looks like a full circumference');
  });

  it('need a length definition, and grade unscored without a scorable one', () => {
    expect(errors(jacket({ chart: { unit: 'cm', girth: 'flat', definitions: { sleeve: 'center_back_to_cuff' } } }))).toContain(
      'a jacket needs chart.lengthDefinition (hps, center_back, unknown)',
    );
    expect(normalizeGarment(jacket({ chart: { unit: 'cm', girth: 'flat', definitions: { length: 'unknown' } } })).grade).toBe('unscored');
  });

  it('reject an ankle zip and the top slot', () => {
    expect(errors(jacket({ ankleZip: true }))).toContain("a jacket can't have an ankle zip");
    expect(errors(jacket({ category: 'top' }))).toContain('a jacket is an outer, not a top');
  });
});
