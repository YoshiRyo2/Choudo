import { describe, expect, it } from 'vitest';
import { normalizeSize } from './normalize';
import { KNIT_HOODIE_SEED } from './testFixtures';
import type { SeedGarment, SeedSize } from './types';
import {
  checkGarment,
  checkGrading,
  checkGirthMethod,
  checkMonotonic,
  checkRanges,
  compareAudit,
  seriesFor,
  unscorableZones,
  type Point,
} from './verify';

const tee: SeedGarment = {
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
  source: { placeholder: false, tier: 'B', url: 'https://example.com/chart', capturedOn: '2026-11-18' },
  // Gildan 5000's numbers: clean, evenly graded.
  sizes: [
    { label: 'S', measurements: { chest: 18, length: 28 } },
    { label: 'M', measurements: { chest: 20, length: 29 } },
    { label: 'L', measurements: { chest: 22, length: 30 } },
    { label: 'XL', measurements: { chest: 24, length: 31 } },
  ],
};

const jean = (sizes: [string, number, number][]): SeedGarment => ({
  ...tee,
  id: 'jean',
  category: 'bottom',
  type: 'jeans',
  sleeve: undefined,
  chart: { unit: 'cm', girth: 'circumference' },
  sizes: sizes.map(([label, waist, inseam]) => ({ label, measurements: { waist, inseam } })),
});

const pts = (...cms: number[]): Point[] => cms.map((cm, i) => ({ label: `S${i}`, cm }));
const normalized = (g: SeedGarment) => g.sizes.map((s: SeedSize) => normalizeSize(s, g.chart));

describe('checkGarment', () => {
  it('passes a clean real chart', () => {
    expect(checkGarment(tee)).toEqual({ garmentId: 'tee', errors: [], warnings: [], unscorable: [], audit: null });
  });

  it('reports structural problems as errors and skips the rest', () => {
    const r = checkGarment({ ...tee, color: 'red', sizes: [{ label: 'M', measurements: { chest: 20 } }] });
    expect(r.errors.map((e) => e.message)).toEqual(['color must be #rrggbb', 'size M: missing length']);
    expect(r.errors.every((e) => e.check === 'structure')).toBe(true);
  });

  it('rejects a sizing other than mens, womens or unisex', () => {
    const r = checkGarment({ ...tee, sizing: 'kids' as never });
    expect(r.errors.map((e) => e.message)).toEqual(['sizing must be "mens", "womens" or "unisex"']);
    for (const sizing of ['mens', 'womens', 'unisex'] as const) expect(checkGarment({ ...tee, sizing }).errors).toEqual([]);
  });

  it('turns a shrinking size into an error', () => {
    const swapped = { ...tee, sizes: [tee.sizes[1]!, tee.sizes[0]!, ...tee.sizes.slice(2)] };
    const r = checkGarment(swapped);
    expect(r.errors.map((e) => e.check)).toEqual(['monotonic', 'monotonic']);
    expect(r.errors[0]?.message).toMatch(/^chest drops from M \(101\.6 cm\) to S \(91\.4 cm\)$/);
  });

  it('flags an audit far from the chart', () => {
    const audited = {
      ...tee,
      audit: { measuredSize: 'M', measuredOn: '2026-11-18', afterWash: true, unit: 'in' as const, measurements: { chest: 19, length: 28.75 } },
    };
    const r = checkGarment(audited);
    expect(r.audit?.diffs.map((d) => d.key)).toEqual(['chest', 'length']);
    expect(r.audit?.diffs[0]?.diffCm).toBeCloseTo(-5.08); // 1 in flat = 2 in round
    expect(r.audit?.diffs[1]?.diffCm).toBeCloseTo(-0.635);
    expect(r.warnings.map((w) => w.message)).toEqual(['audit: chest in M is 5.1 cm smaller than the chart says']);
  });
});

