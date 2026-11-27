import { describe, expect, it } from 'vitest';
import { estimateBody } from '../body';
import { preferenceSpec } from '../fit/preference';
import { recommendSize } from '../fit/sampleFit';
import { validateSeed } from '../garments';
import sizeChartFixture from './__fixtures__/uniqlo-size-charts-E424873-000.json';
import detailsFixture from './__fixtures__/uniqlo-details-E424873-000.json';
import missingDetails from './__fixtures__/uniqlo-details-missing.json';
// The older products?productIds= response: what entries fetched before the details endpoint came from.
import productFixture from './__fixtures__/uniqlo-product-E424873-000.json';
import { colorHex } from './colors';
import { parseProductLink, type UniqloLink } from './parse';
import { isMissingProduct, readyFetchedGarment, UNIQLO_NOTES, uniqloColor, uniqloToSeedGarment, uniqloUrls } from './uniqlo';

const link = parseProductLink('https://www.uniqlo.com/us/en/products/E424873-000/00?colorDisplayCode=00') as UniqloLink;
const black = parseProductLink('https://www.uniqlo.com/us/en/products/E424873-000/09') as UniqloLink;
const noColour = parseProductLink('https://www.uniqlo.com/us/en/products/E424873-000') as UniqloLink;
const ON = '2026-11-26';
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const convert = (chart: unknown = sizeChartFixture, details: unknown = detailsFixture, at: UniqloLink = link) => uniqloToSeedGarment(chart, details, at, ON);
type Details = { result: { name: string; genderCategory?: string; tags: { group: string; tag: string; tagName: string; display: boolean; groupName: string }[] } };
/** The details fixture with one tag group set (or removed with `null`), and optionally another name. */
function withTag(group: string, tag: string | null, tagName = '', name?: string) {
  const d = clone(detailsFixture) as unknown as Details;
  d.result.tags = d.result.tags.filter((t) => t.group !== group);
  if (tag !== null) d.result.tags.push({ display: true, group, groupName: group, tag, tagName });
  if (name) d.result.name = name;
  return d;
}

/** The fixture with its size chart entries changed. */
function withSizes(edit: (sizes: { name: string; sizeParts: { code: string; measurements: { value: string; unit: string }[] }[] }[]) => void) {
  const chart = clone(sizeChartFixture);
  edit(chart.result[0]!.sizeChart);
  return chart;
}

describe('uniqloUrls', () => {
  it('gives the size-chart and details requests for a code', () => {
    expect(uniqloUrls('E424873-000')).toEqual({
      sizeChart:
        'https://www.uniqlo.com/us/api/commerce/v5/en/products/size-charts?productIdsWithColorCode=E424873-000&includeBodyMeasurements=true&simpleSizeChart=true&httpFailure=true',
      details: 'https://www.uniqlo.com/us/api/commerce/v5/en/products/E424873-000/price-groups/00/details?includeModelSize=false&httpFailure=true',
    });
  });
});

