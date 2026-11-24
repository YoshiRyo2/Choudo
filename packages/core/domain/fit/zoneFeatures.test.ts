import { describe, expect, it } from 'vitest';
import { estimateBody } from '../body';
import { findGarment } from '../garments';
import { fitZone, overallTone, type GarmentFit, type ZoneFit } from './fitEngine';
import { personalFit, preferenceSpec, resolvePreference } from './preference';
import { BOTTOM_HIPS, BOTTOM_WAIST, type LandingRule } from './rules';
import type { ZoneSpec } from './zones';

const body = estimateBody({ heightCm: 176, weightKg: 85, bodyType: 'mens' });
const jean = findGarment('corvo-slim-jean')!;
const size = jean.sizes[0]!;

const MARKS: LandingRule['marks'] = [
  { label: 'narrow', atCm: -Infinity },
  { label: 'wide', atCm: 0 },
];

const zone = (z: Partial<ZoneFit> & Pick<ZoneFit, 'zone' | 'kind' | 'label' | 'tone'>): ZoneFit => ({
  diffCm: 0,
  garmentCm: 0,
  bodyCm: 0,
  bodySource: 'estimated',
  bands: [],
  ...z,
});

describe('zone body targets', () => {
  it('a body target function replaces the body measurement', () => {
    const spec: ZoneSpec = { zone: 'waist', garmentKey: 'waist', bodyKey: 'waistCm', rule: BOTTOM_WAIST, bodyTarget: () => 90 };
    const z = fitZone(spec, body, jean, size);
    expect(z.bodyCm).toBe(90);
    expect(z.diffCm).toBeCloseTo(size.measurements.waist! - 90);
    expect(z.bodySource).toBe(body.sources.waistCm);
  });
});

describe('optional zones', () => {
  it('an unknown optional girth doesn’t make the size unknown', () => {
    const zones = [
      zone({ zone: 'waist', kind: 'girth', label: 'fitted', tone: 'good' }),
      zone({ zone: 'hips', kind: 'girth', label: 'unknown', tone: 'unknown', optional: true }),
    ];
    expect(overallTone(zones)).toBe('good');
  });

  it('marks the zone optional only when it is', () => {
    const optional: ZoneSpec = { zone: 'hips', garmentKey: 'thigh', bodyKey: 'hipsCm', rule: BOTTOM_HIPS, optional: true };
    const required: ZoneSpec = { zone: 'hips', garmentKey: 'hips', bodyKey: 'hipsCm', rule: BOTTOM_HIPS };
    expect(fitZone(optional, body, jean, size).optional).toBe(true);
    expect('optional' in fitZone(required, body, jean, size)).toBe(false);
  });
});

describe('blocking landing zones', () => {
  const blocking = (label: 'tight' | 'short'): ZoneSpec => ({
    zone: 'inseam',
    garmentKey: 'inseam',
    bodyKey: 'inseamCm',
    rule: { kind: 'landing', marks: MARKS, blocks: () => ({ label, note: 'It won’t go on.' }) },
  });

  it('a blocking landing zone is bad and says why', () => {
    const z = fitZone(blocking('tight'), body, jean, size);
    expect(z).toMatchObject({ kind: 'landing', label: 'tight', tone: 'bad', note: 'It won’t go on.' });
    expect(z.landing).toBeDefined();
  });

  it('makes the size bad and the verdict too-tight / shorter', () => {
    const pref = resolvePreference(preferenceSpec(null, null), body.measurements);
    for (const [label, verdict] of [
      ['tight', 'too-tight'],
      ['short', 'shorter'],
    ] as const) {
      const zones = [zone({ zone: 'waist', kind: 'girth', label: 'fitted', tone: 'good' }), fitZone(blocking(label), body, jean, size)];
      expect(overallTone(zones)).toBe('bad');
      const fit: GarmentFit = { garmentId: jean.id, sizeLabel: size.label, bodyType: 'mens', zones, overall: overallTone(zones) };
      const personal = personalFit(fit, jean, pref);
      expect(personal.verdict).toBe(verdict);
      expect(personal.zones.inseam).toBe('under');
    }
  });

  it('a landing zone that doesn’t block still never changes overall', () => {
    const spec: ZoneSpec = { zone: 'inseam', garmentKey: 'inseam', bodyKey: 'inseamCm', rule: { kind: 'landing', marks: MARKS, blocks: () => null } };
    const z = fitZone(spec, body, jean, size);
    expect(z.label).toBe('noted');
    expect(overallTone([zone({ zone: 'waist', kind: 'girth', label: 'fitted', tone: 'good' }), z])).toBe('good');
  });
});
