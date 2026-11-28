import { describe, expect, it } from 'vitest';
import { estimateBody } from '../body';
import { fitGarment } from '../fit';
import { recommendSize } from '../fit/sampleFit';
import { preferenceSpec } from '../fit/preference';
import { validateSeed } from '../garments';
import guideFixture from './__fixtures__/zara-guide-616513993.json';
import missingGuide from './__fixtures__/zara-guide-missing.json';
import searchFixture from './__fixtures__/zara-search-04174639.json';
import noMatch from './__fixtures__/zara-search-no-match.json';
import { colorHex } from './colors';
import { parseProductLink, type ZaraLink } from './parse';
import { readyFetchedGarment } from './uniqlo';
import { isMissingZara, isMissingZaraGuide, ZARA_NOTES, zaraGarmentId, zaraProduct, zaraSizeGuideId, zaraToSeedGarment } from './zara';
import { zaraUrls } from './zaraUrls';

const zara = (text: string) => parseProductLink(text) as ZaraLink;
const navy = zara('https://www.zara.com/us/en/interlock-long-sleeve-t-shirt-p04174639.html?v1=616513993');
const black = zara('https://www.zara.com/us/en/-p04174639.html?v1=616513995');
const bare = zara('https://www.zara.com/us/en/-p04174639.html');
const ON = '2026-11-28';
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const convert = (search: unknown = searchFixture, guide: unknown = guideFixture, at: ZaraLink = navy) => zaraToSeedGarment(search, guide, at, ON);
const NAVY_PHOTO =
  'https://static.zara.net/assets/public/dbac/ddca/22954b569097/d4c2aec298bf/04174639401-p/04174639401-p.jpg?ts=1795509515737&w=750';
const BLACK_PHOTO =
  'https://static.zara.net/assets/public/0f3a/6dc2/0b8149efa359/b325e50d501b/04174639800-p/04174639800-p.jpg?ts=1795509507255&w=750';

type Guide = typeof guideFixture;
type Measure = Guide['measureGuideInfo']['sizes'][number]['measures'][number];
/** The guide fixture with every measure passed through `edit`. */
function withMeasures(edit: (m: Measure, size: string) => void): Guide {
  const g = clone(guideFixture);
  for (const s of g.measureGuideInfo.sizes) for (const m of s.measures) edit(m, s.name);
  return g;
}
type Search = typeof searchFixture;
/** The search fixture with each result's content passed through `edit`. */
function withContent(edit: (c: Search['results'][number]['content']) => void): Search {
  const s = clone(searchFixture);
  for (const r of s.results) edit(r.content);
  return s;
}

describe('zaraUrls', () => {
  it('builds exactly the search and size-guide addresses for Zara US', () => {
    expect(zaraUrls.search('04174639')).toBe('https://www.zara.com/itxrest/1/search/store/11719/query?query=04174639&locale=en_US');
    expect(zaraUrls.sizeGuide(616513993)).toBe('https://www.zara.com/itxrest/5/catalog/store/11719/product/616513993/size-measure-guide?locale=en_US');
    expect(zaraUrls.sizeGuide('616513993')).toBe(zaraUrls.sizeGuide(616513993));
  });
});

