import { describe, expect, it } from 'vitest';
import { estimateBody } from '../body';
import { normalizeGarment, type SeedGarment } from '../garments';
import { KNIT_HOODIE, KNIT_HOODIE_SEED, UNKNOWN_CHEST_SEED } from '../garments/testFixtures';
import { fitGarment } from './fitEngine';
import { canAnchor, chestTarget, garmentChestTarget, personalFit, preferenceSpec, resolvePreference } from './preference';
import {
  BACK_NECK_DROP_CM,
  HEM_BAND,
  INTENT_EASE,
  KNIT_EASE_OFFSET_CM,
  KNIT_GIRTH_RULES,
  STRETCH_ALLOWANCE,
  TOP_CHEST,
  WOMENS_TOP_CHEST,
} from './rules';
import { hpsLengthCm, lengthTargetCm, sleeveFromShoulderPointCm, sleeveTargetCm } from './tops';
import { ruleFor, templateZones, zoneSpecsFor } from './zones';

const body = estimateBody({ heightCm: 176, weightKg: 85, bodyType: 'mens' });
const m = body.measurements;
const knit = (extra: Partial<SeedGarment> = {}) => normalizeGarment({ ...KNIT_HOODIE_SEED, ...extra });
const zone = (g: ReturnType<typeof knit>, size: string, id: string) =>
  fitGarment(body, g, size).zones.find((z) => z.zone === id)!;

describe('top length and sleeve targets (tops.ts)', () => {
  it('compares an HPS length with the torso, and a centre-back one with the torso less the back-neck drop', () => {
    expect(lengthTargetCm(m, 'hps')).toBe(m.torsoLengthCm);
    expect(lengthTargetCm(m, 'center_back')).toBeCloseTo(m.torsoLengthCm - BACK_NECK_DROP_CM, 9);
    expect(lengthTargetCm(m, 'unknown')).toBeNull();
  });

  it('compares a shoulder sleeve with the arm, and a centre-back one with half the shoulders plus the arm', () => {
    expect(sleeveTargetCm(m, 'shoulder_to_cuff')).toBe(m.armLengthCm);
    expect(sleeveTargetCm(m, 'center_back_to_cuff')).toBeCloseTo(m.armLengthCm + m.shoulderWidthCm / 2, 9);
    expect(sleeveTargetCm(m, 'top_of_sleeve')).toBeNull();
  });

  it('turns a chart length and sleeve into what the drawing needs: from the high shoulder and from the shoulder point', () => {
    const l = KNIT_HOODIE.sizes.find((s) => s.label === 'L')!.measurements;
    expect(hpsLengthCm(KNIT_HOODIE, l)).toBe(l.length);
    const cb = knit({ chart: { ...KNIT_HOODIE_SEED.chart, definitions: { length: 'center_back', sleeve: 'center_back_to_cuff' } } });
    expect(hpsLengthCm(cb, l)).toBeCloseTo(l.length! + BACK_NECK_DROP_CM, 9);
    expect(sleeveFromShoulderPointCm(KNIT_HOODIE, l, m)).toBeCloseTo(l.sleeve! - m.shoulderWidthCm / 2, 9);
    expect(sleeveFromShoulderPointCm(normalizeGarment({ ...UNKNOWN_CHEST_SEED, sleeve: 'long' }), l, m)).toBeUndefined();
  });
});

