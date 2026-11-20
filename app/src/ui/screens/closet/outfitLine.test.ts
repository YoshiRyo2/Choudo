import { describe, expect, it } from 'vitest';
import { EMPTY_OUTFIT } from '../../state/stored';
import { outfitLine } from './OutfitCard';

describe('outfitLine', () => {
  it('lists the top, the bottom and the jacket over them, with sizes', () => {
    const outfit = { ...EMPTY_OUTFIT, topId: 'gildan-18500', topSize: 'L', outerId: 'port-authority-j317', outerSize: 'XL' };
    expect(outfitLine(outfit)).toBe('Heavy Blend Hooded Sweatshirt (18500), L · Core Soft Shell Jacket (J317), XL');
    expect(outfitLine(EMPTY_OUTFIT)).toBe('These garments are no longer available');
  });
});
