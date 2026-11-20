import { describe, expect, it } from 'vitest';
import { catalogueFor, fitsBodyType } from './catalogue';
import { GARMENTS } from './garments';

const g = (id: string, sizing: 'mens' | 'womens' | 'unisex', category: 'top' | 'bottom' = 'top') => ({ id, sizing, category });
const list = [g('m-tee', 'mens'), g('w-tee', 'womens'), g('u-tee', 'unisex'), g('m-jean', 'mens', 'bottom'), g('w-jean', 'womens', 'bottom')];

describe('fitsBodyType', () => {
  it('matches the body’s own sizing and unisex', () => {
    expect(fitsBodyType({ sizing: 'unisex' }, 'womens')).toBe(true);
    expect(fitsBodyType({ sizing: 'womens' }, 'womens')).toBe(true);
    expect(fitsBodyType({ sizing: 'mens' }, 'womens')).toBe(false);
    expect(fitsBodyType({ sizing: 'mens' }, 'mens')).toBe(true);
  });
});

describe('catalogueFor', () => {
  it('shows a body its own sizing plus unisex, in catalogue order', () => {
    expect(catalogueFor(list, 'womens', 'matching').map((x) => x.id)).toEqual(['w-tee', 'u-tee', 'w-jean']);
    expect(catalogueFor(list, 'mens', 'matching').map((x) => x.id)).toEqual(['m-tee', 'u-tee', 'm-jean']);
  });

  it('shows everything when asked, and can take one category', () => {
    expect(catalogueFor(list, 'womens', 'all')).toHaveLength(5);
    expect(catalogueFor(list, 'womens', 'matching', 'bottom').map((x) => x.id)).toEqual(['w-jean']);
    expect(catalogueFor(list, 'mens', 'all', 'top').map((x) => x.id)).toEqual(['m-tee', 'w-tee', 'u-tee']);
  });

  it('gives a women’s body the unisex garments and the one women’s row in today’s seed (the A-line skirt)', () => {
    const tops = catalogueFor(GARMENTS, 'womens', 'matching', 'top').map((x) => x.id);
    expect(tops).toEqual(['gildan-5000', 'knightweave-tee', 'gildan-18500', 'comfort-colors-1566']);
    expect(catalogueFor(GARMENTS, 'womens', 'matching', 'bottom').map((x) => x.id)).toEqual(['fieldline-jogger', 'landsend-a-line-skirt']);
    expect(catalogueFor(GARMENTS, 'womens', 'matching').every((x) => x.sizing !== 'mens')).toBe(true);
  });
});