describe('seriesFor', () => {
  it('follows chart order for letter sizes', () => {
    expect(seriesFor(normalized(tee), 'chest')[0]?.map((p) => p.label)).toEqual(['S', 'M', 'L', 'XL']);
  });

  it('grows inseam within a waist and girths across waists for 32x30 labels', () => {
    const g = jean([
      ['30x30', 79, 76],
      ['30x32', 79, 81],
      ['32x30', 84, 76],
      ['32x32', 84, 81],
      ['34x32', 89, 81],
    ]);
    const sizes = normalized(g);
    expect(seriesFor(sizes, 'waist').map((r) => r.map((p) => p.label))).toEqual([['30x30', '32x30', '34x32']]);
    expect(seriesFor(sizes, 'inseam').map((r) => r.map((p) => p.label))).toEqual([
      ['30x30', '30x32'],
      ['32x30', '32x32'],
    ]);
    expect(checkGarment(g).errors).toEqual([]);
  });

  it('skips keys a garment does not list', () => {
    expect(seriesFor(normalized(tee), 'sleeve')).toEqual([]);
  });
});

describe('checkMonotonic', () => {
  it('allows equal values (fixed inseam) but not a drop', () => {
    expect(checkMonotonic('inseam', pts(81, 81, 81))).toEqual([]);
    expect(checkMonotonic('waist', pts(80, 85, 84))).toEqual(['waist drops from S1 (85.0 cm) to S2 (84.0 cm)']);
  });
});

describe('checkGrading', () => {
  it('passes even steps and small wobbles', () => {
    expect(checkGrading('chest', pts(100, 106, 112, 118))).toEqual([]);
    expect(checkGrading('chest', pts(98, 104, 110, 118))).toEqual([]); // 6, 6, 8
    expect(checkGrading('length', pts(71.1, 72.4, 74.9, 77.5))).toEqual([]); // ½ in then 1 in steps
  });

  it('warns about a step more than twice its neighbours', () => {
    expect(checkGrading('chest', pts(100, 105, 120, 125))).toEqual([
      'chest jumps 15.0 cm from S1 to S2, more than 2× the step next to it (5.0 cm)',
    ]);
  });

  it('ignores steps next to a flat run', () => {
    expect(checkGrading('inseam', pts(81, 81, 86))).toEqual([]);
  });
});

describe('checkGirthMethod', () => {
  it('errors when a flat chart prints circumferences', () => {
    const r = checkGirthMethod({ ...tee, sizes: [{ label: 'M', measurements: { chest: 40, length: 29 } }] });
    expect(r).toEqual([{ severity: 'error', message: 'chest is marked flat, but 101.6 cm–101.6 cm as printed looks like a full circumference' }]);
  });

  it('errors when a circumference chart prints flat widths', () => {
    const r = checkGirthMethod({ ...tee, chart: { ...tee.chart, unit: 'cm', girth: 'circumference' }, sizes: [{ label: 'M', measurements: { chest: 52, length: 72 } }] });
    expect(r[0]?.severity).toBe('error');
    expect(r[0]?.message).toMatch(/looks like a flat width/);
  });

  it('only hints when the method is unknown', () => {
    const r = checkGirthMethod({ ...tee, chart: { ...tee.chart, girth: 'unknown' }, sizes: [{ label: 'M', measurements: { chest: 44, length: 29 } }] });
    expect(r).toEqual([{ severity: 'warning', message: expect.stringMatching(/look like full circumferences/) }]);
  });
});

