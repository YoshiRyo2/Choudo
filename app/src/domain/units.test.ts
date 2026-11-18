import { describe, expect, it } from 'vitest';
import {
  cmToFeetInches,
  cmToIn,
  feetInchesToCm,
  fromCm,
  inToCm,
  kgToLb,
  lbToKg,
  round,
  toCm,
} from './units';

describe('units', () => {
  it('converts inches and cm both ways', () => {
    expect(inToCm(1)).toBe(2.54);
    expect(cmToIn(2.54)).toBe(1);
    expect(toCm(38, 'in')).toBeCloseTo(96.52);
    expect(fromCm(96.52, 'in')).toBeCloseTo(38);
    expect(toCm(100, 'cm')).toBe(100);
  });

  it('converts pounds and kg both ways', () => {
    expect(lbToKg(100)).toBeCloseTo(45.359, 3);
    expect(kgToLb(lbToKg(180))).toBeCloseTo(180);
  });

  it('handles feet + inches', () => {
    expect(feetInchesToCm(5, 10)).toBeCloseTo(177.8);
    expect(cmToFeetInches(177.8)).toEqual({ feet: 5, inches: 10 });
    expect(cmToFeetInches(182.88)).toEqual({ feet: 6, inches: 0 });
  });

  it('rounds for display', () => {
    expect(round(1.26)).toBe(1.3);
    expect(round(1.234, 2)).toBe(1.23);
  });
});
