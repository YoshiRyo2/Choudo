import { describe, expect, it } from 'vitest';
import { estimateBody } from '../domain/body';
import { fitGarment, preferenceSpec, VERDICTS, type GarmentOdds, type SizeOdds, type Verdict, type ZoneFit, type ZoneOdds } from '../domain/fit';
import { findGarment } from '../domain/garments';
import { UNKNOWN_CHEST_TEE } from '../domain/garments/testFixtures';
import {
  describeZone,
  zoneName,
  fitReferenceLine,
  formatPercent,
  labelOddsText,
  measureHintText,
  personalOddsText,
  preferenceNote,
  verdictLine,
  formatDiff,
  garmentTag,
  GRADE_EXPLAINED,
  sizeLine,
  sourceLine,
  summarize,
  zoneLabelText,
} from './fitText';

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

  it('calls the chest the bust for a women’s body', () => {
    expect(describeZone(zone({ diffCm: 4 }), 'metric', 'womens')).toBe('4.0 cm of room at your bust.');
    expect(describeZone(zone({ diffCm: -3, label: 'tight' }), 'metric', 'womens')).toBe('3.0 cm smaller than your bust.');
    expect(describeZone(zone({ zone: 'waist', diffCm: 4 }), 'metric', 'womens')).toBe('4.0 cm of room at your waist.');
  });

  it('passes through the engine’s reason when unknown', () => {
    expect(describeZone(zone({ diffCm: null, label: 'unknown', note: 'No data.' }), 'metric')).toBe('No data.');
  });
});

describe('zoneName', () => {
  it('labels the chest zone Bust for a women’s body, and nothing else changes', () => {
    expect(zoneName('chest', 'womens')).toBe('Bust');
    expect(zoneName('chest', 'mens')).toBe('Chest');
    expect(zoneName('chest')).toBe('Chest');
    expect(zoneName('waist', 'womens')).toBe('Waist');
    expect(zoneName('length', 'womens')).toBe('Length');
  });
});

const UNKNOWN_CHEST_FIT = (b: ReturnType<typeof estimateBody>) => fitGarment(b, UNKNOWN_CHEST_TEE, 'M');

describe('summarize', () => {
  const body = estimateBody({ heightCm: 176, weightKg: 85, bodyType: 'mens' });

  it('names the problem zones', () => {
    const tall = estimateBody({ heightCm: 190, weightKg: 110, bodyType: 'mens' });
    const s = summarize(fitGarment(tall, findGarment('fieldline-straight-chino')!, '30'));
    expect(s.headline).toBe('Probably won’t fit');
    expect(s.detail).toMatch(/^Tight at the waist/);
  });

  it('says “at the bust” and “the bust” for a women’s body', () => {
    const womens = estimateBody({ heightCm: 165, weightKg: 60, bodyType: 'womens' });
    const fit = fitGarment(womens, findGarment('gildan-5000')!, 'S');
    expect(fit.bodyType).toBe('womens');
    const tight = { ...fit, overall: 'bad' as const, zones: [{ ...fit.zones[0]!, label: 'tight' as const, tone: 'bad' as const }] };
    expect(summarize(tight).detail).toBe('Tight at the bust.');
    expect(summarize({ ...fit, bodyType: 'womens', zones: UNKNOWN_CHEST_FIT(womens).zones, overall: 'unknown' }).detail).toBe(
      'This size chart doesn’t let us compare the bust.',
    );
  });

  it('says when estimates were used', () => {
    expect(summarize(fitGarment(body, findGarment('knightweave-tee')!, 'L')).usesEstimates).toBe(true);
  });

  it('says which zones it could not check instead of claiming a good fit', () => {
    const s = summarize(fitGarment(body, UNKNOWN_CHEST_TEE, 'M'));
    expect(s.headline).toBe('Can’t check this fit');
    expect(s.detail).toBe('This size chart doesn’t let us compare the chest.');
  });
});

describe('sizeLine', () => {
  it('says whether the size was picked for you', () => {
    expect(sizeLine('M', true)).toBe('Your size: M');
    expect(sizeLine('L', false)).toBe('Size L · we couldn’t pick one for you');
  });
});

