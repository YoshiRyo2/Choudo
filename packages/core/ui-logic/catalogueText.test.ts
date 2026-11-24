import { describe, expect, it } from 'vitest';
import { catalogueOptions, catalogueToggle, emptyCategoryText, endOfMatchingFeedText } from './catalogueText';

describe('catalogue wording', () => {
  it('names the body’s own sizing', () => {
    expect(catalogueOptions('womens').map((o) => o.label)).toEqual(['Women’s & unisex', 'All']);
    expect(catalogueOptions('mens')[0]).toEqual({ value: 'matching', label: 'Men’s & unisex' });
  });

  it('says when a category has nothing to show', () => {
    expect(emptyCategoryText('womens', 'bottom')).toBe('No women’s or unisex bottoms yet.');
    expect(endOfMatchingFeedText('mens')).toBe('You’ve seen every men’s and unisex garment we have.');
  });

  it('gives the compact Show chip its label, accessible name and the scope a press switches to', () => {
    expect(catalogueToggle('womens', 'matching')).toEqual({
      label: 'Women’s & unisex',
      accessibleName: 'Show: Women’s & unisex',
      next: 'all',
    });
    expect(catalogueToggle('womens', 'all')).toEqual({ label: 'All', accessibleName: 'Show: All', next: 'matching' });
    expect(catalogueToggle('mens', 'matching').label).toBe('Men’s & unisex');
  });
});