describe('zaraProduct', () => {
  it('reads the colours from the results for this product only', () => {
    const p = zaraProduct(searchFixture, '04174639', 616513993);
    expect(p).toMatchObject({ name: 'INTERLOCK LONG-SLEEVE T-SHIRT', sectionName: 'WOMAN', familyName: 'T-SHIRT', colorProductId: 616513993 });
    expect(p!.colors).toEqual([
      { code: '401', productId: 616513993, name: 'Navy blue', hex: '#252731', imageUrl: NAVY_PHOTO, priceCents: 1794, oldPriceCents: 2990 },
      // Green and Ecru have no result of their own in the trimmed fixture, so no photo.
      { code: '500', productId: 563665433, name: 'Green', hex: '#365b24', imageUrl: null, priceCents: 1794, oldPriceCents: 2990 },
      { code: '712', productId: 616513999, name: 'Ecru', hex: '#c3b4ab', imageUrl: null, priceCents: 1794, oldPriceCents: 2990 },
      { code: '800', productId: 616513995, name: 'Black', hex: '#121315', imageUrl: BLACK_PHOTO, priceCents: 1794, oldPriceCents: 2990 },
    ]);
  });

  it("chooses the link's colour when it's one of them, else the first result's", () => {
    expect(zaraProduct(searchFixture, '04174639', 616513995)?.colorProductId).toBe(616513995);
    expect(zaraProduct(searchFixture, '04174639')?.colorProductId).toBe(616513995);
    expect(zaraProduct(searchFixture, '04174639', 123456789)?.colorProductId).toBe(616513995);
    // A colour listed without a result of its own still counts.
    expect(zaraProduct(searchFixture, '04174639', 563665433)?.colorProductId).toBe(563665433);
    expect(zaraSizeGuideId(searchFixture, navy)).toBe(616513993);
    expect(zaraSizeGuideId(searchFixture, bare)).toBe(616513995);
    expect(zaraSizeGuideId(noMatch, bare)).toBeNull();
  });

  it('ignores the fuzzy search’s other products', () => {
    expect(zaraProduct(noMatch, '99999998')).toBeUndefined();
    expect(zaraProduct(noMatch, '41200052')).toMatchObject({ name: '4-IN-A-ROW GAME', familyName: 'TOYS' });
  });

  it('falls back to our own colour for a hex Zara gives badly, and expands #rgb', () => {
    const s = withContent((c) => {
      for (const a of c.availableColors) {
        if (a.colorName === 'Navy blue') a.hexColor = 'navy';
        if (a.colorName === 'Ecru') a.hexColor = '#abc';
      }
    });
    const colors = zaraProduct(s, '04174639')!.colors;
    expect(colors.find((c) => c.name === 'Navy blue')!.hex).toBe(colorHex('Navy blue'));
    expect(colors.find((c) => c.name === 'Ecru')!.hex).toBe('#aabbcc');
  });

  it('gives null for a malformed search', () => {
    expect(zaraProduct('not json', '04174639')).toBeNull();
    expect(zaraProduct({ status: 'ERROR' }, '04174639')).toBeNull();
    expect(zaraProduct({ status: 'SUCCESS' }, '04174639')).toBeNull();
  });
});

describe('isMissingZara', () => {
  it('is true only for a well-formed SUCCESS without this product', () => {
    expect(isMissingZara(noMatch, '99999998')).toBe(true);
    expect(isMissingZara(JSON.stringify(noMatch), '99999998')).toBe(true);
    expect(isMissingZara(searchFixture, '04174639')).toBe(false);
    expect(isMissingZara({ status: 'ERROR' }, '04174639')).toBe(false);
    expect(isMissingZara('<html>Access Denied</html>', '04174639')).toBe(false);
  });
});

describe('isMissingZaraGuide', () => {
  it("is Zara's no-guide 404 body, not the fetch service's 404 or a guide", () => {
    expect(isMissingZaraGuide(missingGuide)).toBe(true);
    expect(isMissingZaraGuide(JSON.stringify(missingGuide))).toBe(true);
    expect(isMissingZaraGuide({ status: 'error', reason: 'not-found' })).toBe(false);
    expect(isMissingZaraGuide(guideFixture)).toBe(false);
    expect(isMissingZaraGuide('<html>Not Found</html>')).toBe(false);
  });
});

