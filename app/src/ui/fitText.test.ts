import { describe, expect, it } from 'vitest';
import { estimateBody } from '../domain/body';
import { fitGarment, preferenceSpec, sampleFit, VERDICTS, type GarmentOdds, type SizeOdds, type Verdict, type ZoneFit, type ZoneOdds } from '../domain/fit';
import { findGarment, GARMENTS, type GarmentType } from '../domain/garments';
import { UNKNOWN_CHEST_TEE } from '../domain/garments/testFixtures';
import {
  describeZone,
  zoneName,
  fitReferenceLine,
  formatPercent,
  labelOddsText,
  measureHintAction,
  measureHintText,
  personalOddsText,
  preferenceNote,
  verdictLine,
  fittingHeadline,
  isJustRight,
  headlineSize,
  sizeTone,
  formatDiff,
  garmentTag,
  GRADE_EXPLAINED,
  sizeLine,
  sourceLine,
  summarize,
  zoneLabelText,
  bodyPlaceText,
  layerNoteLines,
  layerNoteText,
  wornOverText,
  objectiveOnly,
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
      closeCall: false,
    });
    expect(verdictLine(odds, 'S', top).headline).toBe('Probably a bit snugger than you like');
    expect(verdictLine(odds, 'XL', top).headline).toBe('Very likely much roomier than you like');
    expect(verdictLine(odds, 'L', top).headline).toBe('Might be roomier than you like');
  });

  it('calls a close call between two sizes, in chart order', () => {
    const odds = oddsOf(sizeOdds('M', { fits: 0.39, snugger: 0.5, 'too-tight': 0.11 }), sizeOdds('L', { fits: 0.3, roomier: 0.7 }));
    expect(verdictLine(odds, 'L', top).headline).toBe('Could go either way: M or L');
    expect(verdictLine(odds, 'M', top).headline).toBe('Could go either way: M or L');
    expect(verdictLine(odds, 'M', top).closeCall).toBe(true);
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

describe('sizeTone', () => {
  it('is the tone of the size’s likeliest verdict', () => {
    const odds = oddsOf(
      sizeOdds('S', { 'too-tight': 0.7, snugger: 0.3 }),
      sizeOdds('M', { snugger: 0.55, fits: 0.45 }),
      sizeOdds('L', { 'as-designed': 0.6, roomier: 0.4 }),
    );
    expect(sizeTone(odds, 'S')).toBe('bad');
    expect(sizeTone(odds, 'M')).toBe('warn');
    expect(sizeTone(odds, 'L')).toBe('good');
  });

  it('is unknown for a size that can’t be scored, or isn’t there', () => {
    const odds = oddsOf(sizeOdds('M', { unknown: 0.6, fits: 0.4 }));
    expect(sizeTone(odds, 'M')).toBe('unknown');
    expect(sizeTone(odds, 'XL')).toBe('unknown');
  });

  it('ignores the close call, which is about choosing between sizes', () => {
    const odds = oddsOf(sizeOdds('M', { fits: 0.39, snugger: 0.5, 'too-tight': 0.11 }), sizeOdds('L', { fits: 0.3, roomier: 0.7 }));
    expect(verdictLine(odds, 'M', top).tone).toBe('warn');
    expect(sizeTone(odds, 'M')).toBe('warn');
    expect(verdictLine(odds, 'L', top).tone).toBe('warn');
    expect(sizeTone(odds, 'L')).toBe('warn');
    const close = oddsOf(sizeOdds('M', { fits: 0.45, roomier: 0.55 }), sizeOdds('L', { 'as-designed': 0.4, 'much-roomier': 0.6 }));
    expect(verdictLine(close, 'L', top).headline).toBe('Could go either way: M or L');
    expect(sizeTone(close, 'L')).toBe('bad');
  });

  it('matches the verdict line’s tone for every catalogue size that isn’t a close call', () => {
    const bodies = [
      estimateBody({ heightCm: 170, weightKg: 62, bodyType: 'womens' }),
      estimateBody({ heightCm: 178, weightKg: 75, bodyType: 'mens' }),
    ];
    let compared = 0;
    for (const body of bodies) {
      for (const garment of GARMENTS) {
        const odds = sampleFit(body, garment, preferenceSpec(null, null), { samples: 100 });
        for (const { sizeLabel } of odds.sizes) {
          const line = verdictLine(odds, sizeLabel, garment);
          if (line.closeCall) continue;
          expect([garment.id, sizeLabel, sizeTone(odds, sizeLabel)]).toEqual([garment.id, sizeLabel, line.tone]);
          compared++;
        }
      }
    }
    expect(compared).toBeGreaterThan(50);
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

  it('labels the hint button with the measurement to add, bust for a women’s body', () => {
    expect(measureHintAction({ key: 'chestCm', sizes: ['M', 'L'] })).toBe('Add chest');
    expect(measureHintAction({ key: 'chestCm', sizes: ['M', 'L'] }, 'womens')).toBe('Add bust');
    expect(measureHintAction({ key: 'waistCm', sizes: ['M', 'L'] }, 'womens')).toBe('Add waist');
    expect(measureHintAction({ key: 'hipsCm', sizes: ['M', 'L'] })).toBe('Add hips');
    expect(measureHintAction({ key: 'inseamCm', sizes: ['30x30', '30x32'] }, 'mens')).toBe('Add inseam');
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

describe('landing-zone odds', () => {
  const landing = (zone: ZoneOdds['zone'], labels: ZoneOdds['labels']): ZoneOdds => ({
    zone,
    kind: 'landing',
    labels,
    personal: { under: 0, right: 1, over: 0, unknown: 0 },
  });

  it('gives only the chance it won’t go on or stay up', () => {
    expect(labelOddsText(landing('legOpening', { noted: 0.96, tight: 0.04 }))).toBe('Won’t go on 4%');
    expect(labelOddsText(landing('rise', { noted: 0.9, short: 0.1 }))).toBe('Won’t stay up 10%');
  });

  it('says nothing when it always lands', () => {
    expect(labelOddsText(landing('rise', { noted: 1 }))).toBe('');
  });
});

describe('a body number worked out at the band', () => {
  it('says where it was measured', () => {
    expect(bodyPlaceText(zone({ zone: 'waist', bodyAt: 'band' }))).toBe(' where the waistband sits');
    expect(bodyPlaceText(zone({ zone: 'waist' }))).toBe('');
  });
});

describe('knit wording', () => {
  it('names the hem band', () => {
    expect(zoneName('hemBand')).toBe('Hem band');
  });

  it('describes a hem band against the hips', () => {
    const band = (patch: Partial<ZoneFit>) => zone({ zone: 'hemBand', ...patch });
    expect(describeZone(band({ diffCm: 6, label: 'relaxed' }), 'metric')).toBe('6.0 cm wider than your hips, relaxed.');
    expect(describeZone(band({ diffCm: 14, label: 'loose' }), 'metric')).toBe(
      '14.0 cm wider than your hips, so it hangs open rather than gathering.',
    );
    expect(describeZone(band({ diffCm: -8, label: 'fitted' }), 'metric')).toBe(
      '8.0 cm smaller than your hips, relaxed; the rib stretches to gather there.',
    );
    expect(describeZone(band({ diffCm: -30, label: 'tight' }), 'metric')).toBe(
      '30.0 cm smaller than your hips: more than the rib can stretch.',
    );
    expect(describeZone(band({ diffCm: 0.1 }), 'metric')).toBe('Matches your hips, relaxed.');
  });

  it('says where a centre-back length or sleeve is measured from', () => {
    expect(bodyPlaceText(zone({ zone: 'length', kind: 'length', bodyAt: 'centre_back' }))).toBe(' from the back of your neck');
    expect(bodyPlaceText(zone({ zone: 'sleeve', kind: 'length', bodyAt: 'centre_back' }))).toBe(
      ' from the centre of your back to the wrist',
    );
  });
});

describe('skirt and shorts wording', () => {
  const landing = (z: ZoneFit['zone'], diffCm: number, mark: string, patch: Partial<ZoneFit> = {}) =>
    zone({ zone: z, kind: 'landing', label: 'noted', diffCm, landing: mark, ...patch });

  it('names walking room', () => {
    expect(zoneName('walkingRoom')).toBe('Walking room');
  });

  it('says where a shorts hem ends against the knee', () => {
    expect(zoneLabelText(landing('inseam', -16.3, 'mid-thigh'))).toBe('Mid-thigh');
    expect(describeZone(landing('inseam', -16.3, 'mid-thigh'), 'metric')).toBe('Mid-thigh: the hem ends 16.3 cm above your knee.');
    expect(describeZone(landing('inseam', -0.2, 'knee'), 'metric')).toBe('At the knee: the hem ends at your knee.');
  });

  it('still compares a pants inseam with yours', () => {
    expect(describeZone(zone({ zone: 'inseam', kind: 'length', label: 'good', diffCm: 1 }), 'metric')).toBe('1.0 cm longer than your inseam.');
  });

  it('says where a skirt hem ends against the knee', () => {
    expect(zoneLabelText(landing('length', 13.1, 'midi'))).toBe('Midi');
    expect(zoneLabelText(landing('length', -20, 'mini'))).toBe('Mini');
    expect(zoneLabelText(landing('length', -8, 'above-knee'))).toBe('Above the knee');
    expect(zoneLabelText(landing('length', 30, 'maxi'))).toBe('Maxi');
    expect(describeZone(landing('length', 13.1, 'midi'), 'metric')).toBe('Midi: the hem ends 13.1 cm below your knee.');
    expect(describeZone(landing('length', -8, 'above-knee'), 'imperial')).toBe('Above the knee: the hem ends 3.1 in above your knee.');
  });

  it('keeps a top’s length wording', () => {
    expect(describeZone(zone({ zone: 'length', kind: 'length', label: 'good', diffCm: 0 }), 'metric')).toBe('A regular length on you.');
  });

  it('warns when the hem is too narrow for a full stride', () => {
    const tight = landing('walkingRoom', -8.3, 'restricted', { tone: 'warn' });
    expect(zoneLabelText(tight)).toBe('Short steps');
    expect(describeZone(tight, 'metric')).toBe('8.3 cm short of a full stride at the hem: expect shorter steps, or look for a slit.');
    const free = landing('walkingRoom', 15.5, 'free');
    expect(zoneLabelText(free)).toBe('Full stride');
    expect(describeZone(free, 'metric')).toBe('Room for a full stride, with 15.5 cm to spare at the hem.');
  });

  it('says where each worked-out body number is taken', () => {
    expect(bodyPlaceText(landing('inseam', -16, 'mid-thigh', { bodyAt: 'knee' }))).toBe(' from your crotch to your knee');
    expect(bodyPlaceText(landing('length', 13, 'midi', { bodyAt: 'knee' }))).toBe(' from the waistband to your knee');
    expect(bodyPlaceText(landing('walkingRoom', 15, 'free', { bodyAt: 'stride' }))).toBe(' round both legs mid-stride, at the hem');
    expect(bodyPlaceText(zone({ zone: 'hips', bodyAt: 'hip_point' }))).toBe(' where the chart measures the hips');
  });
});

describe('jacket wording', () => {
  it('describes a charted shoulder against the shoulder points', () => {
    const s = (diffCm: number, label: ZoneFit['label'] = 'fitted') => describeZone(zone({ zone: 'shoulder', diffCm, label }), 'metric');
    expect(s(3, 'relaxed')).toBe('Shoulder seams sit 3.0 cm wider than your shoulders.');
    expect(s(0.2)).toBe('Shoulder seams sit right on your shoulders.');
    expect(s(-2, 'tight')).toBe('Shoulder seams sit 2.0 cm narrower than your shoulders.');
    expect(zoneName('shoulder')).toBe('Shoulders');
  });

  it('places a jacket hem against the hip line, and still a skirt hem against the knee', () => {
    const jacket = (diffCm: number, landing: string) => describeZone(zone({ zone: 'length', kind: 'landing', label: 'noted', diffCm, landing }), 'metric');
    expect(jacket(2, 'hip')).toBe('Hip length: the hem ends 2.0 cm below your hip line.');
    expect(jacket(0.2, 'hip')).toBe('Hip length: the hem ends at your hip line.');
    expect(jacket(-8, 'cropped')).toBe('Cropped: the hem ends 8.0 cm above your hip line.');
    expect(jacket(35, 'knee-length')).toBe('Knee length: the hem ends 35.0 cm below your hip line.');
    const skirt = describeZone(zone({ zone: 'length', kind: 'landing', label: 'noted', diffCm: -6, landing: 'above-knee', bodyAt: 'knee' }), 'metric');
    expect(skirt).toMatch(/above your knee\.$/);
  });
});

describe('layer wording', () => {
  const hoodie = { garmentId: 'gildan-18500', type: 'hoodie' as const };

  it('says what a jacket is worn over, by the type of the top', () => {
    const over = (type: GarmentType) => wornOverText({ over: { garmentId: 'x', type } });
    expect(wornOverText({})).toBeNull();
    expect(over('hoodie')).toBe('With your hoodie under it');
    expect(over('tee')).toBe('With your tee under it');
    expect(over('long-sleeve-tee')).toBe('With your long-sleeve tee under it');
    expect(over('button-up')).toBe('With your shirt under it');
    expect(over('sweatshirt')).toBe('With your sweatshirt under it');
  });

  it('places a layered body number over the layer', () => {
    expect(bodyPlaceText(zone({ bodyAt: 'over_layer' }), hoodie)).toBe(' with your hoodie under it');
    expect(bodyPlaceText(zone({ bodyAt: 'over_layer' }))).toBe(' with what’s under it');
  });

  it('words each layer note', () => {
    expect(layerNoteText({ kind: 'hem-shows', cm: 6 }, 'hoodie', 'jacket', 'metric')).toBe('Your hoodie shows 6.0 cm below the jacket’s hem.');
    expect(layerNoteText({ kind: 'cuffs-show', cm: 2 }, 'hoodie', 'coat', 'metric')).toBe('Your hoodie’s cuffs show past the coat’s sleeves.');
    expect(layerNoteText({ kind: 'bunches', cm: 4 }, 'sweatshirt', 'jacket', 'metric')).toBe(
      'Your sweatshirt is roomier than the jacket leaves room for: expect it to bunch up underneath.',
    );
  });

  it('gives a jacket the personal verdict words, as a top', () => {
    const odds: GarmentOdds = {
      garmentId: 'j',
      recommended: 'M',
      samples: 500,
      sizes: [{ sizeLabel: 'M', zones: [], verdicts: { ...Object.fromEntries(VERDICTS.map((v) => [v, 0])), fits: 0.8 } as Record<Verdict, number>, likes: 0.8, meanGirthMissCm: 1 }],
    };
    const line = verdictLine(odds, 'M', { category: 'outer', fitIntent: 'regular' });
    expect(line.headline).toBe('Very likely fits how you like');
    expect(line.detail).toBe('80% chance it fits how you like.');
    const chest: ZoneOdds = { zone: 'chest', kind: 'girth', labels: {}, personal: { under: 0.1, right: 0.8, over: 0.1, unknown: 0 } };
    expect(personalOddsText(chest, { category: 'outer' }, false)).toMatch(/^As you like 80%/);
    const landing: ZoneOdds = { zone: 'length', kind: 'landing', labels: { noted: 1 }, personal: { under: 0, right: 1, over: 0, unknown: 0 } };
    expect(personalOddsText(landing, { category: 'outer' }, true)).toBeNull();
  });
});

describe('layerNoteLines', () => {
  it('words the notes for a jacket over a top, and gives none without one', () => {
    const body = estimateBody({ heightCm: 176, weightKg: 85, bodyType: 'mens' });
    const hoodie = { garment: findGarment('gildan-18500')!, sizeLabel: 'XL' };
    const jacket = { garment: findGarment('port-authority-j317')!, sizeLabel: 'S' };
    const lines = layerNoteLines(body, hoodie, jacket, 'metric');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => l.startsWith('Your hoodie'))).toBe(true);
    expect(layerNoteLines(body, undefined, jacket, 'metric')).toEqual([]);
  });

  it('never says a dress shows below the jacket', () => {
    const body = estimateBody({ heightCm: 163, weightKg: 68, bodyType: 'womens' });
    const dress = { garment: findGarment('landsend-sheath-dress')!, sizeLabel: '10' };
    const jacket = { garment: findGarment('port-authority-l317')!, sizeLabel: 'S' };
    expect(layerNoteLines(body, dress, jacket, 'metric').some((l) => l.includes('below'))).toBe(false);
  });
});

describe('dress wording', () => {
  const odds: GarmentOdds = {
    garmentId: 'd',
    recommended: '10',
    samples: 500,
    sizes: [{ sizeLabel: '10', zones: [], verdicts: { ...Object.fromEntries(VERDICTS.map((v) => [v, 0])), fits: 0.8 } as Record<Verdict, number>, likes: 0.8, meanGirthMissCm: 1 }],
  };
  const dress = { category: 'onepiece' as const, fitIntent: 'regular' as const };

  it('words a dress as fitting well, with no personal target (as a bottom)', () => {
    expect(verdictLine(odds, '10', dress).detail).toBe('80% chance it fits well.');
    expect(objectiveOnly(dress)).toBe(true);
    expect(objectiveOnly({ category: 'bottom' })).toBe(true);
    expect(objectiveOnly({ category: 'top' })).toBe(false);
    expect(objectiveOnly({ category: 'outer' })).toBe(false);
    const chest: ZoneOdds = { zone: 'chest', kind: 'girth', labels: {}, personal: { under: 0.1, right: 0.8, over: 0.1, unknown: 0 } };
    expect(personalOddsText(chest, dress, false)).toBeNull();
  });

  it('says a jacket goes over your dress', () => {
    expect(wornOverText({ over: { garmentId: 'x', type: 'dress' } })).toBe('With your dress under it');
  });

  it('measures a dress hem from the shoulder to the knee', () => {
    const hem = zone({ zone: 'length', kind: 'landing', label: 'noted', diffCm: 8, landing: 'midi', bodyAt: 'shoulder_knee' });
    expect(bodyPlaceText(hem)).toBe(' from your shoulder to your knee');
    expect(describeZone(hem, 'metric')).toBe('Midi: the hem ends 8.0 cm below your knee.');
  });

  it('calls the chest Bust on a women’s body, Chest on a men’s', () => {
    const woman = estimateBody({ heightCm: 163, weightKg: 68, bodyType: 'womens' });
    const man = estimateBody({ heightCm: 176, weightKg: 85, bodyType: 'mens' });
    const sheath = findGarment('landsend-sheath-dress')!;
    const chestOf = (b: typeof woman) => fitGarment(b, sheath, '10').zones.find((z) => z.zone === 'chest')!;
    expect(zoneName('chest', fitGarment(woman, sheath, '10').bodyType)).toBe('Bust');
    expect(zoneName('chest', fitGarment(man, sheath, '10').bodyType)).toBe('Chest');
    expect(chestOf(woman).label).not.toBe('unknown');
  });
});

describe('headlineSize', () => {
  it('names the size after a one-size headline', () => {
    const odds = oddsOf(sizeOdds('M', { fits: 0.82, roomier: 0.18 }), sizeOdds('L', { roomier: 0.9, fits: 0.1 }));
    const line = verdictLine(odds, 'M', top);
    expect(line.closeCall).toBe(false);
    expect(headlineSize(line, 'M')).toBe('M');
  });

  it('names no size after a close call, which already names both', () => {
    const odds = oddsOf(sizeOdds('M', { fits: 0.39, snugger: 0.5, 'too-tight': 0.11 }), sizeOdds('L', { fits: 0.3, roomier: 0.7 }));
    expect(headlineSize(verdictLine(odds, 'M', top), 'M')).toBeNull();
  });

  it('names a size after "Can’t check this fit"', () => {
    const line = verdictLine(oddsOf(sizeOdds('M', { unknown: 1 })), 'M', top);
    expect(headlineSize(line, 'M')).toBe('M');
  });

  // The demo case: Fit details read "Could go either way: 8 or 10 in 8".
  it('names no size for the Lands’ End A-line skirt in 8 at 170 cm / 62 kg', () => {
    const garment = findGarment('landsend-a-line-skirt')!;
    const body = estimateBody({ heightCm: 170, weightKg: 62, bodyType: 'womens' });
    const line = verdictLine(sampleFit(body, garment, preferenceSpec(null, null)), '8', garment);
    expect(line.headline).toBe('Could go either way: 8 or 10');
    expect(headlineSize(line, '8')).toBeNull();
  });
});

describe('fittingHeadline', () => {
  // Chart order S, M, L; M is the suggested size unless a test says otherwise.
  const suggestM = (m: Partial<Record<Verdict, number>>, l: Partial<Record<Verdict, number>> = { roomier: 0.9, fits: 0.1 }) => ({
    ...oddsOf(sizeOdds('S', { 'too-tight': 0.9, fits: 0.1 }), sizeOdds('M', m), sizeOdds('L', l)),
    recommended: 'M',
  });

  it('says "M fits you" when M very likely or probably fits', () => {
    const veryLikely = suggestM({ fits: 0.8, roomier: 0.2 });
    expect(fittingHeadline(veryLikely, 'M', top)).toEqual({
      headline: 'M fits you',
      line: 'Very likely fits how you like',
      tone: 'good',
    });
    expect(fittingHeadline(suggestM({ fits: 0.6, roomier: 0.4 }), 'M', top).headline).toBe('M fits you');
  });

  it('judges the headline on the suggested size, naming the size shown when it is another', () => {
    const odds = suggestM({ fits: 0.8, roomier: 0.2 });
    expect(fittingHeadline(odds, 'L', top)).toEqual({
      headline: 'M fits you',
      line: `Showing L: ${verdictLine(odds, 'L', top).headline}`,
      tone: verdictLine(odds, 'L', top).tone,
    });
  });

  it('says "Your best bet" when the suggested size only might fit', () => {
    const odds = suggestM({ fits: 0.45, roomier: 0.3, snugger: 0.25 });
    expect(verdictLine(odds, 'M', top).headline).toBe('Might fit how you like');
    expect(fittingHeadline(odds, 'M', top)).toEqual({ headline: 'Your best bet: M', line: 'Might fit how you like', tone: 'good' });
    // Still judged on M when a likely-fitting size is selected instead.
    expect(fittingHeadline(odds, 'S', top).headline).toBe('Your best bet: M');
  });

  it('says "Your best bet" on a close call, even when the suggested size probably fits', () => {
    const odds = suggestM({ fits: 0.55, snugger: 0.45 }, { fits: 0.45, roomier: 0.55 });
    expect(verdictLine(odds, 'M', top).closeCall).toBe(true);
    expect(fittingHeadline(odds, 'M', top)).toEqual({
      headline: 'Your best bet: M',
      line: 'Could go either way: M or L',
      tone: 'warn',
    });
  });

  it('says "Your best bet" when the suggested size likely won’t fit', () => {
    const odds = suggestM({ 'too-tight': 0.7, fits: 0.3 });
    expect(fittingHeadline(odds, 'M', top)).toEqual({
      headline: 'Your best bet: M',
      line: verdictLine(odds, 'M', top).headline,
      tone: 'bad',
    });
  });

  it('falls back to the size line when no size could be picked', () => {
    const odds = { ...suggestM({ fits: 0.8, roomier: 0.2 }), recommended: null };
    expect(fittingHeadline(odds, 'S', top)).toEqual({
      headline: 'Size S · we couldn’t pick one for you',
      line: verdictLine(odds, 'S', top).headline,
      tone: verdictLine(odds, 'S', top).tone,
    });
  });
});

describe('isJustRight (the ちょうど stamp)', () => {
  const suggestM = (m: Partial<Record<Verdict, number>>, l: Partial<Record<Verdict, number>> = { roomier: 0.9, fits: 0.1 }) => ({
    ...oddsOf(sizeOdds('S', { 'too-tight': 0.9, fits: 0.1 }), sizeOdds('M', m), sizeOdds('L', l)),
    recommended: 'M',
  });

  it('is true only for the suggested size when the headline says it fits', () => {
    const odds = suggestM({ fits: 0.8, roomier: 0.2 });
    expect(fittingHeadline(odds, 'M', top).headline).toBe('M fits you');
    expect(isJustRight(odds, 'M', top)).toBe(true);
    // Another size shown under "M fits you": no stamp.
    expect(isJustRight(odds, 'L', top)).toBe(false);
  });

  it('is false whenever the headline is "Your best bet" or the fallback', () => {
    const might = suggestM({ fits: 0.45, roomier: 0.3, snugger: 0.25 });
    const close = suggestM({ fits: 0.55, snugger: 0.45 }, { fits: 0.45, roomier: 0.55 });
    const wontFit = suggestM({ 'too-tight': 0.7, fits: 0.3 });
    for (const odds of [might, close, wontFit]) {
      expect(fittingHeadline(odds, 'M', top).headline).toBe('Your best bet: M');
      expect(isJustRight(odds, 'M', top)).toBe(false);
    }
    const none = { ...suggestM({ fits: 0.8, roomier: 0.2 }), recommended: null };
    expect(isJustRight(none, 'M', top)).toBe(false);
  });
});
