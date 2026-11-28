import { describe, expect, it } from 'vitest';
import { linkBrand, parseProductLink } from './parse';

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
    expect(parseProductLink(`https://shop.example.com/tee then ${TEE}`)).toEqual({ brand: 'unknown', host: 'shop.example.com' });
    expect(parseProductLink(`https://www.zara.com/us/en/x-p04174639.html then ${TEE}`)).toMatchObject({ brand: 'zara', seoId: '04174639' });
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
    expect(parseProductLink('https://www.asos.com/us/prd/12345')).toEqual({ brand: 'unknown', host: 'www.asos.com' });
    expect(parseProductLink('http://Shop.Example.com:8080/item')).toEqual({ brand: 'unknown', host: 'shop.example.com' });
    // Not uniqlo.com itself.
    expect(parseProductLink('https://uniqlo.com.example.net/us/en/products/E424873-000')).toEqual({
      brand: 'unknown',
      host: 'uniqlo.com.example.net',
    });
    expect(parseProductLink('https://zara.com.example.net/us/en/-p04174639.html')).toEqual({ brand: 'unknown', host: 'zara.com.example.net' });
  });

  it('returns null when there is no link', () => {
    expect(parseProductLink('')).toBeNull();
    expect(parseProductLink('crew neck tee in M')).toBeNull();
    expect(parseProductLink('https://')).toBeNull();
  });
});

describe('parseProductLink, Zara', () => {
  const BARE = 'https://www.zara.com/us/en/-p04174639.html';
  const SLUG = 'https://www.zara.com/us/en/interlock-long-sleeve-t-shirt-p04174639.html';

  it('reads a Zara US product link, with or without the slug', () => {
    expect(parseProductLink(BARE)).toEqual({ brand: 'zara', region: 'us', seoId: '04174639', url: BARE });
    expect(parseProductLink(SLUG)).toEqual({ brand: 'zara', region: 'us', seoId: '04174639', url: SLUG });
    expect(parseProductLink(BARE)).not.toHaveProperty('colorProductId');
  });

  it('keeps the colour from ?v1= and drops every other query part and the fragment', () => {
    expect(parseProductLink(`${SLUG}?v1=616513995&v2=2419737&utm_source=share#top`)).toEqual({
      brand: 'zara',
      region: 'us',
      seoId: '04174639',
      colorProductId: 616513995,
      url: `${SLUG}?v1=616513995`,
    });
    expect(parseProductLink(`${SLUG}?utm_source=share&v1=616513993`)).toMatchObject({ colorProductId: 616513993, url: `${SLUG}?v1=616513993` });
  });

  it('ignores a v1 that is not a product id', () => {
    for (const q of ['?v1=abc', '?v1=', '?v1=12345', '?v1=1234567890123', '?V1=616513995']) {
      const link = parseProductLink(`${SLUG}${q}`);
      expect(link, q).toEqual({ brand: 'zara', region: 'us', seoId: '04174639', url: SLUG });
    }
  });

  it('finds the link inside other words, without the punctuation after it', () => {
    expect(parseProductLink(`Is this my size? ${BARE}.`)).toMatchObject({ brand: 'zara', url: BARE });
    expect(parseProductLink(`INTERLOCK T-SHIRT | ZARA United States\n(${SLUG}?v1=616513993)!`)).toMatchObject({
      colorProductId: 616513993,
      url: `${SLUG}?v1=616513993`,
    });
  });

  it('treats http, no www, m., a bare zara.com/ link and another language as the same US page', () => {
    for (const text of [
      'http://www.zara.com/us/en/-p04174639.html',
      'https://zara.com/us/en/-p04174639.html',
      'https://m.zara.com/us/en/-p04174639.html',
      'www.zara.com/us/en/-p04174639.html',
      'zara.com/us/en/-p04174639.html',
      'HTTPS://WWW.ZARA.COM/us/EN/-p04174639.html',
      'https://www.zara.com/us/es/-p04174639.html',
    ]) {
      expect(parseProductLink(text), text).toEqual({ brand: 'zara', region: 'us', seoId: '04174639', url: BARE });
    }
  });

  it("says when a Zara product is from another region's shop", () => {
    expect(parseProductLink('https://www.zara.com/es/en/-p04174639.html')).toEqual({ brand: 'unknown', host: 'www.zara.com', zara: 'other-region' });
    expect(parseProductLink('https://www.zara.com/uk/en/interlock-t-shirt-p04174639.html?v1=616513993')).toMatchObject({ zara: 'other-region' });
  });

  it("says when a Zara link isn't a product page", () => {
    for (const text of [
      'https://www.zara.com/us/',
      'https://www.zara.com/us/en/woman-tshirts-l1362.html',
      'https://www.zara.com/us/en/-p0417463.html',
      'https://www.zara.com/us/en/-p041746399.html',
      'https://www.zara.com/us/en/-p04174639',
      'https://www.zara.com/us/en/share/-p04174639.html',
    ]) {
      expect(parseProductLink(text), text).toEqual({ brand: 'unknown', host: 'www.zara.com', zara: 'not-a-product' });
    }
  });
});

describe('linkBrand', () => {
  it('names the brand of a link, readable or not', () => {
    expect(linkBrand(parseProductLink('https://www.uniqlo.com/us/en/products/E424873-000'))).toBe('uniqlo');
    expect(linkBrand(parseProductLink('https://www.uniqlo.com/jp/ja/products/E424873-000'))).toBe('uniqlo');
    expect(linkBrand(parseProductLink('https://www.zara.com/us/en/-p04174639.html'))).toBe('zara');
    expect(linkBrand(parseProductLink('https://www.zara.com/es/en/-p04174639.html'))).toBe('zara');
    expect(linkBrand(parseProductLink('https://www.example.com/tee'))).toBeUndefined();
    expect(linkBrand(null)).toBeUndefined();
  });
});
