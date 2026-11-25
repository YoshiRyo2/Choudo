import { describe, expect, it } from 'vitest';
import { estimateBody } from '../domain/body';
import { fitAllSizes, TEMPLATE_ZONES, type GarmentFit, type ZoneFit, type ZoneId } from '../domain/fit';
import { findGarment, type TemplateId } from '../domain/garments';
import { DECIDING_ZONE, whyLine } from './fitText';

const zone = (zoneId: ZoneId, diffCm: number | null): ZoneFit => ({
  zone: zoneId,
  kind: 'girth',
  label: diffCm === null ? 'unknown' : 'fitted',
  tone: diffCm === null ? 'unknown' : 'good',
  diffCm,
  garmentCm: diffCm === null ? null : 100 + diffCm,
  bodyCm: 100,
  bodySource: 'estimated',
  bands: [],
});
/** One fit per size, in chart order, each with the given room at `zoneId` (and a length zone that never decides). */
const sizes = (zoneId: ZoneId, room: Record<string, number | null>, bodyType: 'mens' | 'womens' = 'mens'): GarmentFit[] =>
  Object.entries(room).map(([sizeLabel, diff]) => ({
    garmentId: 'g',
    sizeLabel,
    bodyType,
    zones: [zone(zoneId, diff), { ...zone('length', 30), kind: 'length' }],
    overall: 'good',
  }));

describe('whyLine', () => {
  it('compares the chest with the next size up', () => {
    const fits = sizes('chest', { S: 2, M: 8, L: 14 });
    expect(whyLine(fits, 'M', 'tee', 'metric')).toBe('M gives you 8 cm of room at the chest; L gives 14 cm.');
    expect(whyLine(fits, 'S', 'tee', 'metric')).toBe('S gives you 2 cm of room at the chest; M gives 8 cm.');
  });

  it('compares the largest size with the next size down', () => {
    expect(whyLine(sizes('chest', { S: 2, M: 8, L: 14 }), 'L', 'tee', 'metric')).toBe('L gives you 14 cm of room at the chest; M gives 8 cm.');
  });

  it('says a size is smaller than the body when the ease is negative', () => {
    expect(whyLine(sizes('waist', { '30': -3.2, '32': 2.1 }), '30', 'pants', 'metric')).toBe(
      '30 is 3 cm smaller than your waist; 32 gives 2 cm of room.',
    );
    expect(whyLine(sizes('waist', { '30': -6, '32': -1 }), '30', 'pants', 'metric')).toBe('30 is 6 cm smaller than your waist; 32 is 1 cm smaller.');
    expect(whyLine(sizes('waist', { '30': -6, '32': 1 }), '32', 'pants', 'metric')).toBe(
      '32 gives you 1 cm of room at the waist; 30 is 6 cm smaller than your waist.',
    );
  });

  it('says leggings stretch rather than calling them smaller', () => {
    expect(whyLine(sizes('waist', { S: -7.8, M: -4.1, L: 0.2 }), 'S', 'leggings', 'metric')).toBe('S stretches 8 cm at the waist; M stretches 4 cm.');
    expect(whyLine(sizes('waist', { S: -7.8, M: -4.1, L: 1.6 }), 'M', 'leggings', 'metric')).toBe('M stretches 4 cm at the waist; L gives 2 cm of room.');
  });

  it('says "matches" when the room rounds to nothing', () => {
    expect(whyLine(sizes('chest', { M: 0.3, L: 6 }), 'M', 'tee', 'metric')).toBe('M matches your chest; L gives 6 cm of room.');
  });

  it('gives inches to the half for imperial', () => {
    // 8 cm = 3.15 in → 3 in; 14 cm = 5.51 in → 5.5 in.
    expect(whyLine(sizes('chest', { M: 8, L: 14 }), 'M', 'tee', 'imperial')).toBe('M gives you 3 in of room at the chest; L gives 5.5 in.');
  });

  it('calls the chest the bust for a women’s body', () => {
    expect(whyLine(sizes('chest', { '8': 4, '10': 9 }, 'womens'), '8', 'dress', 'metric', 'womens')).toBe(
      '8 gives you 4 cm of room at the bust; 10 gives 9 cm.',
    );
  });

  it('is null when the deciding girth can’t be checked, and leaves out a neighbour that can’t be', () => {
    expect(whyLine(sizes('chest', { M: null, L: 14 }), 'M', 'tee', 'metric')).toBeNull();
    expect(whyLine(sizes('chest', { M: 8, L: null }), 'M', 'tee', 'metric')).toBe('M gives you 8 cm of room at the chest.');
    expect(whyLine(sizes('chest', { M: 8 }), 'M', 'tee', 'metric')).toBe('M gives you 8 cm of room at the chest.');
    expect(whyLine(sizes('chest', { M: 8 }), 'XL', 'tee', 'metric')).toBeNull();
    // A bottom is decided at the waist, not the chest.
    expect(whyLine(sizes('chest', { M: 8, L: 14 }), 'M', 'skirt', 'metric')).toBeNull();
  });

  it('reads a real tee: one line, in whole cm, naming this size and the next', () => {
    const tee = findGarment('gildan-5000')!;
    const fits = fitAllSizes(estimateBody({ heightCm: 176, weightKg: 80, bodyType: 'mens' }), tee);
    const line = whyLine(fits, fits[1]!.sizeLabel, 'tee', 'metric')!;
    expect(line).toMatch(new RegExp(`^${fits[1]!.sizeLabel} .* at the chest; ${fits[2]!.sizeLabel} .*\\d cm( of room)?\\.$`));
    expect(line).not.toMatch(/\d\.\d/);
  });
});

describe('DECIDING_ZONE', () => {
  it('is a girth every size of the template needs: its first zone', () => {
    for (const [template, zoneId] of Object.entries(DECIDING_ZONE) as [TemplateId, ZoneId][]) {
      const first = TEMPLATE_ZONES[template].zones[0]!;
      expect(first.zone, template).toBe(zoneId);
      expect(first.optional, template).toBeUndefined();
    }
  });
});