describe('checkRanges', () => {
  it('warns about an implausible tee length', () => {
    const long = { ...tee, sizes: [{ label: 'M', measurements: { chest: 20, length: 40 } }] };
    expect(checkRanges(long, normalized(long))).toEqual(['length in M is 101.6 cm, outside 60–90 cm']);
  });

  it('judges chest ease by fit intent', () => {
    // Gildan M: 101.6 cm over a typical 99.1 cm chest — fine for regular, too snug for oversized.
    expect(checkRanges(tee, normalized(tee))).toEqual([]);
    const oversized = { ...tee, fitIntent: 'oversized' as const };
    expect(checkRanges(oversized, normalized(oversized))[0]).toMatch(/chest ease in S is 2\.5 cm .* oversized fit/);
  });

  it('skips ease for women’s sizing and unknown girths', () => {
    const womens = { ...tee, sizing: 'womens' as const, fitIntent: 'oversized' as const };
    expect(checkRanges(womens, normalized(womens))).toEqual([]);
    const unknown = { ...tee, fitIntent: 'oversized' as const, chart: { ...tee.chart, girth: 'unknown' as const } };
    expect(checkRanges(unknown, normalized(unknown))).toEqual([]);
  });

  it('compares a pants waist to the size on the label', () => {
    const g = jean([['32x32', 100, 81]]);
    expect(checkRanges(g, normalized(g))).toEqual(['waist in 32x32 is 100.0 cm, 18.7 cm off the 32 in on the label']);
  });
});

describe('unscorableZones', () => {
  it('lists girths with an unknown method and non-hps lengths', () => {
    const g: SeedGarment = { ...tee, sleeve: 'long', chart: { unit: 'in', girth: 'unknown', lengthDefinition: 'center_back', sleeveDefinition: 'top_of_sleeve' }, sizes: [{ label: 'M', measurements: { chest: 40, length: 29, sleeve: 25 } }] };
    expect(unscorableZones(g)).toEqual([
      { key: 'chest', reason: 'chart doesn’t say flat or full circumference', required: true },
      { key: 'length', reason: 'length is measured from the back of the neck, not the shoulder', required: true },
      { key: 'sleeve', reason: 'sleeve isn’t measured shoulder to cuff', required: false },
    ]);
  });

  it('ignores short sleeves', () => {
    expect(unscorableZones({ ...tee, chart: { ...tee.chart, sleeveDefinition: 'top_of_sleeve' } })).toEqual([]);
  });
});

describe('compareAudit', () => {
  it('doubles the flat audit and notes what it can’t compare', () => {
    const g: SeedGarment = {
      ...tee,
      chart: { ...tee.chart, girth: 'unknown' },
      audit: { measuredSize: 'M', measuredOn: '2026-11-18', afterWash: false, unit: 'cm', measurements: { chest: 51, sleeve: 20 } },
    };
    expect(compareAudit(g, normalized(g)).diffs).toEqual([
      { key: 'chest', chartCm: null, auditCm: 102, diffCm: null, note: 'chart method unknown; it prints 20 in for this size' },
      { key: 'sleeve', chartCm: null, auditCm: 20, diffCm: null, note: 'not on the chart' },
    ]);
  });
});

