import { describe, expect, it } from 'vitest';
import { parseProductLink } from './parse';

const TEE = 'https://www.uniqlo.com/us/en/products/E424873-000/00';

describe('parseProductLink', () => {
  it('reads a Uniqlo US product link with its colour', () => {
    expect(parseProductLink(TEE)).toEqual({ brand: 'uniqlo', region: 'us', productCode: 'E424873-000', colorCode: '00', url: TEE });
  });

  it('reads one without a colour, and leaves colorCode out', () => {
    const link = parseProductLink('https://www.uniqlo.com/us/en/products/E424873-000');
    expect(link).toEqual({ brand: 'uniqlo', region: 'us', productCode: 'E424873-000', url: 'https://www.uniqlo.com/us/en/products/E424873-000' });
    expect(link).not.toHaveProperty('colorCode');
  });

  it('drops the query string and fragment from the kept link', () => {
    expect(parseProductLink(`${TEE}?colorDisplayCode=00&sizeDisplayCode=004#reviews`)).toMatchObject({ productCode: 'E424873-000', colorCode: '00', url: TEE });
    expect(parseProductLink('https://www.uniqlo.com/us/en/products/E424873-000/?utm_source=share')).toMatchObject({
      url: 'https://www.uniqlo.com/us/en/products/E424873-000',
    });
  });

  it('finds the link inside other words, without the punctuation after it', () => {
    expect(parseProductLink(`Is this my size? ${TEE}.`)).toMatchObject({ brand: 'uniqlo', url: TEE });
    expect(parseProductLink(`Crew Neck T-Shirt | UNIQLO US\n(${TEE})`)).toMatchObject({ url: TEE });
  });

  it('takes the first link when there are several', () => {
    expect(parseProductLink(`${TEE} and https://www.zara.com/us/en/x-p04174639.html`)).toMatchObject({ brand: 'uniqlo' });
    expect(parseProductLink(`https://www.zara.com/us/en/x-p04174639.html then ${TEE}`)).toEqual({ brand: 'unknown', host: 'www.zara.com' });
  });

  it('treats http, no www, m. and upper case the same as https://www.', () => {
    for (const text of [
      'http://www.uniqlo.com/us/en/products/E424873-000/00',
      'https://uniqlo.com/us/en/products/E424873-000/00',
      'https://m.uniqlo.com/us/en/products/E424873-000/00',
      'www.uniqlo.com/us/en/products/E424873-000/00',
      'uniqlo.com/us/en/products/E424873-000/00',
      'HTTPS://WWW.UNIQLO.COM/us/EN/products/e424873-000/00',
    ]) {
      expect(parseProductLink(text), text).toEqual({ brand: 'uniqlo', region: 'us', productCode: 'E424873-000', colorCode: '00', url: TEE });
    }
  });

  it("says when a Uniqlo product is from another region's shop", () => {
    expect(parseProductLink('https://www.uniqlo.com/jp/ja/products/E424873-000/00')).toEqual({
      brand: 'unknown',
      host: 'www.uniqlo.com',
      uniqlo: 'other-region',
    });
    expect(parseProductLink('https://www.uniqlo.com/uk/en/products/E424873-000')).toMatchObject({ uniqlo: 'other-region' });
  });

  it("says when a Uniqlo link isn't a product page", () => {
    for (const text of [
      'https://www.uniqlo.com/us/en/',
      'https://www.uniqlo.com/us/en/women/tops',
      'https://www.uniqlo.com/us/en/products/E42487-000',
      'https://www.uniqlo.com/us/en/products/E424873-000/00/extra',
    ]) {
      expect(parseProductLink(text), text).toEqual({ brand: 'unknown', host: 'www.uniqlo.com', uniqlo: 'not-a-product' });
    }
  });

  it('gives any other site as unknown with its host, without a port', () => {
    expect(parseProductLink('https://www.zara.com/us/en/linen-shirt-p04174639.html?v1=1')).toEqual({ brand: 'unknown', host: 'www.zara.com' });
    expect(parseProductLink('http://Shop.Example.com:8080/item')).toEqual({ brand: 'unknown', host: 'shop.example.com' });
    // Not uniqlo.com itself.
    expect(parseProductLink('https://uniqlo.com.example.net/us/en/products/E424873-000')).toEqual({
      brand: 'unknown',
      host: 'uniqlo.com.example.net',
    });
  });

  it('returns null when there is no link', () => {
    expect(parseProductLink('')).toBeNull();
    expect(parseProductLink('crew neck tee in M')).toBeNull();
    expect(parseProductLink('https://')).toBeNull();
  });
});
