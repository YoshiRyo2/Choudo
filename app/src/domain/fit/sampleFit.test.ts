import { describe, expect, it } from 'vitest';
import { estimateBody, type BodyModel } from '../body';
import { findGarment, normalizeGarment, type Garment, type SeedGarment } from '../garments';
import { inToCm } from '../units';
import { preferenceSpec } from './preference';
import { normal, seededRng } from './random';
import {
  auditGapsCm,
  bodySdCm,
  garmentSdCm,
  measurementHint,
  pickSize,
  recommendSize,
  sampleFit,
  type SizeOdds,
} from './sampleFit';
import { ENTERED_BODY_SD_CM, ESTIMATED_BODY_SD_CM, GARMENT_SD_CM, SAMPLE_COUNT } from './uncertainty';

const regular = preferenceSpec(null, null);
const gildan = findGarment('gildan-5000')!;

/** A body with chosen measurements, each marked entered or estimated. */
function bodyWith(m: Partial<BodyModel['measurements']>, source: 'entered' | 'estimated' = 'entered'): BodyModel {
  const model = estimateBody({ heightCm: 176, weightKg: 85, sizing: 'mens' });
  const sources = { ...model.sources };
  for (const k of Object.keys(m) as (keyof typeof sources)[]) if (k in sources) sources[k] = source;
  return { measurements: { ...model.measurements, ...m }, sources };
}

const seedTee: SeedGarment = {
  id: 'tee',
  brand: 'Test',
  name: 'Tee',
  category: 'top',
  type: 'tee',
  sizing: 'mens',
  color: '#000000',
  sleeve: 'short',
  stretch: 'none',
  fitIntent: 'regular',
  chart: { unit: 'cm', girth: 'circumference', lengthDefinition: 'hps' },
  source: { placeholder: false, tier: 'B', url: 'https://example.com', capturedOn: '2026-11-18' },
  sizes: [
    { label: 'S', measurements: { chest: 96, length: 70 } },
    { label: 'M', measurements: { chest: 106, length: 73 } },
    { label: 'L', measurements: { chest: 116, length: 76 } },
  ],
};
const tee = (extra: Partial<SeedGarment> = {}): Garment => normalizeGarment({ ...seedTee, ...extra });

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

describe('seeded random numbers', () => {
  it('repeats exactly for a seed and differs between seeds', () => {
    const a = seededRng(7);
    const b = seededRng(7);
    const c = seededRng(8);
    const xs = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(xs);
    expect(c()).not.toBe(xs[0]);
    for (const x of xs) expect(x >= 0 && x < 1).toBe(true);
  });

  it('normal draws have mean ≈ 0 and SD ≈ 1', () => {
    const rng = seededRng(1);
    const draws = Array.from({ length: 20000 }, () => normal(rng));
    const mean = draws.reduce((a, b) => a + b, 0) / draws.length;
    const sd = Math.sqrt(draws.reduce((a, b) => a + (b - mean) ** 2, 0) / draws.length);
    expect(Math.abs(mean)).toBeLessThan(0.03);
    expect(Math.abs(sd - 1)).toBeLessThan(0.03);
  });
});

describe('spreads', () => {
  it('body: entered is tighter than estimated', () => {
    const b = bodyWith({ chestCm: 100 }, 'entered');
    expect(bodySdCm(b, 'chestCm')).toBe(ENTERED_BODY_SD_CM);
    expect(bodySdCm(b, 'torsoLengthCm')).toBe(ESTIMATED_BODY_SD_CM.torsoLengthCm);
  });

  it('garment: by grade, by a value’s own origin, and widened by an audit', () => {
    const charted = tee();
    expect(charted.grade).toBe('charted');
    expect(garmentSdCm(charted, charted.sizes[1]!, 'chest')).toBe(GARMENT_SD_CM.charted.girth);
    expect(garmentSdCm(charted, charted.sizes[1]!, 'length')).toBe(GARMENT_SD_CM.charted.length);

    const est = tee({
      sizes: [{ label: 'M', measurements: { chest: { value: 106, origin: 'estimated', how: 'test' }, length: 73 } }],
    });
    expect(garmentSdCm(est, est.sizes[0]!, 'chest')).toBe(GARMENT_SD_CM.estimated.girth);

    // Audit measured M at 55 cm flat = 110 round: 4 cm over the chart.
    const audited = tee({
      audit: { measuredSize: 'M', measuredOn: '2026-11-18', afterWash: true, unit: 'cm', measurements: { chest: 55 } },
    });
    expect(auditGapsCm(audited).chest).toBeCloseTo(4);
    expect(garmentSdCm(audited, audited.sizes[0]!, 'chest')).toBeCloseTo(4);
  });
});

