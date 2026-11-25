import { describe, expect, it } from 'vitest';
import { catalogueFor, categoriesIn, fitsBodyType, publicGarments } from './catalogue';
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

  it('gives a women’s body the unisex garments and the women’s bottoms (the A-line skirt and the Sport-Tek leggings)', () => {
    const tops = catalogueFor(GARMENTS, 'womens', 'matching', 'top').map((x) => x.id);
    expect(tops).toEqual(['gildan-5000', 'knightweave-tee', 'gildan-18500', 'comfort-colors-1566']);
    expect(catalogueFor(GARMENTS, 'womens', 'matching', 'bottom').map((x) => x.id)).toEqual(['fieldline-jogger', 'landsend-a-line-skirt', 'sporttek-lpst890', 'sporttek-lpst880']);
    expect(catalogueFor(GARMENTS, 'womens', 'matching').every((x) => x.sizing !== 'mens')).toBe(true);
  });
});

describe('publicGarments', () => {
  const rows = [
    { id: 'real', source: { placeholder: false } },
    { id: 'sample', source: { placeholder: true } },
    { id: 'real-2', source: { placeholder: false } },
  ];

  it('leaves the placeholder rows out unless samples are asked for, in catalogue order', () => {
    expect(publicGarments(rows, { includeSamples: false }).map((g) => g.id)).toEqual(['real', 'real-2']);
    expect(publicGarments(rows, { includeSamples: true }).map((g) => g.id)).toEqual(['real', 'sample', 'real-2']);
  });

  it('hides every Fieldline, Corvo and ryo- sample from the public catalogue, and keeps every real chart', () => {
    const shown = publicGarments(GARMENTS, { includeSamples: false });
    expect(shown.every((g) => !g.source.placeholder)).toBe(true);
    expect(shown.some((g) => /^(fieldline|corvo|ryo)-/.test(g.id))).toBe(false);
    expect(shown).toHaveLength(GARMENTS.filter((g) => !g.source.placeholder).length);
    // The samples are still in seed.json for tests and development.
    expect(GARMENTS.some((g) => g.source.placeholder)).toBe(true);
  });

  it('leaves the public catalogue with no pants, chinos or jeans (only real charts: shorts, a skirt, leggings)', () => {
    const bottoms = publicGarments(GARMENTS, { includeSamples: false }).filter((g) => g.category === 'bottom');
    expect(bottoms.map((g) => g.type).sort()).toEqual(['leggings', 'leggings', 'shorts', 'skirt']);
  });
});

describe('categoriesIn', () => {
  it('names the categories that have at least one garment', () => {
    expect([...categoriesIn(list)].sort()).toEqual(['bottom', 'top']);
    expect(categoriesIn([]).size).toBe(0);
  });
});