describe('garmentTag', () => {
  it('keeps "Sample data" for placeholders and shows the grade otherwise', () => {
    expect(garmentTag(findGarment('fieldline-oxford')!)).toEqual({ kind: 'sample', text: 'Sample data' });
    expect(garmentTag(findGarment('gildan-5000')!)).toEqual({ kind: 'charted', text: 'From size chart' });
    expect(garmentTag(UNKNOWN_CHEST_TEE)).toEqual({ kind: 'unscored', text: 'Can’t score' });
    expect(garmentTag({ source: { placeholder: false, tier: 'A' }, grade: 'verified' }).text).toBe('Verified');
    expect(garmentTag({ source: { placeholder: false, tier: 'E' }, grade: 'estimated' }).text).toBe('Estimated');
  });
});

describe('sourceLine', () => {
  it('names the tier in plain words and the date it was copied', () => {
    const line = sourceLine(findGarment('gildan-5000')!);
    expect(line).toMatch(/^From a published garment size chart, copied .*2026\.$/);
    expect(sourceLine({ source: { placeholder: false, tier: 'D' } })).toBe('From a retailer’s product listing.');
  });

  it('explains every grade', () => {
    expect(Object.keys(GRADE_EXPLAINED).sort()).toEqual(['charted', 'estimated', 'unscored', 'verified']);
  });
});

describe('fitReferenceLine', () => {
  it('names the anchor tee, the measured tee, the style, or the default', () => {
    expect(fitReferenceLine({ kind: 'catalogue', garmentId: 'gildan-5000', size: 'M' }, null, 'metric', findGarment)).toBe(
      'Your Gildan Heavy Cotton T-Shirt (5000) in M.',
    );
    expect(fitReferenceLine({ kind: 'measured', chestFlatCm: 53, lengthCm: 74 }, 'slim', 'metric', findGarment)).toBe(
      'A tee you measured: 53 cm across, 74 cm long.',
    );
    expect(fitReferenceLine(null, 'oversized', 'metric', findGarment)).toBe('You like tees oversized.');
    expect(fitReferenceLine(null, null, 'metric', findGarment)).toBe('Not set yet, so we assume you like a regular fit.');
  });
});

/** Size odds with the given verdict chances (the rest 0). */
function sizeOdds(sizeLabel: string, verdicts: Partial<Record<Verdict, number>>): SizeOdds {
  const all = Object.fromEntries(VERDICTS.map((v) => [v, verdicts[v] ?? 0])) as Record<Verdict, number>;
  return { sizeLabel, zones: [], verdicts: all, likes: all.fits + all['as-designed'], meanGirthMissCm: 1 };
}
const oddsOf = (...sizes: SizeOdds[]): GarmentOdds => ({ garmentId: 'g', sizes, recommended: null, samples: 500 });
const top = { category: 'top', fitIntent: 'regular' } as const;

describe('verdictLine', () => {
  it('words the likeliest verdict by how sure we are', () => {
    const odds = oddsOf(
      sizeOdds('S', { snugger: 0.6, fits: 0.1, 'too-tight': 0.3 }),
      sizeOdds('M', { fits: 0.82, roomier: 0.18 }),
      sizeOdds('XL', { 'much-roomier': 0.9, roomier: 0.1 }),
      sizeOdds('L', { fits: 0.15, roomier: 0.45, 'much-roomier': 0.4 }),
    );
    expect(verdictLine(odds, 'M', top)).toEqual({
      headline: 'Very likely fits how you like',
      detail: '82% chance it fits how you like.',
      tone: 'good',
      verdict: 'fits',
    });
    expect(verdictLine(odds, 'S', top).headline).toBe('Probably a bit snugger than you like');
    expect(verdictLine(odds, 'XL', top).headline).toBe('Very likely much roomier than you like');
    expect(verdictLine(odds, 'L', top).headline).toBe('Might be roomier than you like');
  });

  it('calls a close call between two sizes, in chart order', () => {
    const odds = oddsOf(sizeOdds('M', { fits: 0.39, snugger: 0.5, 'too-tight': 0.11 }), sizeOdds('L', { fits: 0.3, roomier: 0.7 }));
    expect(verdictLine(odds, 'L', top).headline).toBe('Could go either way: M or L');
    expect(verdictLine(odds, 'M', top).headline).toBe('Could go either way: M or L');
  });

  it('is not a close call when the runner-up is unlikely', () => {
    const odds = oddsOf(sizeOdds('M', { fits: 0.3, snugger: 0.7 }), sizeOdds('L', { fits: 0.2, roomier: 0.8 }));
    expect(verdictLine(odds, 'M', top).headline).toBe('Probably a bit snugger than you like');
  });

  it('says “as designed” for a looser cut, and stays objective for bottoms', () => {
    const odds = oddsOf(sizeOdds('M', { 'as-designed': 0.8, roomier: 0.2 }));
    expect(verdictLine(odds, 'M', { category: 'top', fitIntent: 'oversized' }).headline).toBe('Very likely oversized, as designed');
    const pants = oddsOf(sizeOdds('32', { fits: 0.6, shorter: 0.4 }));
    expect(verdictLine(pants, '32', { category: 'bottom', fitIntent: 'slim' })).toMatchObject({
      headline: 'Probably fits well',
      detail: '60% chance it fits well.',
    });
  });

  it('never says a 0% or 100% chance', () => {
    const odds = oddsOf(sizeOdds('S', { 'too-tight': 1 }), sizeOdds('M', { fits: 1 }));
    expect(verdictLine(odds, 'S', top).detail).toBe('<1% chance it fits how you like.');
    expect(verdictLine(odds, 'M', top).detail).toBe('>99% chance it fits how you like.');
  });

  it('can’t check a fit that is mostly unknown', () => {
    expect(verdictLine(oddsOf(sizeOdds('M', { unknown: 1 })), 'M', top)).toMatchObject({ headline: 'Can’t check this fit', detail: null });
  });
});