describe('sampleFit', () => {
  const body = bodyWith({ chestCm: 100, torsoLengthCm: 72 });

  it('returns odds that sum to 1 per zone and per size, for every size', () => {
    const odds = sampleFit(body, tee(), regular);
    expect(odds.samples).toBe(SAMPLE_COUNT);
    expect(odds.sizes.map((s) => s.sizeLabel)).toEqual(['S', 'M', 'L']);
    for (const s of odds.sizes) {
      expect(sum(s.verdicts)).toBeCloseTo(1);
      for (const z of s.zones) {
        expect(sum(z.labels)).toBeCloseTo(1);
        expect(sum(z.personal)).toBeCloseTo(1);
      }
    }
  });

  it('is stable for a seed', () => {
    expect(sampleFit(body, tee(), regular)).toEqual(sampleFit(body, tee(), regular));
    expect(sampleFit(body, tee(), regular, { seed: 2 })).not.toEqual(sampleFit(body, tee(), regular));
  });

  it('M (+6 cm on a +5 target) is the most likely to fit how you like', () => {
    const odds = sampleFit(body, tee(), regular);
    const [s, m, l] = odds.sizes as [SizeOdds, SizeOdds, SizeOdds];
    expect(m.likes).toBeGreaterThan(s.likes);
    expect(m.likes).toBeGreaterThan(l.likes);
    expect(odds.recommended).toBe('M');
    expect(s.verdicts.snugger + s.verdicts['too-tight']).toBeGreaterThan(0.5);
    expect(l.verdicts.roomier + l.verdicts['much-roomier']).toBeGreaterThan(0.5);
  });

  it('an estimated chest spreads the odds more than a measured one', () => {
    const measured = sampleFit(bodyWith({ chestCm: 100, torsoLengthCm: 72 }, 'entered'), tee(), regular);
    const guessed = sampleFit(bodyWith({ chestCm: 100, torsoLengthCm: 72 }, 'estimated'), tee(), regular);
    expect(measured.sizes[1]!.likes).toBeGreaterThan(guessed.sizes[1]!.likes);
  });

  it('an estimated garment spreads the odds more than a charted one', () => {
    const est = tee({ source: { placeholder: true } });
    expect(est.grade).toBe('estimated');
    expect(sampleFit(body, tee(), regular).sizes[1]!.likes).toBeGreaterThan(sampleFit(body, est, regular).sizes[1]!.likes);
  });

  it('an anchor cancels out an error in the estimated chest', () => {
    // Owns this tee's M and loves it: M should be near certain, whatever the chest estimate.
    const g = tee();
    const spec = preferenceSpec({ kind: 'catalogue', garmentId: 'tee', size: 'M' }, null, () => g);
    const guessed = bodyWith({ chestCm: 100, torsoLengthCm: 72 }, 'estimated');
    const m = sampleFit(guessed, g, spec).sizes[1]!;
    expect(m.likes).toBeGreaterThan(0.9);
  });

  it('reports objective labels per zone alongside the personal ones', () => {
    const m = sampleFit(body, tee(), regular).sizes[1]!;
    const chest = m.zones.find((z) => z.zone === 'chest')!;
    expect(Object.keys(chest.labels)).toEqual(expect.arrayContaining(['fitted', 'relaxed']));
    expect(chest.personal.right).toBeGreaterThan(0.5);
  });
});

