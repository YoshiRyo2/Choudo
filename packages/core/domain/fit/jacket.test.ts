import { describe, expect, it } from 'vitest';
import { estimateBody } from '../body';
import { normalizeGarment } from '../garments';
import { JACKET, JACKET_SEED } from '../garments/testFixtures';
import { fitGarment } from './fitEngine';
import { canAnchor, garmentChestTarget, resolvePreference, preferenceSpec } from './preference';
import { JACKET_EASE_OFFSET_CM, JACKET_GIRTH_RULES, JACKET_LENGTH, JACKET_SHOULDER, TOP_GIRTH_RULES } from './rules';
import { TEMPLATE_ZONES } from './zones';

const body = estimateBody({ heightCm: 176, weightKg: 85, bodyType: 'mens' });
const zone = (size: string, id: string, g = JACKET) => fitGarment(body, g, size).zones.find((z) => z.zone === id);

describe('jacket rules (ASSUMED)', () => {
  it('moves the top chest bands out by the jacket offset, keeping tight where it was', () => {
    for (const sizing of ['mens', 'womens', 'unisex'] as const) {
      const tee = TOP_GIRTH_RULES[sizing].chest;
      const j = JACKET_GIRTH_RULES[sizing];
      expect(j.tightBelow).toBe(tee.tightBelow);
      expect(j.fittedMax).toBeCloseTo(tee.fittedMax + JACKET_EASE_OFFSET_CM, 9);
      expect(j.relaxedMax).toBeCloseTo(tee.relaxedMax + JACKET_EASE_OFFSET_CM, 9);
      expect(j.ideal).toBeCloseTo(tee.ideal + JACKET_EASE_OFFSET_CM, 9);
    }
    expect(JACKET_EASE_OFFSET_CM).toBe(13);
    expect(JACKET_SHOULDER).toMatchObject({ kind: 'girth', tightBelow: -1.5, fittedMax: 1.5, relaxedMax: 4, ideal: 0 });
    expect(JACKET_LENGTH.marks.map((m) => [m.label, m.atCm])).toEqual([
      ['cropped', -Infinity],
      ['hip', -6],
      ['thigh', 12],
      ['knee-length', 32],
      ['calf', 45],
    ]);
  });
});

describe('jacket zones', () => {
  it('scores chest, shoulder, sleeve and length, in that order (waist only when charted)', () => {
    expect(fitGarment(body, JACKET, 'M').zones.map((z) => z.zone)).toEqual(['chest', 'shoulder', 'sleeve', 'length']);
    const withWaist = normalizeGarment({
      ...JACKET_SEED,
      sizes: JACKET_SEED.sizes.map((s) => ({ ...s, measurements: { ...s.measurements, waist: 55 } })),
    });
    expect(fitGarment(body, withWaist, 'M').zones.map((z) => z.zone)).toEqual(['chest', 'waist', 'shoulder', 'sleeve', 'length']);
  });

  it('lands the length against the hip line: cropped, hip, thigh, knee, calf', () => {
    const landings = ['S', 'M', 'L', 'XL', 'XXL'].map((s) => zone(s, 'length')!);
    expect(landings.map((z) => z.landing)).toEqual(['cropped', 'hip', 'thigh', 'knee-length', 'calf']);
    expect(landings[1]!.kind).toBe('landing');
    expect(landings[1]!.bodyCm).toBeCloseTo(body.measurements.torsoLengthCm, 9);
    expect(landings[1]!.diffCm).toBeCloseTo(0.5, 1);
  });

  it('compares a centre-back sleeve with the back, shoulder curve and arm', () => {
    const s = zone('M', 'sleeve')!;
    expect(s.kind).toBe('length');
    expect(s.bodyAt).toBe('centre_back');
    expect(s.label).toBe('good');
  });

  it('reads a +18 cm chest as fitted and +22 cm as relaxed on a men’s jacket', () => {
    expect(zone('M', 'chest')!.diffCm).toBeCloseTo(18, 6);
    expect(zone('M', 'chest')!.label).toBe('fitted');
    expect(zone('XXL', 'chest')!.diffCm).toBeCloseTo(30, 6);
    expect(zone('L', 'chest')!.label).toBe('relaxed');
  });

  it('leaves an uncharted shoulder unknown without making the size unknown; the length never decides', () => {
    const m = fitGarment(body, JACKET, 'M');
    const shoulder = m.zones.find((z) => z.zone === 'shoulder')!;
    expect(shoulder.label).toBe('unknown');
    expect(shoulder.optional).toBe(true);
    expect(m.overall).toBe('good');
    // XXL lands at the calf but its chest is loose: the overall comes from the chest, not the length.
    expect(fitGarment(body, JACKET, 'XXL').overall).toBe('warn');
  });

  it('scores a charted shoulder against the shoulder width, ±1.5 cm fitted', () => {
    const sw = body.measurements.shoulderWidthCm;
    const g = normalizeGarment({
      ...JACKET_SEED,
      sizes: JACKET_SEED.sizes.map((s, i) => ({ ...s, measurements: { ...s.measurements, shoulder: sw - 3 + i * 2 } })),
    });
    expect(['S', 'M', 'L', 'XL'].map((s) => zone(s, 'shoulder', g)!.label)).toEqual(['tight', 'fitted', 'fitted', 'relaxed']);
  });
});

describe('jacket personal fit', () => {
  it('aims the chest at the tee target plus the jacket offset, with no personal length', () => {
    expect(TEMPLATE_ZONES.jacket.personal).toEqual({ girth: 'chest', length: null, easeOffsetCm: JACKET_EASE_OFFSET_CM });
    const pref = resolvePreference(preferenceSpec(null, null), body.measurements);
    const tee = normalizeGarment({ ...JACKET_SEED, category: 'top', type: 'tee', sleeve: 'short' });
    expect(garmentChestTarget(pref, JACKET)!.easeCm).toBeCloseTo(garmentChestTarget(pref, tee)!.easeCm + JACKET_EASE_OFFSET_CM, 9);
  });

  it('never uses a jacket as the anchor tee', () => {
    expect(canAnchor(JACKET)).toBe(false);
  });
});