describe('odds wording', () => {
  it('formats percentages without hiding small chances', () => {
    expect(formatPercent(0.473)).toBe('47%');
    expect(formatPercent(0.002)).toBe('<1%');
    expect(formatPercent(0.998)).toBe('>99%');
  });

  it('never says 0% or 100%', () => {
    expect(formatPercent(0)).toBe('<1%');
    expect(formatPercent(0.004)).toBe('<1%');
    expect(formatPercent(0.005)).toBe('1%');
    expect(formatPercent(0.01)).toBe('1%');
    expect(formatPercent(0.99)).toBe('99%');
    expect(formatPercent(0.994)).toBe('99%');
    expect(formatPercent(0.995)).toBe('>99%'); // would round to 100
    expect(formatPercent(1)).toBe('>99%');
  });

  const chest: ZoneOdds = {
    zone: 'chest',
    kind: 'girth',
    labels: { relaxed: 0.3, fitted: 0.61, tight: 0.09, loose: 0.004 },
    personal: { under: 0.24, right: 0.47, over: 0.29, unknown: 0 },
  };

  it('lists labels likeliest first and drops the ones under 1%', () => {
    expect(labelOddsText(chest)).toBe('Fitted 61% · Relaxed 30% · Tight 9%');
  });

  it('lists the personal result for a top’s chest, and length only with a preference', () => {
    expect(personalOddsText(chest, { category: 'top' }, false)).toBe('As you like 47% · Roomier 29% · Snugger 24%');
    expect(personalOddsText(chest, { category: 'bottom' }, false)).toBeNull();
    const length: ZoneOdds = { ...chest, zone: 'length', kind: 'length' };
    expect(personalOddsText(length, { category: 'top' }, false)).toBeNull();
    expect(personalOddsText(length, { category: 'top' }, true)).toBe('As you like 47% · Longer 29% · Shorter 24%');
  });

  it('names the measurement that would decide the size', () => {
    expect(measureHintText({ key: 'chestCm', sizes: ['M', 'L'] })).toBe('Measure your chest to decide between M and L.');
    expect(measureHintText({ key: 'chestCm', sizes: ['M', 'L'] }, 'womens')).toBe('Measure your bust to decide between M and L.');
    expect(measureHintText({ key: 'waistCm', sizes: ['M', 'L'] }, 'womens')).toBe('Measure your waist to decide between M and L.');
    expect(measureHintText({ key: 'inseamCm', sizes: ['30x30', '30x32', '32x32'] })).toBe(
      'Measure your inseam to decide between 30x30, 30x32 and 32x32.',
    );
  });
});

describe('preferenceNote', () => {
  it('says what the verdict is compared with', () => {
    expect(preferenceNote(preferenceSpec(null, 'slim'))).toBe('Compared with how you like tees: slim.');
    expect(preferenceNote(preferenceSpec(null, null))).toMatch(/^Assuming you like a regular fit/);
    expect(preferenceNote(preferenceSpec({ kind: 'measured', chestFlatCm: 53, lengthCm: 74 }, null))).toBe('Compared with the tee you measured.');
    expect(preferenceNote(preferenceSpec({ kind: 'catalogue', garmentId: 'gildan-5000', size: 'M' }, null))).toBe(
      'Compared with the tee you own and like.',
    );
  });
});

