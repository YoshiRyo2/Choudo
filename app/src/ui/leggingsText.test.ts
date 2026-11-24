import { describe, expect, it } from 'vitest';
import type { GarmentFit, ZoneFit } from '@choudo/core/domain/fit';
import { bodyPlaceText, describeZone, sourceLine, summarize, zoneLabelText, zoneTitle } from './fitText';

const girth = (over: Partial<ZoneFit>): ZoneFit => ({
  zone: 'hips',
  kind: 'girth',
  label: 'fitted',
  tone: 'good',
  diffCm: -8,
  garmentCm: 92,
  bodyCm: 100,
  bodySource: 'estimated',
  bands: [],
  ...over,
});

const length = (landing: string, diffCm: number, tone: ZoneFit['tone'] = 'good'): ZoneFit => ({
  zone: 'inseam',
  kind: 'landing',
  label: 'noted',
  tone,
  diffCm,
  garmentCm: 72 + diffCm,
  bodyCm: 72,
  bodySource: 'estimated',
  bodyAt: 'ankle',
  landing,
  bands: [],
});

describe('leggings zone names', () => {
  it('call the inseam that lands at the ankle "Length"', () => {
    expect(zoneTitle(length('7/8', -8), 'womens')).toBe('Length');
    expect(zoneTitle(girth({ zone: 'calf' }), 'womens')).toBe('Calf');
    expect(zoneTitle(girth({ zone: 'inseam', kind: 'length' }), 'womens')).toBe('Inseam');
  });
});

describe('leggings labels', () => {
  it('read too much squeeze and baggy, where other bottoms read tight and loose', () => {
    expect(zoneLabelText(girth({ label: 'tight', tone: 'bad' }), 'leggings')).toBe('Too much squeeze');
    expect(zoneLabelText(girth({ label: 'loose', tone: 'warn' }), 'leggings')).toBe('Baggy');
    expect(zoneLabelText(girth({ label: 'fitted' }), 'leggings')).toBe('Fitted');
    expect(zoneLabelText(girth({ label: 'tight', tone: 'bad' }), 'pants')).toBe('Tight');
    expect(zoneLabelText(girth({ label: 'tight', tone: 'bad' }))).toBe('Tight');
  });

  it('name where each length lands', () => {
    expect(zoneLabelText(length('7/8', -8))).toBe('7/8 length');
    expect(zoneLabelText(length('ankle', 0))).toBe('Ankle length');
    expect(zoneLabelText(length('capri', -21))).toBe('Capri');
    expect(zoneLabelText(length('stacked', 7, 'warn'))).toBe('Long');
  });

  it('say squeeze at the hips in the summary', () => {
    const fit: GarmentFit = {
      garmentId: 'x',
      sizeLabel: 'S',
      bodyType: 'womens',
      overall: 'bad',
      zones: [girth({ label: 'tight', tone: 'bad', diffCm: -20 })],
    };
    expect(summarize(fit, 'leggings').detail).toBe('Too much squeeze at the hips.');
  });
});

describe('leggings sentences', () => {
  it('give the share under the body as well as the cm', () => {
    expect(describeZone(girth({}), 'metric', 'womens', 'leggings')).toBe('8.0 cm (8 %) smaller than your hips: snug, as leggings are cut.');
    expect(describeZone(girth({ label: 'tight', tone: 'bad', diffCm: -20 }), 'metric', 'womens', 'leggings')).toBe(
      '20.0 cm (20 %) smaller than your hips: more squeeze than the fabric gives.',
    );
    expect(describeZone(girth({ label: 'loose', tone: 'warn', diffCm: 5 }), 'metric', 'womens', 'leggings')).toBe(
      '5.0 cm bigger than your hips, so they won’t hug you.',
    );
    expect(describeZone(girth({ label: 'relaxed', diffCm: 2 }), 'metric', 'womens', 'leggings')).toBe('2.0 cm of room at your hips.');
  });

  it('say where the hem ends against the ankle bone', () => {
    expect(describeZone(length('7/8', -8.46), 'metric')).toBe('7/8 length: ends 8.5 cm above your ankle bone.');
    expect(describeZone(length('capri', -21), 'metric')).toBe('Capri: ends 21.0 cm above your ankle bone.');
    expect(describeZone(length('ankle', 0.2), 'metric')).toBe('Ankle length: ends at your ankle bone.');
    expect(describeZone(length('ankle', 2), 'metric')).toBe('Ankle length: ends 2.0 cm below your ankle bone.');
    expect(describeZone(length('stacked', 6.7, 'warn'), 'metric')).toBe('Long: runs 6.7 cm past your ankle bone, so it bunches at the ankle.');
  });

  it('say what the body number is measured over', () => {
    expect(bodyPlaceText(length('7/8', -8))).toBe(' from your crotch to your ankle bone');
  });
});

describe('assumed stretch', () => {
  it('is said under the source', () => {
    expect(sourceLine({ source: { placeholder: false, tier: 'B' }, stretchAssumed: true })).toBe(
      'From a published garment size chart. Stretch assumed: the chart gives none.',
    );
    expect(sourceLine({ source: { placeholder: false, tier: 'B' } })).toBe('From a published garment size chart.');
  });
});