describe('knit zones', () => {
  it('scores a hoodie on chest, length, sleeve and hem band', () => {
    const size = KNIT_HOODIE.sizes[0]!.measurements;
    expect(zoneSpecsFor(KNIT_HOODIE, size).map((z) => z.zone)).toEqual(['chest', 'length', 'sleeve', 'hemBand']);
  });

  it("uses the tee chest rule shifted by the knit offset, by the garment's sizing; tight stays where it was", () => {
    const chest = templateZones(KNIT_HOODIE).zones[0]!;
    expect(ruleFor(chest, { sizing: 'unisex' })).toBe(KNIT_GIRTH_RULES.unisex);
    expect(ruleFor(chest, { sizing: 'womens' })).toBe(KNIT_GIRTH_RULES.womens);
    expect(KNIT_GIRTH_RULES.mens).toMatchObject({
      tightBelow: TOP_CHEST.tightBelow,
      fittedMax: TOP_CHEST.fittedMax + KNIT_EASE_OFFSET_CM,
      relaxedMax: TOP_CHEST.relaxedMax + KNIT_EASE_OFFSET_CM,
      ideal: TOP_CHEST.ideal + KNIT_EASE_OFFSET_CM,
    });
    expect(KNIT_GIRTH_RULES.womens.fittedMax).toBe(WOMENS_TOP_CHEST.fittedMax + KNIT_EASE_OFFSET_CM);
  });

  it('scores a centre-back sleeve against half the shoulders plus the arm, and says so', () => {
    const z = zone(KNIT_HOODIE, 'L', 'sleeve');
    expect(z.bodyCm).toBeCloseTo(m.armLengthCm + m.shoulderWidthCm / 2, 9);
    expect(z.label).not.toBe('unknown');
    expect(z.bodyAt).toBe('centre_back');
  });

  it('scores a centre-back length against the torso less the back-neck drop', () => {
    const cb = knit({ chart: { ...KNIT_HOODIE_SEED.chart, definitions: { length: 'center_back', sleeve: 'center_back_to_cuff' } } });
    const z = zone(cb, 'L', 'length');
    expect(z.label).not.toBe('unknown');
    expect(z.bodyCm).toBeCloseTo(m.torsoLengthCm - BACK_NECK_DROP_CM, 9);
    expect(z.bodyAt).toBe('centre_back');
  });

  it('leaves an HPS length as the plain torso, with no bodyAt', () => {
    const z = zone(KNIT_HOODIE, 'L', 'length');
    expect(z.bodyCm).toBe(m.torsoLengthCm);
    expect(z.bodyAt).toBeUndefined();
  });

  it('still never scores a tee by its centre-back length', () => {
    const tee = normalizeGarment({ ...UNKNOWN_CHEST_SEED, chart: { unit: 'in', girth: 'flat', lengthDefinition: 'center_back' } });
    expect(fitGarment(body, tee, 'L').zones.find((z) => z.zone === 'length')!.label).toBe('unknown');
  });

  it('compares the hem band with the hips; rib stretch moves tight down', () => {
    const z = zone(KNIT_HOODIE, 'L', 'hemBand');
    expect(z.bodyCm).toBe(m.hipsCm);
    expect(z.optional).toBe(true);
    const tight = z.bands.find((b) => b.label === 'tight')!;
    expect(tight.to).toBeCloseTo(HEM_BAND.tightBelow - STRETCH_ALLOWANCE.high * m.hipsCm, 9);
  });

  it("doesn't make a size unknown when the chart has no hem band", () => {
    const noBand = knit({
      sizes: KNIT_HOODIE_SEED.sizes.map((s) => {
        const { hemBand: _drop, ...rest } = s.measurements;
        return { ...s, measurements: rest };
      }),
    });
    const fit = fitGarment(body, noBand, 'L');
    expect(fit.zones.find((z) => z.zone === 'hemBand')!.label).toBe('unknown');
    expect(fit.overall).not.toBe('unknown');
  });
});

describe('knit personal fit', () => {
  const pref = resolvePreference(preferenceSpec(null, 'regular'), m);

  it('aims a knit chest the knit offset roomier than a tee', () => {
    expect(chestTarget(pref, 'regular', KNIT_EASE_OFFSET_CM).easeCm).toBe(INTENT_EASE.regular.easeCm + KNIT_EASE_OFFSET_CM);
    expect(garmentChestTarget(pref, KNIT_HOODIE).easeCm).toBe(INTENT_EASE.regular.easeCm + KNIT_EASE_OFFSET_CM);
    const fit = fitGarment(body, KNIT_HOODIE, 'L');
    const chest = fit.zones.find((z) => z.zone === 'chest')!;
    expect(personalFit(fit, KNIT_HOODIE, pref).chestMissCm).toBeCloseTo(
      chest.diffCm! - INTENT_EASE.regular.easeCm - KNIT_EASE_OFFSET_CM,
      9,
    );
  });

  it("keeps a relaxed knit's design target above the user's by the same offset", () => {
    const t = chestTarget(pref, 'oversized', KNIT_EASE_OFFSET_CM);
    expect(t).toEqual({ easeCm: INTENT_EASE.oversized.easeCm + KNIT_EASE_OFFSET_CM, bandCm: INTENT_EASE.oversized.bandCm, asDesigned: true });
  });

  it("isn't offered as an anchor tee", () => {
    expect(canAnchor(KNIT_HOODIE)).toBe(false);
  });
});