describe('recommendSize', () => {
  it('Gildan 5000 on a 178 cm / 75 kg body (estimated) with Regular → M', () => {
    const b = estimateBody({ heightCm: 178, weightKg: 75, sizing: 'mens' });
    expect(recommendSize(b, gildan, regular)).toBe('M');
  });

  it('Knightweave: a measured 38 in chest → M, 43 in → L', () => {
    const kw = findGarment('knightweave-tee')!;
    expect(recommendSize(bodyWith({ chestCm: inToCm(38), torsoLengthCm: 72 }), kw, regular)).toBe('M');
    expect(recommendSize(bodyWith({ chestCm: inToCm(43), torsoLengthCm: 76 }), kw, regular)).toBe('L');
  });

  it('follows the stated style', () => {
    // 100 cm chest: M is +6, L +16. Oversized-likers (+18) go up a size.
    const b = bodyWith({ chestCm: 100, torsoLengthCm: 72 });
    expect(recommendSize(b, tee(), preferenceSpec(null, 'oversized'))).toBe('L');
    expect(recommendSize(b, tee(), preferenceSpec(null, 'slim'))).toBe('M');
  });

  it('skips tight pants and picks the matching inseam', () => {
    const jean = findGarment('corvo-slim-jean')!;
    const b = bodyWith({ waistCm: 83, hipsCm: 99, inseamCm: 81 });
    expect(recommendSize(b, jean, regular)).toBe('32x32');
  });

  it('gives no answer for an unscored garment or one with no girth to score', () => {
    expect(recommendSize(bodyWith({ chestCm: 100 }), findGarment('landsend-super-t')!, regular)).toBeNull();
    const lengthOnly = tee({ sizes: [{ label: 'M', measurements: { length: 73 } }] });
    expect(recommendSize(bodyWith({ chestCm: 100 }), lengthOnly, regular)).toBeNull();
  });
});

describe('pickSize', () => {
  const odds = (sizeLabel: string, likes: number, meanGirthMissCm: number | null = 1): SizeOdds =>
    ({ sizeLabel, likes, meanGirthMissCm, zones: [], verdicts: {} }) as unknown as SizeOdds;

  it('highest chance wins; a tie goes to the roomier size', () => {
    expect(pickSize([odds('S', 0.2), odds('M', 0.7), odds('L', 0.1)], { grade: 'charted' })).toBe('M');
    expect(pickSize([odds('S', 0.5), odds('M', 0.5)], { grade: 'charted' })).toBe('M');
  });

  it('when no size is ever liked, the closest girth wins', () => {
    expect(pickSize([odds('S', 0, 9), odds('M', 0, 4), odds('L', 0, 6)], { grade: 'charted' })).toBe('M');
  });

  it('never picks on length alone, and never for an unscored garment', () => {
    expect(pickSize([odds('S', 0, null)], { grade: 'charted' })).toBeNull();
    expect(pickSize([odds('S', 0.9)], { grade: 'unscored' })).toBeNull();
  });
});

describe('measurementHint', () => {
  it('names the chest when measuring it could move the answer between sizes', () => {
    // 101.6 cm chest sits between Gildan M (+0) and L (+10): an estimate can’t decide.
    const b = bodyWith({ chestCm: 101.6, torsoLengthCm: 73 }, 'estimated');
    const hint = measurementHint(b, gildan, regular);
    expect(hint?.key).toBe('chestCm');
    expect(hint?.sizes).toEqual(['M', 'L']);
  });

  it('says nothing once the chest is measured', () => {
    expect(measurementHint(bodyWith({ chestCm: 101.6, torsoLengthCm: 73 }, 'entered'), gildan, regular)).toBeNull();
  });

  it('says nothing about the chest with an anchor tee', () => {
    const spec = preferenceSpec({ kind: 'catalogue', garmentId: 'gildan-5000', size: 'M' }, null);
    expect(measurementHint(bodyWith({ chestCm: 101.6, torsoLengthCm: 73 }, 'estimated'), gildan, spec)).toBeNull();
  });

  it('says nothing when there is no recommendation', () => {
    expect(measurementHint(bodyWith({ chestCm: 100 }, 'estimated'), findGarment('landsend-super-t')!, regular)).toBeNull();
  });
});
