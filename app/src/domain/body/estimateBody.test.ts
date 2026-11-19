import { describe, expect, it } from 'vitest';
import { inToCm } from '../units';
import { estimateBody, MENS_MODEL, validateBodyInput, WOMENS_REGRESSION } from './estimateBody';
import type { BodyInput } from './types';

const average: BodyInput = { heightCm: 176, weightKg: 85, bodyType: 'mens' };

describe('estimateBody', () => {
  it('returns the reference body for the reference height and weight', () => {
    const { measurements: m } = estimateBody(average);
    const ref = MENS_MODEL.ref;
    expect(m.chestCm).toBeCloseTo(ref.chestCm);
    expect(m.waistCm).toBeCloseTo(ref.waistCm);
    expect(m.hipsCm).toBeCloseTo(ref.hipsCm);
  });

  it('gives plausible numbers for a slim man (180 cm, 65 kg)', () => {
    const { measurements: m } = estimateBody({ heightCm: 180, weightKg: 65, bodyType: 'mens' });
    expect(m.chestCm).toBeGreaterThan(84);
    expect(m.chestCm).toBeLessThan(94);
    expect(m.waistCm).toBeGreaterThan(70);
    expect(m.waistCm).toBeLessThan(80);
    expect(m.inseamCm).toBeCloseTo(81);
  });

  it('gives plausible numbers for a heavier man (175 cm, 110 kg)', () => {
    const { measurements: m } = estimateBody({ heightCm: 175, weightKg: 110, bodyType: 'mens' });
    expect(m.chestCm).toBeGreaterThan(114);
    expect(m.chestCm).toBeLessThan(126);
    expect(m.waistCm).toBeGreaterThan(m.chestCm - 10); // waist catches up with chest
  });

  it('uses the ANSUR II women’s regressions for a women’s body', () => {
    // At the survey means (162.8 cm, 67.8 kg) the lines give back the survey means.
    const { measurements: m } = estimateBody({ heightCm: 162.8, weightKg: 67.8, bodyType: 'womens' });
    expect(m.bodyType).toBe('womens');
    expect(m.chestCm).toBeCloseTo(94.7, 0);
    expect(m.waistCm).toBeCloseTo(86.1, 0);
    expect(m.hipsCm).toBeCloseTo(102.1, 0);
    expect(m.inseamCm).toBeCloseTo(78.2, 0);
    expect(m.hipsCm).toBeGreaterThan(m.chestCm);
  });

  it('gives a women’s body a bigger hip-to-waist drop than a men’s of the same size', () => {
    const w = estimateBody({ heightCm: 165, weightKg: 60, bodyType: 'womens' }).measurements;
    const men = estimateBody({ heightCm: 165, weightKg: 60, bodyType: 'mens' }).measurements;
    expect(w.hipsCm - w.waistCm).toBeGreaterThan(men.hipsCm - men.waistCm);
  });

  it('keeps women’s regressions in a plausible range far outside the survey', () => {
    const m = estimateBody({ heightCm: 230, weightKg: 30, bodyType: 'womens' }).measurements;
    expect(m.waistCm).toBeGreaterThanOrEqual(50);
    expect(m.chestCm).toBeGreaterThanOrEqual(60);
    expect(WOMENS_REGRESSION.waistCm.intercept + WOMENS_REGRESSION.waistCm.perCm * 230 + WOMENS_REGRESSION.waistCm.perKg * 30).toBeLessThan(50);
  });

  it('grows girths with weight and lengths with height', () => {
    const light = estimateBody({ ...average, weightKg: 70 }).measurements;
    const heavy = estimateBody({ ...average, weightKg: 100 }).measurements;
    expect(heavy.chestCm).toBeGreaterThan(light.chestCm);
    expect(heavy.waistCm - light.waistCm).toBeGreaterThan(heavy.chestCm - light.chestCm);

    const short = estimateBody({ ...average, heightCm: 165 }).measurements;
    const tall = estimateBody({ ...average, heightCm: 190 }).measurements;
    expect(tall.inseamCm).toBeGreaterThan(short.inseamCm);
    expect(tall.torsoLengthCm).toBeGreaterThan(short.torsoLengthCm);
    expect(tall.armLengthCm).toBeGreaterThan(short.armLengthCm);
  });

  it('lets entered measurements override estimates and records the source', () => {
    const model = estimateBody({ ...average, overrides: { chestCm: 99, inseamCm: 76 } });
    expect(model.measurements.chestCm).toBe(99);
    expect(model.measurements.inseamCm).toBe(76);
    expect(model.sources.chestCm).toBe('entered');
    expect(model.sources.inseamCm).toBe('entered');
    expect(model.sources.waistCm).toBe('estimated');
    expect(model.measurements.waistCm).toBeCloseTo(94);
  });

  it('treats an explicitly undefined override as not entered', () => {
    const model = estimateBody({ ...average, overrides: { chestCm: undefined } });
    expect(model.sources.chestCm).toBe('estimated');
  });

  it('estimates the bust from a bra size, but a measured bust wins', () => {
    const womens: BodyInput = { heightCm: 165, weightKg: 62, bodyType: 'womens' };
    const bra = estimateBody({ ...womens, overrides: { braSize: { band: 34, cup: 'C', system: 'us' } } });
    expect(bra.measurements.chestCm).toBeCloseTo(inToCm(37));
    expect(bra.sources.chestCm).toBe('estimated');
    expect(bra.bra).toEqual({ bandIn: 34, cupIn: 3, setsBust: true });

    const both = estimateBody({ ...womens, overrides: { chestCm: 90, braSize: { band: 34, cup: 'C', system: 'us' } } });
    expect(both.measurements.chestCm).toBe(90);
    expect(both.sources.chestCm).toBe('entered');
    expect(both.bra?.setsBust).toBe(false);

    expect(estimateBody(womens).bra).toBeUndefined();
  });

  it('throws on implausible input', () => {
    expect(() => estimateBody({ ...average, heightCm: 70 })).toThrow(RangeError);
    expect(() => estimateBody({ ...average, weightKg: Number.NaN })).toThrow(RangeError);
  });
});

describe('validateBodyInput', () => {
  it('accepts a normal input', () => {
    expect(validateBodyInput(average)).toEqual([]);
  });

  it('catches a height typed in inches instead of cm', () => {
    const errors = validateBodyInput({ ...average, heightCm: 70 });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.field).toBe('heightCm');
  });

  it('checks overrides too (same 25–70 in chest range as src/fit.py)', () => {
    const errors = validateBodyInput({ ...average, overrides: { chestCm: 9 * 2.54 } });
    expect(errors.map((e) => e.field)).toEqual(['chestCm']);
  });

  it('calls the chest a bust for a women’s body', () => {
    const errors = validateBodyInput({ heightCm: 165, weightKg: 60, bodyType: 'womens', overrides: { chestCm: 20 } });
    expect(errors[0]?.message).toMatch(/^Bust should be/);
  });

  it('checks a bra size', () => {
    const errors = validateBodyInput({ heightCm: 165, weightKg: 60, bodyType: 'womens', overrides: { braSize: { band: 34, cup: 'Q', system: 'us' } } });
    expect(errors.map((e) => e.field)).toEqual(['braSize']);
  });
});
