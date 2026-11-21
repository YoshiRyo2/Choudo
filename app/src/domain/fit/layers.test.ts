import { describe, expect, it } from 'vitest';
import { estimateBody } from '../body';
import { findGarment, normalizeGarment, type Garment } from '../garments';
import { JACKET, JACKET_SEED, KNIT_HOODIE, KNIT_HOODIE_SEED } from '../garments/testFixtures';
import { fitAllSizes, fitGarment } from './fitEngine';
import { LAYER_BULK_CM, layerAllowanceCm, layerGrowCm, OUTER_ASSUMES, UNDER_EASE_KEPT } from './layers';
import { fitOutfit } from './outfit';
import { KNIT_GIRTH_RULES } from './rules';

const body = estimateBody({ heightCm: 176, weightKg: 85, bodyType: 'mens' });
const m = body.measurements;
const chestOf = (g: Garment, size: string) => g.sizes.find((s) => s.label === size)!.measurements.chest!;
const hoodie = (patch: Partial<typeof KNIT_HOODIE_SEED> = {}) => normalizeGarment({ ...KNIT_HOODIE_SEED, ...patch });

describe('layer allowance (ASSUMED bulk and kept ease)', () => {
  it('ships the design numbers', () => {
    expect(LAYER_BULK_CM).toEqual({ light: 0.5, mid: 2, heavy: 3.5 });
    expect(OUTER_ASSUMES).toBe('light');
    expect(UNDER_EASE_KEPT).toBe(0.25);
  });

  it('adds a mid hoodie’s bulk beyond a light layer, plus a quarter of its ease beyond fitted', () => {
    const spare = chestOf(KNIT_HOODIE, 'L') - m.chestCm - KNIT_GIRTH_RULES.unisex.fittedMax;
    expect(spare).toBeGreaterThan(0);
    const a = layerAllowanceCm(m, { garment: KNIT_HOODIE, sizeLabel: 'L' });
    expect(a.chestCm).toBeCloseTo(1.5 + 0.25 * spare, 9);
    expect(a.waistCm).toBeCloseTo(a.chestCm, 9);
  });

  it('keeps no ease from a layer that is within fitted', () => {
    expect(layerAllowanceCm(m, { garment: KNIT_HOODIE, sizeLabel: 'S' }).chestCm).toBeCloseTo(1.5, 9);
  });

  it('adds about nothing for a tee', () => {
    const tee = findGarment('gildan-5000')!;
    expect(layerAllowanceCm(m, { garment: tee, sizeLabel: 'L' }).chestCm).toBeLessThan(1);
    expect(layerAllowanceCm(m, { garment: tee, sizeLabel: 'S' }).chestCm).toBe(0);
  });

  it('adds only the bulk when the layer’s chest method is unknown', () => {
    const unknown = hoodie({ chart: { ...KNIT_HOODIE_SEED.chart, girth: 'unknown' } });
    expect(layerAllowanceCm(m, { garment: unknown, sizeLabel: 'L' }).chestCm).toBeCloseTo(1.5, 9);
  });

  it('adds 3 cm of bulk for a heavy layer', () => {
    expect(layerAllowanceCm(m, { garment: hoodie({ weight: 'heavy' }), sizeLabel: 'S' }).chestCm).toBeCloseTo(3, 9);
  });

  it('grows the drawing by the layer’s bulk round the body', () => {
    expect(layerGrowCm(KNIT_HOODIE)).toBeCloseTo(2 / (2 * Math.PI), 9);
  });
});

describe('fitting over a layer', () => {
  const under = { garment: KNIT_HOODIE, sizeLabel: 'L' };
  const allowance = layerAllowanceCm(m, under).chestCm;

  it('compares the jacket chest with the body plus the layer, and says so', () => {
    const fit = fitGarment(body, JACKET, 'M', under);
    const chest = fit.zones.find((z) => z.zone === 'chest')!;
    expect(chest.bodyCm).toBeCloseTo(m.chestCm + allowance, 9);
    expect(chest.bodyAt).toBe('over_layer');
    expect(chest.bodySource).toBe('estimated');
    expect(fit.over).toEqual({ garmentId: KNIT_HOODIE.id, type: 'hoodie' });
    // The sleeve and length use the bare body.
    const bare = fitGarment(body, JACKET, 'M');
    expect(fit.zones.find((z) => z.zone === 'sleeve')).toEqual(bare.zones.find((z) => z.zone === 'sleeve'));
  });

  it('fits exactly as before without a layer, and ignores a layer on a template that has no layered zones', () => {
    const bare = fitGarment(body, JACKET, 'M');
    expect(bare.over).toBeUndefined();
    expect('over' in bare).toBe(false);
    expect(fitGarment(body, KNIT_HOODIE, 'L', { garment: JACKET, sizeLabel: 'M' })).toEqual(fitGarment(body, KNIT_HOODIE, 'L'));
    expect(fitAllSizes(body, JACKET, under).map((f) => f.over?.type)).toEqual(['hoodie', 'hoodie', 'hoodie', 'hoodie', 'hoodie']);
  });
});