describe('uniqloToSeedGarment', () => {
  it('turns the crew neck tee fixture into a seed row, copied as printed', () => {
    const r = convert();
    if (!r.ok) throw new Error(r.reason);
    expect(r.garment).toEqual({
      id: 'uniqlo-E424873-000',
      brand: 'Uniqlo',
      name: 'Crew Neck T-Shirt',
      category: 'top',
      type: 'tee',
      sizing: 'womens',
      // The link's colour (00, WHITE), drawn by us; the tags' cut.
      color: colorHex('WHITE'),
      sleeve: 'short',
      neckline: 'crew',
      stretch: 'none',
      stretchAssumed: true,
      fitIntent: 'regular',
      source: { placeholder: false, tier: 'B', url: 'https://www.uniqlo.com/us/en/products/E424873-000/00', capturedOn: ON, notes: UNIQLO_NOTES },
      chart: { unit: 'cm', girth: 'flat', definitions: { length: 'center_back', sleeve: 'center_back_to_cuff' } },
      sizes: [
        { label: 'S', measurements: { length: 61.5, shoulder: 36, chest: 43, sleeve: 34.5 } },
        { label: 'M', measurements: { length: 63.5, shoulder: 37.5, chest: 46, sleeve: 35.5 } },
        { label: 'L', measurements: { length: 66, shoulder: 39, chest: 49, sleeve: 37 } },
      ],
    });
  });

  it('keeps the price, the chosen colour and its photo, every colour, the cut in words and the link alongside', () => {
    const r = convert();
    if (!r.ok) throw new Error(r.reason);
    expect(r.product).toMatchObject({
      garment: r.garment,
      priceText: '$14.90',
      imageUrl: 'https://image.uniqlo.com/UQ/ST3/us/imagesgoods/424873/item/usgoods_00_424873_3x4.jpg',
      productUrl: 'https://www.uniqlo.com/us/en/products/E424873-000/00',
      colorCode: '00',
      colorName: 'WHITE',
      cutText: 'Crew Neck · Short sleeve · Regular fit',
    });
    expect(r.product.otherSleeve).toBeUndefined();
    expect(r.product.colors!.map((c) => `${c.code} ${c.name}`)).toEqual(['00 WHITE', '09 BLACK', '15 RED', '37 BROWN', '53 GREEN', '69 NAVY', '74 PURPLE']);
    expect(r.product.colors![1]).toEqual({
      code: '09',
      name: 'BLACK',
      hex: colorHex('BLACK'),
      imageUrl: 'https://image.uniqlo.com/UQ/ST3/us/imagesgoods/424873/item/usgoods_09_424873_3x4.jpg',
    });
  });

  it('draws the colour the link names (/09 black), or the first colour when the link names none', () => {
    const r = convert(sizeChartFixture, detailsFixture, black);
    if (!r.ok) throw new Error(r.reason);
    expect(r.garment.color).toBe(colorHex('BLACK'));
    expect(r.product).toMatchObject({ colorCode: '09', colorName: 'BLACK', imageUrl: expect.stringContaining('usgoods_09_424873') });
    const plain = convert(sizeChartFixture, detailsFixture, noColour);
    if (!plain.ok) throw new Error(plain.reason);
    expect(plain.product).toMatchObject({ colorCode: '00', colorName: 'WHITE' });
  });

  it('still reads the older product JSON (no colours or tags): neutral colour, cut from the name', () => {
    const r = convert(sizeChartFixture, productFixture);
    if (!r.ok) throw new Error(r.reason);
    expect(r.garment).toMatchObject({ name: 'Crew Neck T-Shirt', color: '#a39e96', sleeve: 'short', fitIntent: 'regular', neckline: 'crew' });
    expect(r.product).toMatchObject({ priceText: '$14.90', imageUrl: expect.stringContaining('usgoods_15_424873') });
    expect(r.product.colors).toBeUndefined();
    expect(readyFetchedGarment(r.garment)?.grade).toBe('charted');
  });

  it('passes the seed checks and grades "charted": full girths, centre-back length', () => {
    const r = convert();
    if (!r.ok) throw new Error(r.reason);
    expect(validateSeed([r.garment])).toEqual([]);
    const g = readyFetchedGarment(r.garment)!;
    expect(g.grade).toBe('charted');
    expect(g.sizes.map((s) => s.label)).toEqual(['S', 'M', 'L']);
    expect(g.sizes.map((s) => s.measurements.chest)).toEqual([86, 92, 98]);
    expect(g.sizes[0]!.provenance.chest).toMatchObject({ origin: 'chart', printed: 43, unit: 'cm', conversions: ['flat width doubled to a full circumference'] });
    expect(g.lengthDefinition).toBe('center_back');
  });

  it('gets a recommended size for a body it fits', () => {
    const r = convert();
    if (!r.ok) throw new Error(r.reason);
    const body = estimateBody({ heightCm: 163, weightKg: 56, bodyType: 'womens' });
    expect(recommendSize(body, readyFetchedGarment(r.garment)!, preferenceSpec(null, null))).not.toBeNull();
  });

  it('reads the product as text too', () => {
    expect(convert(JSON.stringify(sizeChartFixture), JSON.stringify(detailsFixture)).ok).toBe(true);
  });

  it('maps WOMEN, MEN and anything else to the sizing', () => {
    const sizingFor = (genderCategory: string | undefined) => {
      const details = clone(detailsFixture) as unknown as Details;
      if (genderCategory === undefined) delete details.result.genderCategory;
      else details.result.genderCategory = genderCategory;
      const r = convert(sizeChartFixture, details);
      return r.ok ? r.garment.sizing : r.reason;
    };
    expect(sizingFor('WOMEN')).toBe('womens');
    expect(sizingFor('MEN')).toBe('mens');
    expect(sizingFor('UNISEX')).toBe('unisex');
    expect(sizingFor('KIDS')).toBe('unisex');
    expect(sizingFor(undefined)).toBe('unisex');
  });

  it('makes a long-sleeve tee from a long sleeve tag, or from a name that says so when there is no tag', () => {
    const tagged = convert(sizeChartFixture, withTag('sleeve', 'long', 'Long'));
    if (!tagged.ok) throw new Error(tagged.reason);
    expect(tagged.garment).toMatchObject({ type: 'long-sleeve-tee', sleeve: 'long' });
    const r = convert(sizeChartFixture, withTag('sleeve', null, '', 'Supima Cotton Crew Neck Long-Sleeve T-Shirt'));
    if (!r.ok) throw new Error(r.reason);
    expect(r.garment).toMatchObject({ type: 'long-sleeve-tee', sleeve: 'long' });
    expect(readyFetchedGarment(r.garment)?.grade).toBe('charted');
  });

  it('ignores part codes it does not know', () => {
    const chart = withSizes((sizes) => {
      for (const s of sizes) s.sizeParts.push({ code: 'hem-width', measurements: [{ value: '50', unit: 'cm' }] });
    });
    const r = convert(chart);
    if (!r.ok) throw new Error(r.reason);
    expect(Object.keys(r.garment.sizes[0]!.measurements).sort()).toEqual(['chest', 'length', 'shoulder', 'sleeve']);
  });

  it('leaves out a size whose chest is missing or not a plain number', () => {
    const chart = withSizes((sizes) => {
      sizes[1]!.sizeParts = sizes[1]!.sizeParts.filter((p) => p.code !== 'body-width');
      sizes[2]!.sizeParts.find((p) => p.code === 'body-width')!.measurements[0]!.value = '48 - 50';
    });
    const r = convert(chart);
    if (!r.ok) throw new Error(r.reason);
    expect(r.garment.sizes.map((s) => s.label)).toEqual(['S']);
  });

  it('says unsupported-parts when no size has a chest (not a top)', () => {
    const chart = withSizes((sizes) => {
      for (const s of sizes) s.sizeParts = [{ code: 'inseam', measurements: [{ value: '76', unit: 'cm' }] }];
    });
    expect(convert(chart)).toEqual({ ok: false, reason: 'unsupported-parts' });
  });

  it('says no-sizes for an empty size chart', () => {
    expect(convert(withSizes((sizes) => sizes.splice(0)))).toEqual({ ok: false, reason: 'no-sizes' });
  });

  it('says bad-response for malformed JSON, a status other than ok, or a missing result', () => {
    expect(convert('{"status":"ok","result":[')).toEqual({ ok: false, reason: 'bad-response' });
    expect(convert(sizeChartFixture, 'not json')).toEqual({ ok: false, reason: 'bad-response' });
    expect(convert({ ...sizeChartFixture, status: 'nok' })).toEqual({ ok: false, reason: 'bad-response' });
    expect(convert(sizeChartFixture, { ...detailsFixture, status: 'error' })).toEqual({ ok: false, reason: 'bad-response' });
    expect(convert({ status: 'ok', result: [] })).toEqual({ ok: false, reason: 'bad-response' });
    expect(convert(null, undefined)).toEqual({ ok: false, reason: 'bad-response' });
  });
});

