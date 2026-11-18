import { describe, expect, it } from 'vitest';
import { estimateBody } from '../domain/body';
import { fitGarment, type ZoneFit } from '../domain/fit';
import { findGarment } from '../domain/garments';
import { describeZone, formatDiff, summarize } from './fitText';

const zone = (patch: Partial<ZoneFit>): ZoneFit => ({
  zone: 'chest',
  kind: 'girth',
  label: 'fitted',
  tone: 'good',
  diffCm: 2,
  garmentCm: 106,
  bodyCm: 104,
  bodySource: 'estimated',
  bands: [],
  ...patch,
});

describe('formatDiff', () => {
  it('signs, rounds and converts', () => {
    expect(formatDiff(2.04, 'metric')).toBe('+2.0 cm');
    expect(formatDiff(-2.54, 'imperial')).toBe('−1.0 in');
    expect(formatDiff(0.02, 'metric')).toBe('0 cm');
  });
});

describe('describeZone', () => {
  it('talks about room, stretch and tightness for girths', () => {
    expect(describeZone(zone({ diffCm: 4 }), 'metric')).toBe('4.0 cm of room at your chest.');
    expect(describeZone(zone({ diffCm: 0.2 }), 'metric')).toBe('Matches your chest exactly.');
    expect(describeZone(zone({ diffCm: -3, label: 'tight' }), 'metric')).toBe('3.0 cm smaller than your chest.');
    expect(describeZone(zone({ diffCm: -3, label: 'fitted' }), 'metric')).toMatch(/fabric stretches/);
  });

  it('talks about where lengths end', () => {
    expect(describeZone(zone({ zone: 'inseam', kind: 'length', diffCm: -4 }), 'metric')).toBe(
      '4.0 cm shorter than your inseam.',
    );
    expect(describeZone(zone({ zone: 'sleeve', kind: 'length', diffCm: 2.54 }), 'imperial')).toBe(
      'Cuff ends 1.0 in past your wrist.',
    );
  });

  it('passes through the engine’s reason when unknown', () => {
    expect(describeZone(zone({ diffCm: null, label: 'unknown', note: 'No data.' }), 'metric')).toBe('No data.');
  });
});

describe('summarize', () => {
  const body = estimateBody({ heightCm: 176, weightKg: 85, sizing: 'mens' });

  it('names the problem zones', () => {
    const tall = estimateBody({ heightCm: 190, weightKg: 110, sizing: 'mens' });
    const s = summarize(fitGarment(tall, findGarment('fieldline-straight-chino')!, '30'));
    expect(s.headline).toBe('Probably won’t fit');
    expect(s.detail).toMatch(/^Tight at the waist/);
  });

  it('says when estimates were used', () => {
    expect(summarize(fitGarment(body, findGarment('knightweave-tee')!, 'L')).usesEstimates).toBe(true);
  });

  it('says which zones it could not check instead of claiming a good fit', () => {
    const s = summarize(fitGarment(body, findGarment('landsend-super-t')!, 'M'));
    expect(s.headline).toBe('Can’t check this fit');
    expect(s.detail).toBe('This size chart doesn’t let us compare the chest.');
  });
});
