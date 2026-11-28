import { describe, expect, it } from 'vitest';
import { parseProductLink } from '../domain/links';
import { brandText, canRetry, CHECK_TEXT, checkErrorText, colourLabel, linkError, productBrand, type CheckError } from './checkText';

const errorOf = (text: string) => linkError(parseProductLink(text));

describe('linkError', () => {
  it('passes a Uniqlo US or Zara US product link', () => {
    expect(errorOf('https://www.uniqlo.com/us/en/products/E424873-000/00')).toBeNull();
    expect(errorOf('https://www.zara.com/us/en/-p04174639.html')).toBeNull();
  });

  it('names what is wrong with anything else', () => {
    expect(errorOf('crew neck tee')).toBe('no-link');
    expect(errorOf('https://www.uniqlo.com/us/en/women/tops')).toBe('no-link');
    expect(errorOf('https://www.uniqlo.com/jp/ja/products/E424873-000')).toBe('other-region');
    expect(errorOf('https://www.zara.com/es/en/-p04174639.html')).toBe('other-region');
    expect(errorOf('https://www.zara.com/us/en/woman-tshirts-l1362.html')).toBe('no-link');
    expect(errorOf('https://www.hm.com/us/product/1234')).toBe('unknown-brand');
  });
});

describe('check error wording', () => {
  const all: CheckError[] = ['no-link', 'unknown-brand', 'other-region', 'network', 'not-found', 'unsupported-parts', 'no-sizes', 'unreadable-chart', 'bad-response'];

  it('uses the agreed lines', () => {
    expect(checkErrorText('no-link', 'uniqlo')).toBe('Paste a product link from uniqlo.com.');
    expect(checkErrorText('unknown-brand')).toBe('Choudo can read Uniqlo and Zara links for now. More brands soon.');
    expect(checkErrorText('other-region')).toBe('Only Uniqlo US links for now.');
    expect(checkErrorText('network')).toBe('Couldn’t reach Uniqlo. Check your connection and try again.');
    expect(checkErrorText('unsupported-parts')).toBe('Choudo can only check tops from Uniqlo for now.');
  });

  it('keeps every Uniqlo line word for word', () => {
    expect(all.map((e) => checkErrorText(e, 'uniqlo'))).toEqual([
      'Paste a product link from uniqlo.com.',
      'Choudo can read Uniqlo and Zara links for now. More brands soon.',
      'Only Uniqlo US links for now.',
      'Couldn’t reach Uniqlo. Check your connection and try again.',
      'Uniqlo has no product at this link. Paste another product link.',
      'Choudo can only check tops from Uniqlo for now.',
      'Uniqlo doesn’t list garment measurements for this product. Try another one.',
      'Choudo can’t read this product’s size chart yet. Try another product.',
      'Couldn’t read Uniqlo’s size chart. Try again in a moment.',
    ]);
    expect(brandText('uniqlo')).toEqual({ loading: 'Reading Uniqlo’s size chart…', openAt: 'Open at Uniqlo', photoCredit: 'Photo: Uniqlo' });
  });

  it('names Zara for a Zara link', () => {
    expect(checkErrorText('no-link', 'zara')).toBe('Paste a product link from zara.com.');
    expect(checkErrorText('other-region', 'zara')).toBe('Only Zara US links for now.');
    expect(checkErrorText('network', 'zara')).toBe('Couldn’t reach Zara. Check your connection and try again.');
    expect(checkErrorText('not-found', 'zara')).toBe('Zara has no product at this link. Paste another product link.');
    expect(checkErrorText('unsupported-parts', 'zara')).toBe('Choudo can only check tops from Zara for now.');
    expect(checkErrorText('no-sizes', 'zara')).toBe('Zara doesn’t list garment measurements for this product. Try another one.');
    expect(checkErrorText('bad-response', 'zara')).toBe('Couldn’t read Zara’s size chart. Try again in a moment.');
    expect(brandText('zara')).toEqual({ loading: 'Reading Zara’s size chart…', openAt: 'Open at Zara', photoCredit: 'Photo: Zara' });
  });

  it('names both sites when there is no link at all, and both brands on the field', () => {
    expect(checkErrorText('no-link')).toBe('Paste a product link from uniqlo.com or zara.com.');
    expect(CHECK_TEXT.field).toBe('Paste a Uniqlo or Zara link');
    expect(CHECK_TEXT.scope).toBe('Works with Uniqlo US and Zara US tops for now.');
  });

  it('never blames ("you pasted", "invalid", "wrong"), at most two sentences', () => {
    for (const brand of [undefined, 'uniqlo', 'zara'] as const) {
      for (const e of all) {
        const text = checkErrorText(e, brand);
        expect(text, e).not.toMatch(/\byou (entered|typed|pasted|gave)\b|\binvalid\b|\bwrong\b|\bbad\b/i);
        expect(text.split(/[.!?](\s|$)/).filter((s) => s.trim().length > 1).length, e).toBeLessThanOrEqual(2);
      }
    }
  });

  it('offers Retry only where trying again can help', () => {
    expect(all.filter(canRetry)).toEqual(['network', 'bad-response']);
  });
});

describe('productBrand', () => {
  it('reads the brand from the garment', () => {
    expect(productBrand({ brand: 'Zara' })).toBe('zara');
    expect(productBrand({ brand: 'Uniqlo' })).toBe('uniqlo');
  });
});

describe('colourLabel', () => {
  it('reads a colour name in title case', () => {
    expect(colourLabel('OFF WHITE')).toBe('Off White');
    expect(colourLabel('DARK  GRAY')).toBe('Dark Gray');
    expect(colourLabel('black')).toBe('Black');
  });
});
