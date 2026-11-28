import { describe, expect, it } from 'vitest';
import details from './__fixtures__/uniqlo-details-E424873-000.json';
import { cutFromName, uniqloCut } from './cut';

const tag = (group: string, t: string, tagName: string) => ({ display: true, group, groupName: group, tag: t, tagName });

describe('uniqloCut', () => {
  it('reads the Crew Neck T-Shirt fixture', () => {
    expect(uniqloCut(details.result.tags, details.result.name)).toEqual({
      sleeve: 'short',
      fit: 'regular',
      neckline: 'crew',
      text: 'Crew Neck · Short sleeve · Regular fit',
    });
  });

  it('maps the fit tags seen on Uniqlo US', () => {
    const fit = (t: string, name: string) => uniqloCut([tag('top-fit', t, name)], 'T-Shirt').fit;
    expect(fit('very-fitted', 'Very Fitted')).toBe('slim');
    expect(fit('fitted', 'Fitted')).toBe('slim');
    expect(fit('regular', 'Regular')).toBe('regular');
    expect(fit('relaxed', 'Relaxed')).toBe('relaxed');
    expect(fit('oversized', 'Oversized')).toBe('oversized');
    expect(fit('boxy', 'Boxy')).toBe('regular');
    expect(uniqloCut([], 'T-Shirt').fit).toBe('regular');
  });

  it('draws short and long sleeves; any other sleeve is drawn short and named', () => {
    expect(uniqloCut([tag('sleeve', 'long', 'Long')], 'T-Shirt')).toMatchObject({ sleeve: 'long', text: 'Long sleeve' });
    expect(uniqloCut([tag('sleeve', 'short', 'Short')], 'T-Shirt').otherSleeve).toBeUndefined();
    for (const [t, name] of [['sleeveless', 'Sleeveless'], ['half', 'Half'], ['8-10', '8/10']]) {
      expect(uniqloCut([tag('sleeve', t!, name!)], 'T-Shirt'), name).toMatchObject({ sleeve: 'short', otherSleeve: name });
    }
    expect(uniqloCut([tag('sleeve', 'sleeveless', 'Sleeveless')], 'Top').text).toBe('Sleeveless');
    expect(uniqloCut([tag('sleeve', 'half', 'Half')], 'Top').text).toBe('Half sleeve');
  });

  it('without a sleeve tag, a name that says long sleeve is long', () => {
    expect(uniqloCut([], 'AIRism Cotton T-Shirt | Long Sleeve').sleeve).toBe('long');
    expect(uniqloCut([], 'Waffle T-Shirt Long-Sleeve').sleeve).toBe('long');
    expect(uniqloCut([], 'Waffle T-Shirt').sleeve).toBe('short');
    // A tag wins over the name.
    expect(uniqloCut([tag('sleeve', 'short', 'Short')], 'Long Sleeve T-Shirt').sleeve).toBe('short');
  });

  it('maps the neck tags, and reads the name when there is no neck tag', () => {
    const neck = (t: string) => uniqloCut([tag('neck-type', t, t)], 'T-Shirt').neckline;
    expect(neck('crew-neck')).toBe('crew');
    expect(neck('henley-neck')).toBe('henley');
    expect(neck('boat-neck')).toBe('boat');
    expect(neck('high-neck')).toBe('mock');
    expect(neck('v-neck')).toBe('v');
    const named = (name: string) => uniqloCut([], name).neckline;
    expect(named('Ribbed Knitted Fleece V-Neck T')).toBe('v');
    expect(named('HEATTECH T-Shirt | Scoop Neck')).toBe('scoop');
    expect(named('Soft Brushed Turtleneck T-Shirt')).toBe('mock');
    expect(named('3D Knit Mock Neck Sweater')).toBe('mock');
    expect(named('DRY Waffle Henley T-Shirt')).toBe('henley');
    expect(named('Shirring Boat Neck Sleeveless T-Shirt')).toBe('boat');
    expect(named('Waffle T-Shirt')).toBeUndefined();
    // An unknown tag falls back to the name, then to unset (drawn crew).
    expect(uniqloCut([tag('neck-type', 'square-neck', 'Square Neck')], 'Cropped Top').neckline).toBeUndefined();
  });

  it('ignores malformed tags', () => {
    expect(uniqloCut('tags', 'T-Shirt')).toEqual({ sleeve: 'short', fit: 'regular', text: null });
    expect(uniqloCut([{ group: 'sleeve' }, null, 3], 'T-Shirt')).toEqual({ sleeve: 'short', fit: 'regular', text: null });
  });
});

describe('cutFromName', () => {
  it('reads the sleeve and neckline a name gives, for any brand', () => {
    expect(cutFromName('Interlock Long-Sleeve T-Shirt')).toEqual({ sleeve: 'long' });
    expect(cutFromName('SHORT SLEEVE V-NECK TOP')).toEqual({ sleeve: 'short', neckline: 'v' });
    expect(cutFromName('Ribbed Mock Neck Top')).toEqual({ neckline: 'mock' });
    expect(cutFromName('Basic T-Shirt')).toEqual({});
  });
});