describe('isMissingProduct', () => {
  it("is true for the details' no-such-product error (sent with a 404)", () => {
    expect(isMissingProduct(sizeChartFixture, missingDetails)).toBe(true);
    expect(isMissingProduct(sizeChartFixture, { status: 'nok', error: { code: 99 } })).toBe(false);
    expect(isMissingProduct(sizeChartFixture, detailsFixture)).toBe(false);
  });

  it('is true only for well-formed ok responses with no result', () => {
    expect(isMissingProduct({ status: 'ok', result: [] }, productFixture)).toBe(true);
    expect(isMissingProduct(sizeChartFixture, { status: 'ok', result: { items: [] } })).toBe(true);
    expect(isMissingProduct(sizeChartFixture, productFixture)).toBe(false);
    expect(isMissingProduct({ status: 'nok', result: [] }, productFixture)).toBe(false);
    expect(isMissingProduct('{', productFixture)).toBe(false);
  });
});

describe('readyFetchedGarment', () => {
  it('drops a stored row that fails the seed checks or is damaged', () => {
    const r = convert();
    if (!r.ok) throw new Error(r.reason);
    expect(readyFetchedGarment({ ...r.garment, sizes: [] })).toBeNull();
    expect(readyFetchedGarment({ ...r.garment, color: 'grey' })).toBeNull();
    expect(readyFetchedGarment({ id: 'x' } as never)).toBeNull();
  });
});