describe('pants wording', () => {
  const rise = (diffCm: number, landing: string) => zone({ zone: 'rise', kind: 'landing', label: 'noted', diffCm, landing });
  const opening = (diffCm: number, landing: string) => zone({ zone: 'legOpening', kind: 'landing', label: 'noted', diffCm, landing });

  it('names the new zones', () => {
    expect(['thigh', 'rise', 'legOpening'].map((z) => zoneName(z as ZoneFit['zone']))).toEqual(['Thigh', 'Rise', 'Leg opening']);
  });

  it('describes the thigh like the other girths', () => {
    expect(describeZone(zone({ zone: 'thigh', diffCm: 3 }), 'metric')).toBe('3.0 cm of room at your thigh.');
    expect(describeZone(zone({ zone: 'thigh', diffCm: 3 }), 'imperial')).toBe('1.2 in of room at your thigh.');
  });

  it('says where the waistband sits against the navel (0.71 a cm of rise for a women’s body)', () => {
    expect(describeZone(rise(-10, 'low'), 'metric', 'womens')).toBe('Low rise: the waistband sits about 7.1 cm below your navel.');
    expect(describeZone(rise(-4, 'mid'), 'imperial', 'womens')).toBe('Mid rise: the waistband sits about 1.1 in below your navel.');
    expect(describeZone(rise(0.3, 'high'), 'metric', 'womens')).toBe('High rise: the waistband sits at your navel.');
    expect(describeZone(rise(3, 'high'), 'metric', 'womens')).toBe('High rise: the waistband sits about 2.1 cm above your navel.');
    expect(describeZone(rise(-1.5, 'high'), 'metric', 'mens')).toBe('High rise: the waistband sits about 1.2 cm below your navel.');
  });

  it('compares the leg opening with the heel', () => {
    expect(describeZone(opening(-2, 'skinny'), 'metric')).toBe('Skinny: 2.0 cm narrower than your heel, so it relies on stretch or a zip to get on.');
    expect(describeZone(opening(3, 'slim'), 'metric')).toBe('Slim leg: 3.0 cm wider than your heel.');
    expect(describeZone(opening(8, 'straight'), 'imperial')).toBe('Straight leg: 3.1 in wider than your heel.');
    expect(describeZone(opening(16, 'wide'), 'metric')).toBe('Wide leg: 16.0 cm wider than your heel.');
  });

  it('gives a blocked zone the engine’s reason', () => {
    const blocked = zone({ zone: 'legOpening', kind: 'landing', label: 'tight', tone: 'bad', diffCm: -3, landing: 'skinny', note: 'Too narrow to get over your heel: no stretch and no zip.' });
    expect(describeZone(blocked, 'metric')).toBe('Too narrow to get over your heel: no stretch and no zip.');
    expect(zoneLabelText(blocked)).toBe('Won’t go on');
    const low = zone({ zone: 'rise', kind: 'landing', label: 'short', tone: 'bad', diffCm: -20, landing: 'low', note: 'x' });
    expect(zoneLabelText(low)).toBe('Won’t stay up');
  });

  it('labels a landing zone by where it lands', () => {
    expect(zoneLabelText(rise(-4, 'mid'))).toBe('Mid rise');
    expect(zoneLabelText(opening(8, 'straight'))).toBe('Straight leg');
    expect(zoneLabelText(opening(-2, 'skinny'))).toBe('Skinny');
    expect(zoneLabelText(zone({ label: 'fitted' }))).toBe('Fitted');
  });

  it('summarize names a blocked opening', () => {
    const body = estimateBody({ heightCm: 176, weightKg: 85, bodyType: 'mens' });
    const jean = findGarment('corvo-relaxed-jean')!;
    const narrow = { ...jean, sizes: jean.sizes.map((s) => ({ ...s, measurements: { ...s.measurements, legOpening: 30 } })) };
    const s = summarize(fitGarment(body, narrow, '32x32'));
    expect(s.headline).toBe('Probably won’t fit');
    expect(s.detail).toMatch(/won’t go on at the hem/i);
  });
});
