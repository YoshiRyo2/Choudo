import { describe, expect, it } from 'vitest';
import { estimateBody, PROFILE_MODELS, validateBodyInput } from './estimateBody';
import type { BodyInput } from './types';

const average: BodyInput = { heightCm: 176, weightKg: 85, sizing: 'mens' };

describe('estimateBody', () => {
  it('returns the reference body for the reference height and weight', () => {
    const { measurements: m } = estimateBody(average);
    const ref = PROFILE_MODELS.mens.ref;
    expect(m.chestCm).toBeCloseTo(ref.chestCm);
    expect(m.waistCm).toBeCloseTo(ref.waistCm);
    expect(m.hipsCm).toBeCloseTo(ref.hipsCm);
  });

  it('gives plausible numbers for a slim man (180 cm, 65 kg)', () => {
    const { measurements: m } = estimateBody({ heightCm: 180, weightKg: 65, sizing: 'mens' });
    expect(m.chestCm).toBeGreaterThan(84);
    expect(m.chestCm).toBeLessThan(94);
    expect(m.waistCm).toBeGreaterThan(70);
    expect(m.waistCm).toBeLessThan(80);
    expect(m.inseamCm).toBeCloseTo(81);
  });

  it('gives plausible numbers for a heavier man (175 cm, 110 kg)', () => {
    const { measurements: m } = estimateBody({ heightCm: 175, weightKg: 110, sizing: 'mens' });
    expect(m.chestCm).toBeGreaterThan(114);
    expect(m.chestCm).toBeLessThan(126);
    expect(m.waistCm).toBeGreaterThan(m.chestCm - 10); // waist catches up with chest
  });

  it('uses the womens profile when asked', () => {
    const { measurements: m } = estimateBody({ heightCm: 163, weightKg: 68, sizing: 'womens' });
    expect(m.chestCm).toBeCloseTo(PROFILE_MODELS.womens.ref.chestCm);
    expect(m.hipsCm).toBeGreaterThan(m.chestCm);
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
});
