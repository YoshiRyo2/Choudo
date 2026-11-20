import { describe, expect, it } from 'vitest';
import {
  isAnchor,
  isBoolean,
  isFitStyle,
  isFitTestList,
  isFolderList,
  isOutfit,
  isSavedOutfitList,
  isCatalogueScope,
  isStoredBody,
  isSwipeList,
  isUnitSystem,
} from './stored';

describe('stored data guards', () => {
  it('accepts a valid body and rejects broken ones', () => {
    expect(isStoredBody({ heightCm: 176, weightKg: 85, bodyType: 'mens' })).toBe(true);
    expect(isStoredBody(null)).toBe(true);
    expect(isStoredBody({ heightCm: '176', weightKg: 85, bodyType: 'mens' })).toBe(false);
    expect(isStoredBody({ heightCm: 70, weightKg: 85, bodyType: 'mens' })).toBe(false);
    expect(isStoredBody({ heightCm: 176, weightKg: 85, bodyType: 'other' })).toBe(false);
    expect(isStoredBody('hello')).toBe(false);
    expect(isStoredBody({ heightCm: 176, weightKg: 85, sizing: 'mens' })).toBe(false); // v1 shape: migrate.ts moves it
    const bra = { band: 34, cup: 'C', system: 'us' };
    expect(isStoredBody({ heightCm: 165, weightKg: 60, bodyType: 'womens', overrides: { braSize: bra } })).toBe(true);
    expect(isStoredBody({ heightCm: 165, weightKg: 60, bodyType: 'womens', overrides: { braSize: { ...bra, system: 'eu' } } })).toBe(false);
    expect(isStoredBody({ heightCm: 165, weightKg: 60, bodyType: 'womens', overrides: { braSize: { ...bra, cup: 'Q' } } })).toBe(false);
  });

  it('checks the catalogue scope', () => {
    expect(isCatalogueScope('matching')).toBe(true);
    expect(isCatalogueScope('all')).toBe(true);
    expect(isCatalogueScope('womens')).toBe(false);
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

describe('fit preference guards', () => {
  it('checks anchors', () => {
    expect(isAnchor(null)).toBe(true);
    expect(isAnchor({ kind: 'catalogue', garmentId: 'gildan-5000', size: 'M' })).toBe(true);
    expect(isAnchor({ kind: 'measured', chestFlatCm: 53, lengthCm: 74 })).toBe(true);
    expect(isAnchor({ kind: 'measured', chestFlatCm: 106, lengthCm: 74 })).toBe(false); // full chest, not flat
    expect(isAnchor({ kind: 'catalogue', garmentId: 3, size: 'M' })).toBe(false);
    expect(isAnchor({ kind: 'photo' })).toBe(false);
  });

  it('checks fit styles and test mode', () => {
    expect(isFitStyle('oversized')).toBe(true);
    expect(isFitStyle(null)).toBe(true);
    expect(isFitStyle('baggy')).toBe(false);
    expect(isBoolean(true)).toBe(true);
    expect(isBoolean('true')).toBe(false);
  });
});

describe('fit test guards', () => {
  const prediction = {
    category: 'top',
    body: { heightCm: 178, weightKg: 75, bodyType: 'mens' },
    chestCm: 96.4,
    chestSource: 'estimated',
    torsoLengthCm: 73,
    preferenceSource: 'default',
    style: 'regular',
    anchor: '',
    preferredChestEaseCm: 5,
    preferredLengthDiffCm: null,
    recommendedSize: 'M',
    verdict: 'fits',
    likes: 0.39,
    chestLabel: 'relaxed',
    lengthLabel: 'good',
    chest: { under: 0.24, right: 0.47, over: 0.29 },
    length: { under: 0.05, right: 0.9, over: 0.05 },
  };
  const record = {
    id: 'r1',
    tester: 'T01',
    at: '2026-11-18T10:00:00Z',
    garmentId: 'gildan-5000',
    size: 'M',
    category: 'top',
    chest: 'just-right',
    length: 'too-short',
    keptSize: 'M',
    prediction,
  };

  it('accepts a full record and rejects broken ones', () => {
    expect(isFitTestList([record])).toBe(true);
    expect(isFitTestList([{ ...record, keptSize: null }])).toBe(true);
    expect(isFitTestList([{ ...record, chest: 'tight' }])).toBe(false);
    expect(isFitTestList([{ ...record, prediction: { ...prediction, chest: { under: 1 } } }])).toBe(false);
    expect(isFitTestList([{ ...record, prediction: { ...prediction, body: null } }])).toBe(false);
    // A v2 record (no category) is migrated, not read as is.
    const { category: _c, ...v2 } = record;
    expect(isFitTestList([v2])).toBe(false);
  });

  it('accepts a bottom: no chest answer, waist and thigh answers and chances', () => {
    const bottom = {
      ...record,
      category: 'bottom',
      chest: null,
      waist: 'too-tight',
      thigh: 'just-right',
      prediction: {
        ...prediction,
        category: 'bottom',
        preferredChestEaseCm: null,
        inseamCm: 80,
        waistCm: 90,
        thighCm: 60,
        waistLabel: 'fitted',
        thighLabel: 'relaxed',
        waist: { under: 0.2, right: 0.7, over: 0.1 },
        thigh: { under: 0.1, right: 0.8, over: 0.1 },
      },
    };
    expect(isFitTestList([bottom])).toBe(true);
    expect(isFitTestList([{ ...bottom, waist: 'snug' }])).toBe(false);
    expect(isFitTestList([{ ...bottom, prediction: { ...bottom.prediction, waist: { under: 1 } } }])).toBe(false);
  });
});