describe('uniqloColor', () => {
  it("picks the link's colour by display code, else the first colour; null without colours", () => {
    expect(uniqloColor(detailsFixture, '69')).toMatchObject({ code: '69', name: 'NAVY', hex: colorHex('NAVY') });
    expect(uniqloColor(detailsFixture, '99')).toMatchObject({ code: '00', name: 'WHITE' });
    expect(uniqloColor(detailsFixture, undefined)).toMatchObject({ code: '00' });
    expect(uniqloColor(productFixture, '00')).toBeNull();
    expect(uniqloColor('{', '00')).toBeNull();
  });
});

describe('the cut from the tags', () => {
  it('reads the fit tag into words, but every link garment sizes as regular for now', () => {
    const fitOf = (tag: string | null, tagName = '') => {
      const r = convert(sizeChartFixture, withTag('top-fit', tag, tagName));
      if (!r.ok) throw new Error(r.reason);
      return [r.garment.fitIntent, r.product.cutText];
    };
    expect(fitOf('oversized', 'Oversized')).toEqual(['regular', 'Crew Neck · Short sleeve · Oversized fit']);
    expect(fitOf('very-fitted', 'Very Fitted')).toEqual(['regular', 'Crew Neck · Short sleeve · Very Fitted']);
    expect(fitOf(null)).toEqual(['regular', 'Crew Neck · Short sleeve']);
  });

  it('keeps a sleeveless or half-sleeve top, drawn short, and says so', () => {
    const r = convert(sizeChartFixture, withTag('sleeve', 'sleeveless', 'Sleeveless'));
    if (!r.ok) throw new Error(r.reason);
    expect(r.garment).toMatchObject({ sleeve: 'short', type: 'tee' });
    expect(r.product).toMatchObject({ otherSleeve: 'Sleeveless', cutText: 'Crew Neck · Sleeveless · Regular fit' });
    expect(readyFetchedGarment(r.garment)?.grade).toBe('charted');
  });

  it("the fit tag doesn't move the recommended size (an oversized tag would push it up today)", () => {
    for (const body of [
      estimateBody({ heightCm: 163, weightKg: 56, bodyType: 'womens' }),
      estimateBody({ heightCm: 176, weightKg: 75, bodyType: 'mens' }),
    ]) {
      const pick = (tag: string) => {
        const r = convert(sizeChartFixture, withTag('top-fit', tag, tag));
        if (!r.ok) throw new Error(r.reason);
        return recommendSize(body, readyFetchedGarment(r.garment)!, preferenceSpec(null, null));
      };
      expect(pick('oversized')).toBe(pick('regular'));
      expect(pick('regular')).not.toBeNull();
    }
  });
});
