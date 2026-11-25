import { describe, expect, it } from 'vitest';
import { GARMENTS, publicGarments } from '../domain/garments';
import { EMPTY_OUTFIT } from './state/stored';
import { outfitGarmentLines, outfitLine } from './closetText';

describe('outfitLine', () => {
  it('lists the top, the bottom and the jacket over them, with sizes', () => {
    const outfit = { ...EMPTY_OUTFIT, topId: 'gildan-18500', topSize: 'L', outerId: 'port-authority-j317', outerSize: 'XL', onepieceId: null, onepieceSize: null };
    expect(outfitLine(outfit)).toBe('Heavy Blend Hooded Sweatshirt (18500), L · Core Soft Shell Jacket (J317), XL');
    expect(outfitLine(EMPTY_OUTFIT)).toBe('These garments are no longer available');
  });

  it('lists a dress, and the jacket over it', () => {
    const outfit = { ...EMPTY_OUTFIT, onepieceId: 'landsend-sheath-dress', onepieceSize: '10', outerId: 'port-authority-l317', outerSize: 'M' };
    expect(outfitLine(outfit)).toBe('Women\'s Washable Wool Piped Sheath Dress (Regular), 10 · Ladies Core Soft Shell Jacket (L317), M');
  });
});

describe('outfitGarmentLines', () => {
  it('gives "{brand} {name} · {size}" per garment in outfitLine’s order, leaving out ones that are gone', () => {
    const outfit = {
      ...EMPTY_OUTFIT,
      topId: 'gildan-18500',
      topSize: 'L',
      bottomId: 'garment-that-is-gone',
      bottomSize: '32',
      outerId: 'port-authority-j317',
      outerSize: 'XL',
    };
    expect(outfitGarmentLines(outfit)).toEqual(['Gildan Heavy Blend Hooded Sweatshirt (18500) · L', 'Port Authority Core Soft Shell Jacket (J317) · XL']);
    expect(outfitGarmentLines(EMPTY_OUTFIT)).toEqual([]);
  });
});

describe('outfitLine on the public site', () => {
  it('leaves out a garment the catalogue hides', () => {
    const live = publicGarments(GARMENTS, { includeSamples: false });
    const outfit = { ...EMPTY_OUTFIT, topId: 'gildan-18500', topSize: 'L', bottomId: 'fieldline-jogger', bottomSize: 'M' };
    expect(outfitLine(outfit)).toMatch(/Jogger/);
    expect(outfitLine(outfit, live)).toBe('Heavy Blend Hooded Sweatshirt (18500), L');
    expect(outfitGarmentLines(outfit, live)).toHaveLength(1);
  });
});
