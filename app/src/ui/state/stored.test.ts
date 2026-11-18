import { describe, expect, it } from 'vitest';
import { isOutfit, isStoredBody, isUnitSystem } from './stored';

describe('stored data guards', () => {
  it('accepts a valid body and rejects broken ones', () => {
    expect(isStoredBody({ heightCm: 176, weightKg: 85, sizing: 'mens' })).toBe(true);
    expect(isStoredBody(null)).toBe(true);
    expect(isStoredBody({ heightCm: '176', weightKg: 85, sizing: 'mens' })).toBe(false);
    expect(isStoredBody({ heightCm: 70, weightKg: 85, sizing: 'mens' })).toBe(false);
    expect(isStoredBody({ heightCm: 176, weightKg: 85, sizing: 'other' })).toBe(false);
    expect(isStoredBody('hello')).toBe(false);
  });

  it('checks units and outfits', () => {
    expect(isUnitSystem('imperial')).toBe(true);
    expect(isUnitSystem('cm')).toBe(false);
    expect(isOutfit({ topId: 'a', topSize: 'M', bottomId: null, bottomSize: null })).toBe(true);
    expect(isOutfit({ topId: 3 })).toBe(false);
  });
});