describe('pants checks', () => {
  const pants = (m: Record<string, number>, over: Partial<SeedGarment> = {}): SeedGarment => ({
    ...jean([['32', 84, 81]]),
    sizes: [{ label: '32', measurements: { waist: 84, hips: 100, inseam: 81, ...m } }],
    ...over,
  });

  it('flags a thigh marked flat that looks like a full circumference', () => {
    const r = checkGarment(pants({ thigh: 60 }, { chart: { unit: 'cm', girth: { default: 'circumference', thigh: 'flat' } } }));
    expect(r.errors.map((e) => [e.check, e.message])).toEqual([
      ['girth-method', 'thigh is marked flat, but 60.0 cm–60.0 cm as printed looks like a full circumference'],
    ]);
  });

  it('warns when the leg opening is wider than the knee, or the knee than the thigh', () => {
    const r = checkGarment(pants({ thigh: 60, knee: 38, legOpening: 42 }));
    expect(r.warnings).toContainEqual({ check: 'relation', message: 'legOpening in 32 (42.0 cm) is wider than its knee (38.0 cm)' });
    const k = checkGarment(pants({ thigh: 40, knee: 44 }));
    expect(k.warnings).toContainEqual({ check: 'relation', message: 'knee in 32 (44.0 cm) is wider than its thigh (40.0 cm)' });
  });

  it('warns when the thigh is more than 0.7 of the hips', () => {
    const r = checkGarment(pants({ thigh: 75 }));
    expect(r.warnings).toContainEqual({ check: 'relation', message: 'thigh in 32 (75.0 cm) is more than 0.7 × its hips (100.0 cm)' });
  });

  it('warns on a leg measurement outside its range', () => {
    const r = checkGarment(pants({ legOpening: 90 }));
    expect(r.warnings.map((w) => w.message)).toContain('legOpening in 32 is 90.0 cm, outside 22–80 cm');
  });

  it('lists thigh and rise as unscorable, not required, without their definitions', () => {
    expect(unscorableZones(pants({ thigh: 60, rise: 26 }))).toEqual([
      { key: 'thigh', reason: 'chart doesn’t say where the thigh is measured', required: false },
      { key: 'rise', reason: 'rise isn’t the front rise', required: false },
    ]);
    const defined = pants({ thigh: 60, rise: 26 }, { chart: { unit: 'cm', girth: 'circumference', definitions: { rise: 'front', thigh: 'at_crotch' } } });
    expect(unscorableZones(defined)).toEqual([]);
  });

  it('lists a leg opening whose method is unknown as unscorable, not required', () => {
    const g = pants({ legOpening: 40 }, { chart: { unit: 'cm', girth: { default: 'circumference', legOpening: 'unknown' } } });
    expect(unscorableZones(g)).toEqual([{ key: 'legOpening', reason: 'chart doesn’t say flat or full circumference', required: false }]);
  });
});

describe('knit checks', () => {
  const hoodie = (patch: Partial<SeedGarment> = {}): SeedGarment => ({ ...KNIT_HOODIE_SEED, ...patch });
  const sizes = (g: SeedGarment) => g.sizes.map((s) => normalizeSize(s, g.chart));

  it('passes a clean hoodie', () => {
    const r = checkGarment(hoodie());
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('warns when the hem band is wider than the chest', () => {
    const g = hoodie({ sizes: [{ label: 'L', measurements: { chest: 24, length: 29, sleeve: 35, hemBand: 25 } }] });
    expect(checkGarment(g).warnings).toContainEqual({
      check: 'relation',
      message: 'hemBand in L (127.0 cm) is wider than its chest (121.9 cm)',
    });
  });

  it('checks a centre-back sleeve against a centre-back range, and the hem band against its own', () => {
    const g = hoodie({ sizes: [{ label: 'L', measurements: { chest: 24, length: 29, sleeve: 50, hemBand: 10 } }] });
    const out = checkRanges(g, sizes(g));
    expect(out).toContain('sleeve in L is 127.0 cm, outside 70–110 cm');
    expect(out).toContain('hemBand in L is 50.8 cm, outside 60–150 cm');
  });

  it('allows big knits a wider chest than tees', () => {
    const g = hoodie({ sizes: [{ label: '5XL', measurements: { chest: 34, length: 34, sleeve: 40, hemBand: 29 } }] });
    expect(checkRanges(g, sizes(g)).filter((w) => w.startsWith('chest in'))).toEqual([]);
  });

  it('scores centre-back lengths and sleeves on a knit (but not on a tee)', () => {
    const cb = hoodie({ chart: { ...KNIT_HOODIE_SEED.chart, definitions: { length: 'center_back', sleeve: 'center_back_to_cuff' } } });
    expect(unscorableZones(cb)).toEqual([]);
    expect(unscorableZones({ ...tee, sleeve: 'long', chart: { ...tee.chart, sleeveDefinition: 'center_back_to_cuff' }, sizes: [{ label: 'M', measurements: { chest: 20, length: 29, sleeve: 34 } }] })).toEqual([
      { key: 'sleeve', reason: 'sleeve isn’t measured shoulder to cuff', required: false },
    ]);
  });
});
