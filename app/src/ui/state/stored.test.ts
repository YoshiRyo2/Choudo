import { describe, expect, it } from 'vitest';
import { isFolderList, isOutfit, isSavedOutfitList, isStoredBody, isSwipeList, isUnitSystem } from './stored';

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

describe('closet data guards', () => {
  it('checks swipes', () => {
    expect(isSwipeList([])).toBe(true);
    expect(isSwipeList([{ garmentId: 'a', sizeShown: 'M', liked: true, at: '2026-11-18T10:00:00Z' }])).toBe(true);
    expect(isSwipeList([{ garmentId: 'a', sizeShown: 'M', liked: 'yes', at: 'x' }])).toBe(false);
    expect(isSwipeList({ garmentId: 'a' })).toBe(false);
  });

  it('checks folders', () => {
    expect(isFolderList([{ id: 'f1', name: 'Work', items: [{ kind: 'garment', id: 'a' }, { kind: 'outfit', id: 'o1' }] }])).toBe(true);
    expect(isFolderList([{ id: 'f1', name: 'Work', items: [{ kind: 'hat', id: 'a' }] }])).toBe(false);
    expect(isFolderList([{ id: 'f1', name: 'Work' }])).toBe(false);
  });

  it('checks saved outfits', () => {
    const outfit = { id: 'o1', name: 'Friday', savedAt: 'x', topId: 'a', topSize: 'M', bottomId: null, bottomSize: null };
    expect(isSavedOutfitList([outfit])).toBe(true);
    expect(isSavedOutfitList([{ ...outfit, name: 3 }])).toBe(false);
  });
});
