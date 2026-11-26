import { describe, expect, it } from 'vitest';
import { parseProductLink } from '../domain/links';
import { canRetry, checkErrorText, linkError, type CheckError } from './checkText';

const errorOf = (text: string) => linkError(parseProductLink(text));

describe('linkError', () => {
  it('passes a Uniqlo US product link', () => {
    expect(errorOf('https://www.uniqlo.com/us/en/products/E424873-000/00')).toBeNull();
  });

  it('names what is wrong with anything else', () => {
    expect(errorOf('crew neck tee')).toBe('no-link');
    expect(errorOf('https://www.uniqlo.com/us/en/women/tops')).toBe('no-link');
    expect(errorOf('https://www.uniqlo.com/jp/ja/products/E424873-000')).toBe('other-region');
    expect(errorOf('https://www.zara.com/us/en/x-p04174639.html')).toBe('unknown-brand');
  });
});

describe('check error wording', () => {
  const all: CheckError[] = ['no-link', 'unknown-brand', 'other-region', 'network', 'not-found', 'unsupported-parts', 'no-sizes', 'bad-response'];

  it('uses the agreed lines', () => {
    expect(checkErrorText('no-link')).toBe('Paste a product link from uniqlo.com.');
    expect(checkErrorText('unknown-brand')).toBe('Choudo can read Uniqlo links for now. More brands soon.');
    expect(checkErrorText('other-region')).toBe('Only Uniqlo US links for now.');
    expect(checkErrorText('network')).toBe('Couldn’t reach Uniqlo. Check your connection and try again.');
    expect(checkErrorText('unsupported-parts')).toBe('Choudo can only check tops from Uniqlo for now.');
  });

  it('never blames ("you pasted", "invalid", "wrong"), at most two sentences', () => {
    for (const e of all) {
      const text = checkErrorText(e);
      expect(text, e).not.toMatch(/\byou (entered|typed|pasted|gave)\b|\binvalid\b|\bwrong\b|\bbad\b/i);
      expect(text.split(/[.!?](\s|$)/).filter((s) => s.trim().length > 1).length, e).toBeLessThanOrEqual(2);
    }
  });

  it('offers Retry only where trying again can help', () => {
    expect(all.filter(canRetry)).toEqual(['network', 'bad-response']);
  });
});