describe('zaraToSeedGarment', () => {
  it('turns the navy link into a seed row, copied as printed', () => {
    const r = convert();
    if (!r.ok) throw new Error(r.reason);
    expect(r.garment).toEqual({
      id: 'zara-04174639',
      brand: 'Zara',
      name: 'Interlock Long-Sleeve T-Shirt',
      category: 'top',
      type: 'long-sleeve-tee',
      sizing: 'womens',
      color: '#252731',
      sleeve: 'long',
      stretch: 'none',
      stretchAssumed: true,
      fitIntent: 'regular',
      source: { placeholder: false, tier: 'B', url: navy.url, capturedOn: ON, notes: ZARA_NOTES },
      chart: { unit: 'cm', girth: 'flat', definitions: { length: 'hps', sleeve: 'shoulder_to_cuff' } },
      sizes: [
        { label: 'S', measurements: { chest: 43, length: 61, sleeve: 61, shoulder: 39 } },
        { label: 'M', measurements: { chest: 46, length: 63, sleeve: 62.5, shoulder: 41.5 } },
        { label: 'L', measurements: { chest: 49, length: 65, sleeve: 64, shoulder: 44 } },
        { label: 'XL', measurements: { chest: 52, length: 67, sleeve: 65.5, shoulder: 46.5 } },
      ],
    });
    expect(zaraGarmentId('04174639')).toBe(r.garment.id);
  });

  it('keeps the price, the chosen colour and its photo, every colour and the link alongside', () => {
    const r = convert();
    if (!r.ok) throw new Error(r.reason);
    expect(r.product).toEqual({
      garment: r.garment,
      priceText: '$17.94',
      imageUrl: NAVY_PHOTO,
      productUrl: navy.url,
      colorCode: '401',
      colorName: 'Navy blue',
      cutText: 'Long sleeve',
      colors: [
        { code: '401', name: 'Navy blue', hex: '#252731', imageUrl: NAVY_PHOTO },
        { code: '500', name: 'Green', hex: '#365b24', imageUrl: null },
        { code: '712', name: 'Ecru', hex: '#c3b4ab', imageUrl: null },
        { code: '800', name: 'Black', hex: '#121315', imageUrl: BLACK_PHOTO },
      ],
    });
    expect(new Set(r.product.colors!.map((c) => c.hex)).size).toBe(4);
  });

  it('?v1= picks Black and the black photo', () => {
    const r = convert(searchFixture, guideFixture, black);
    if (!r.ok) throw new Error(r.reason);
    expect(r.garment.color).toBe('#121315');
    expect(r.product).toMatchObject({ colorCode: '800', colorName: 'Black', imageUrl: BLACK_PHOTO, productUrl: black.url });
    // The black result's own wording of the name.
    expect(r.garment.name).toBe('Long-Sleeve Interlock T-Shirt');
  });

  it('passes the seed checks and gets a size from the fit engine, sleeve scored', () => {
    const r = convert();
    if (!r.ok) throw new Error(r.reason);
    expect(validateSeed([r.garment])).toEqual([]);
    const garment = readyFetchedGarment(r.garment);
    expect(garment).not.toBeNull();
    const body = estimateBody({ heightCm: 165, weightKg: 60, bodyType: 'womens' });
    const fit = fitGarment(body, garment!, 'M');
    expect(fit.zones.find((z) => z.zone === 'sleeve')?.label).not.toBe('unknown');
    expect(fit.zones.find((z) => z.zone === 'length')?.label).not.toBe('unknown');
    expect(['S', 'M', 'L', 'XL']).toContain(recommendSize(body, garment!, preferenceSpec(null, null)));
  });

  it('reads the responses as text too', () => {
    expect(zaraToSeedGarment(JSON.stringify(searchFixture), JSON.stringify(guideFixture), navy, ON)).toEqual(convert());
  });

  it('gives no-sizes for a product without a guide (the 404 body) or an empty one', () => {
    expect(convert(searchFixture, missingGuide)).toEqual({ ok: false, reason: 'no-sizes' });
    const empty = clone(guideFixture);
    empty.measureGuideInfo.sizes = [];
    expect(convert(searchFixture, empty)).toEqual({ ok: false, reason: 'no-sizes' });
  });

  it("won't guess the girth method: a chest that isn't side to side is unsupported", () => {
    const round = withMeasures((m) => {
      if (m.tableTitle === 'CHEST') m.description = 'Measure the circumference at armhole height.';
    });
    expect(convert(searchFixture, round)).toEqual({ ok: false, reason: 'unsupported-parts' });
  });

  it('reads tops only (a blazer has a chest too, but would be drawn wrong as a tee)', () => {
    const blazer = withContent((c) => {
      c.familyName = 'BLAZER';
    });
    expect(convert(blazer)).toEqual({ ok: false, reason: 'unsupported-parts' });
    for (const family of ['TOP', 'BODYSUIT', 'POLO SHIRT']) {
      expect(convert(withContent((c) => void (c.familyName = family))).ok, family).toBe(true);
    }
  });

  it('drops a size whose chest is a range, and a repeated label; none left is unsupported', () => {
    const ranged = withMeasures((m, size) => {
      if (size === 'S' && m.tableTitle === 'CHEST') m.dimensions[0]!.value = '43 - 45';
    });
    const r = convert(searchFixture, ranged);
    if (!r.ok) throw new Error(r.reason);
    expect(r.garment.sizes.map((s) => s.label)).toEqual(['M', 'L', 'XL']);

    const twice = clone(guideFixture);
    twice.measureGuideInfo.sizes.push(clone(twice.measureGuideInfo.sizes[0]!));
    const t = convert(searchFixture, twice);
    expect(t.ok && t.garment.sizes.map((s) => s.label)).toEqual(['S', 'M', 'L', 'XL']);

    const noLength = withMeasures((m) => {
      if (m.tableTitle === 'FRONT LENGTH') m.tableTitle = 'BACK LENGTH';
    });
    expect(convert(searchFixture, noLength)).toEqual({ ok: false, reason: 'unsupported-parts' });
  });

  it('maps by title, whatever the zone letter', () => {
    const shuffled = withMeasures((m) => {
      m.zoneId = 'Z';
      m.tableTitle = ` ${m.tableTitle.toLowerCase()} `;
    });
    expect(convert(searchFixture, shuffled)).toEqual(convert());
  });

  it('takes the sleeve from the numbers when the name says nothing', () => {
    const plain = withContent((c) => void (c.name = 'INTERLOCK T-SHIRT'));
    const long = convert(plain);
    expect(long.ok && [long.garment.type, long.garment.sleeve]).toEqual(['long-sleeve-tee', 'long']);

    const sleeves = (cm: Record<string, string>) =>
      withMeasures((m, size) => {
        if (m.tableTitle === 'SLEEVE LENGTH') m.dimensions[0]!.value = cm[size]!;
      });
    const short = convert(plain, sleeves({ S: '20.0', M: '21.0', L: '22.0', XL: '23.0' }));
    expect(short.ok && [short.garment.type, short.garment.sleeve, short.product.otherSleeve]).toEqual(['tee', 'short', undefined]);
    const mid = convert(plain, sleeves({ S: '38.0', M: '39.0', L: '40.0', XL: '41.0' }));
    expect(mid.ok && [mid.garment.type, mid.garment.sleeve, mid.product.otherSleeve, mid.product.cutText]).toEqual([
      'tee',
      'short',
      'Mid-length',
      'Mid-length sleeve',
    ]);
  });

  it('reads a neckline from the name', () => {
    const v = convert(withContent((c) => void (c.name = 'V-NECK RIBBED T-SHIRT')));
    expect(v.ok && [v.garment.neckline, v.product.cutText]).toEqual(['v', 'V-neck · Long sleeve']);
  });

  it('cuts men’s and other sections as their sizing', () => {
    const man = convert(withContent((c) => void (c.sectionName = 'MAN')));
    expect(man.ok && man.garment.sizing).toBe('mens');
    const kid = convert(withContent((c) => void (c.sectionName = 'KID')));
    expect(kid.ok && kid.garment.sizing).toBe('unisex');
  });

  it('gives bad-response for a malformed answer', () => {
    expect(convert('<html>Access Denied</html>')).toEqual({ ok: false, reason: 'bad-response' });
    expect(convert(noMatch)).toEqual({ ok: false, reason: 'bad-response' });
    expect(convert(searchFixture, 'not json')).toEqual({ ok: false, reason: 'bad-response' });
  });
});
