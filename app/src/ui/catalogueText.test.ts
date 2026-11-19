import { describe, expect, it } from 'vitest';
import { catalogueOptions, emptyCategoryText, endOfMatchingFeedText } from './catalogueText';

describe('catalogue wording', () => {
  it('names the body’s own sizing', () => {
    expect(catalogueOptions('womens').map((o) => o.label)).toEqual(['Women’s & unisex', 'All']);
    expect(catalogueOptions('mens')[0]).toEqual({ value: 'matching', label: 'Men’s & unisex' });
  });

  it('says when a category has nothing to show', () => {
    expect(emptyCategoryText('womens', 'bottom')).toBe('No women’s or unisex bottoms yet.');
    expect(endOfMatchingFeedText('mens')).toBe('You’ve seen every men’s and unisex garment we have.');
  });
});
