import { describe, expect, it } from 'vitest';
import { estimateBody } from '../body';
import { preferenceSpec } from '../fit/preference';
import { recommendSize } from '../fit/sampleFit';
import { validateSeed } from '../garments';
import sizeChartFixture from './__fixtures__/uniqlo-size-charts-E424873-000.json';
import productFixture from './__fixtures__/uniqlo-product-E424873-000.json';
import { parseProductLink, type UniqloLink } from './parse';
import { isMissingProduct, readyFetchedGarment, UNIQLO_NOTES, uniqloToSeedGarment, uniqloUrls } from './uniqlo';

const link = parseProductLink('https://www.uniqlo.com/us/en/products/E424873-000/00?colorDisplayCode=00') as UniqloLink;
const ON = '2026-11-26';
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const convert = (chart: unknown = sizeChartFixture, product: unknown = productFixture) => uniqloToSeedGarment(chart, product, link, ON);

/** The fixture with its size chart entries changed. */
function withSizes(edit: (sizes: { name: string; sizeParts: { code: string; measurements: { value: string; unit: string }[] }[] }[]) => void) {
  const chart = clone(sizeChartFixture);
  edit(chart.result[0]!.sizeChart);
  return chart;
}

describe('uniqloUrls', () => {
  it('gives the size-chart and product requests for a code', () => {
    expect(uniqloUrls('E424873-000')).toEqual({
      sizeChart:
        'https://www.uniqlo.com/us/api/commerce/v5/en/products/size-charts?productIdsWithColorCode=E424873-000&includeBodyMeasurements=true&simpleSizeChart=true&httpFailure=true',
      product: 'https://www.uniqlo.com/us/api/commerce/v5/en/products?productIds=E424873-000&httpFailure=true',
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
      color: expect.stringMatching(/^#[0-9a-f]{6}$/),
      sleeve: 'short',
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

  it('keeps the price, the photo for the thumbnail and the cleaned link alongside', () => {
    const r = convert();
    if (!r.ok) throw new Error(r.reason);
    expect(r.product).toEqual({
      garment: r.garment,
      priceText: '$14.90',
      imageUrl: 'https://image.uniqlo.com/UQ/ST3/us/imagesgoods/424873/item/usgoods_15_424873_3x4.jpg',
      productUrl: 'https://www.uniqlo.com/us/en/products/E424873-000/00',
    });
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
    expect(convert(JSON.stringify(sizeChartFixture), JSON.stringify(productFixture)).ok).toBe(true);
  });

  it('maps WOMEN, MEN and anything else to the sizing', () => {
    const sizingFor = (genderCategory: string | undefined) => {
      const product = clone(productFixture) as { result: { items: { genderCategory?: string }[] } };
      if (genderCategory === undefined) delete product.result.items[0]!.genderCategory;
      else product.result.items[0]!.genderCategory = genderCategory;
      const r = convert(sizeChartFixture, product);
      return r.ok ? r.garment.sizing : r.reason;
    };
    expect(sizingFor('WOMEN')).toBe('womens');
    expect(sizingFor('MEN')).toBe('mens');
    expect(sizingFor('UNISEX')).toBe('unisex');
    expect(sizingFor('KIDS')).toBe('unisex');
    expect(sizingFor(undefined)).toBe('unisex');
  });

  it('makes a long-sleeve tee from a name that says so', () => {
    const product = clone(productFixture);
    product.result.items[0]!.name = 'Supima Cotton Crew Neck Long-Sleeve T-Shirt';
    const r = convert(sizeChartFixture, product);
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
    expect(convert(sizeChartFixture, { ...productFixture, status: 'error' })).toEqual({ ok: false, reason: 'bad-response' });
    expect(convert({ status: 'ok', result: [] })).toEqual({ ok: false, reason: 'bad-response' });
    expect(convert(null, undefined)).toEqual({ ok: false, reason: 'bad-response' });
  });
});

describe('isMissingProduct', () => {
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