describe('fitOutfit and layer notes', () => {
  const jacketLike = (patch: Partial<typeof JACKET_SEED>) => normalizeGarment({ ...JACKET_SEED, ...patch });

  it('fits the top and bottom bare and the outer over the top', () => {
    const out = fitOutfit(body, { top: { garment: KNIT_HOODIE, sizeLabel: 'L' }, outer: { garment: JACKET, sizeLabel: 'XL' } });
    expect(out.top).toEqual(fitGarment(body, KNIT_HOODIE, 'L'));
    expect(out.outer).toEqual(fitGarment(body, JACKET, 'XL', { garment: KNIT_HOODIE, sizeLabel: 'L' }));
    expect(fitOutfit(body, { outer: { garment: JACKET, sizeLabel: 'M' } }).outer).toEqual(fitGarment(body, JACKET, 'M'));
  });

  it('notes a hoodie hem showing below a shorter jacket, and nothing when the jacket is longer', () => {
    // Hoodie L is 29 in (73.66 cm) from the high shoulder; jacket S is 60 cm.
    const notes = fitOutfit(body, { top: { garment: KNIT_HOODIE, sizeLabel: 'L' }, outer: { garment: JACKET, sizeLabel: 'S' } }).notes;
    const hem = notes.find((n) => n.kind === 'hem-shows')!;
    expect(hem.cm).toBeCloseTo(73.66 - 60, 6);
    const long = fitOutfit(body, { top: { garment: KNIT_HOODIE, sizeLabel: 'L' }, outer: { garment: JACKET, sizeLabel: 'L' } }).notes;
    expect(long.some((n) => n.kind === 'hem-shows')).toBe(false);
  });

  it('notes hoodie cuffs showing past shorter jacket sleeves, never for a short-sleeve tee', () => {
    // Both sleeves run from the centre back: hoodie L 35 in (88.9 cm), jacket S 85 cm.
    const notes = fitOutfit(body, { top: { garment: KNIT_HOODIE, sizeLabel: 'L' }, outer: { garment: JACKET, sizeLabel: 'S' } }).notes;
    expect(notes.find((n) => n.kind === 'cuffs-show')!.cm).toBeCloseTo(88.9 - 85, 6);
    const tee = findGarment('gildan-5000')!;
    const shortSleeve = fitOutfit(body, { top: { garment: tee, sizeLabel: 'XL' }, outer: { garment: JACKET, sizeLabel: 'S' } }).notes;
    expect(shortSleeve.some((n) => n.kind === 'cuffs-show')).toBe(false);
  });

  it('notes a hoodie roomier than the jacket leaves room for', () => {
    const tight = jacketLike({ sizes: [{ label: 'M', measurements: { chest: 58, length: 75, sleeve: 90 } }] });
    const under = { garment: KNIT_HOODIE, sizeLabel: 'L' };
    const bunch = fitOutfit(body, { top: under, outer: { garment: tight, sizeLabel: 'M' } }).notes.find((n) => n.kind === 'bunches')!;
    const hoodieEase = chestOf(KNIT_HOODIE, 'L') - m.chestCm;
    const jacketEase = 116 - (m.chestCm + layerAllowanceCm(m, under).chestCm);
    expect(bunch.cm).toBeCloseTo(hoodieEase - jacketEase, 6);
    const roomy = fitOutfit(body, { top: under, outer: { garment: JACKET, sizeLabel: 'XXL' } }).notes;
    expect(roomy.some((n) => n.kind === 'bunches')).toBe(false);
  });

  it('has no notes without a layer under the outer', () => {
    expect(fitOutfit(body, { top: { garment: KNIT_HOODIE, sizeLabel: 'L' } }).notes).toEqual([]);
  });
});
