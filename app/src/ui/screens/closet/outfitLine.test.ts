import { describe, expect, it } from 'vitest';
import { EMPTY_OUTFIT } from '../../state/stored';
import { outfitLine } from './OutfitCard';

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
