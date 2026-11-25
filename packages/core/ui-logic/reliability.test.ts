import { describe, expect, it } from 'vitest';
import { estimateBody } from '../domain/body';
import { fitAllSizes, type GarmentFit, type ZoneFit } from '../domain/fit';
import { findGarment, type Garment } from '../domain/garments';
import { reliability } from './reliability';
import { reliabilityAction, reliabilityText } from './fitText';

const zone = (z: Pick<ZoneFit, 'zone' | 'kind'> & Partial<ZoneFit>): ZoneFit => ({
  label: 'fitted',
  tone: 'good',
  diffCm: 6,
  garmentCm: 100,
  bodyCm: 94,
  bodySource: 'estimated',
  bands: [],
  ...z,
});
const fitOf = (zones: ZoneFit[]): GarmentFit => ({ garmentId: 'g', sizeLabel: 'M', bodyType: 'mens', zones, overall: 'good' });
const real = { placeholder: false };
const tee = (grade: Garment['grade']) => ({ grade, type: 'tee', source: real }) as const;
const jeans = (grade: Garment['grade']) => ({ grade, type: 'jeans', source: real }) as const;
const noRef = { hasFitReference: false };

describe('reliability', () => {
  const estimatedTee = fitOf([zone({ zone: 'chest', kind: 'girth' }), zone({ zone: 'length', kind: 'length' })]);
  const enteredTee = fitOf([zone({ zone: 'chest', kind: 'girth', bodySource: 'entered' }), zone({ zone: 'length', kind: 'length' })]);

  it('is rough when a number this size needs is estimated, not when the grade alone says so', () => {
    const estimatedChest = fitOf([
      zone({ zone: 'chest', kind: 'girth', bodySource: 'entered', garmentOrigin: 'estimated' }),
      zone({ zone: 'length', kind: 'length' }),
    ]);
    expect(reliability(estimatedChest, tee('charted'), noRef)).toEqual({ level: 'rough', reason: 'estimated-sizes' });
    // An estimated number in an optional zone (a hem band) doesn't count.
    const estimatedHemBand = fitOf([
      ...enteredTee.zones,
      zone({ zone: 'hemBand', kind: 'girth', garmentOrigin: 'estimated', optional: true }),
    ]);
    expect(reliability(estimatedHemBand, tee('estimated'), noRef)).toEqual({ level: 'fair', reason: 'estimated-extras' });
    expect(reliability(estimatedTee, tee('estimated'), noRef)).toEqual({ level: 'fair', reason: 'estimated-body', zone: 'chest' });
  });

  it('is rough for a placeholder garment, whatever its zones say', () => {
    expect(reliability(enteredTee, { ...tee('charted'), source: { placeholder: true } }, noRef)).toEqual({ level: 'rough', reason: 'estimated-sizes' });
  });

  it('is rough when the chart can’t be scored', () => {
    expect(reliability(enteredTee, tee('unscored'), noRef)).toEqual({ level: 'rough', reason: 'incomplete-chart' });
  });

  it('is rough when half or more of the needed zones can’t be checked; optional ones don’t count', () => {
    const half = fitOf([
      zone({ zone: 'waist', kind: 'girth', bodySource: 'entered' }),
      zone({ zone: 'hips', kind: 'girth', label: 'unknown', diffCm: null }),
      zone({ zone: 'inseam', kind: 'length', label: 'unknown', diffCm: null }),
      zone({ zone: 'rise', kind: 'landing' }),
      zone({ zone: 'thigh', kind: 'girth', label: 'unknown', diffCm: null, optional: true }),
    ]);
    expect(reliability(half, jeans('charted'), noRef)).toEqual({ level: 'rough', reason: 'incomplete-chart' });
    // One of four needed zones unknown is not rough.
    const one = fitOf(half.zones.map((z) => (z.zone === 'inseam' ? { ...z, label: 'good', diffCm: 1 } : z)));
    expect(reliability(one, jeans('charted'), noRef).level).not.toBe('rough');
  });

  it('is good with a real chart and every girth typed in (lengths may be estimated)', () => {
    expect(reliability(enteredTee, tee('charted'), noRef)).toEqual({ level: 'good', reason: 'own-measurements' });
    expect(reliability(enteredTee, tee('verified'), noRef)).toEqual({ level: 'good', reason: 'own-measurements' });
  });

  it('is good with a real chart and a tee you know fits, which pins down a top’s chest', () => {
    expect(reliability(estimatedTee, tee('charted'), { hasFitReference: true })).toEqual({ level: 'good', reason: 'fit-reference' });
    expect(reliability(enteredTee, tee('charted'), { hasFitReference: true })).toEqual({ level: 'good', reason: 'own-measurements' });
  });

  it('is fair with a real chart and a body estimated from height and weight, naming the first estimated girth', () => {
    expect(reliability(estimatedTee, tee('charted'), noRef)).toEqual({ level: 'fair', reason: 'estimated-body', zone: 'chest' });
    const waistOnly = fitOf([zone({ zone: 'chest', kind: 'girth', bodySource: 'entered' }), zone({ zone: 'waist', kind: 'girth' })]);
    expect(reliability(waistOnly, tee('charted'), noRef)).toEqual({ level: 'fair', reason: 'estimated-body', zone: 'waist' });
  });

  it('doesn’t let a tee reference vouch for a bottom’s waist', () => {
    const bottom = fitOf([zone({ zone: 'waist', kind: 'girth' }), zone({ zone: 'inseam', kind: 'length' })]);
    expect(reliability(bottom, jeans('charted'), { hasFitReference: true })).toEqual({ level: 'fair', reason: 'estimated-body', zone: 'waist' });
  });

  it('is fair, never good, when a girth the size needs can’t be checked', () => {
    const noHips = fitOf([
      zone({ zone: 'waist', kind: 'girth', bodySource: 'entered' }),
      zone({ zone: 'hips', kind: 'girth', label: 'unknown', diffCm: null, bodySource: 'entered' }),
      zone({ zone: 'inseam', kind: 'landing' }),
    ]);
    expect(reliability(noHips, { grade: 'charted', type: 'leggings', source: real }, noRef)).toEqual({ level: 'fair', reason: 'unchecked-girth', zone: 'hips' });
  });

  it('reads the real catalogue: Gildan 5000 is fair on an estimated chest and good on a measured one', () => {
    const g = findGarment('gildan-5000')!;
    const estimated = fitAllSizes(estimateBody({ heightCm: 176, weightKg: 80, bodyType: 'mens' }), g)[2]!;
    const measured = fitAllSizes(estimateBody({ heightCm: 176, weightKg: 80, bodyType: 'mens', overrides: { chestCm: 100 } }), g)[2]!;
    expect(reliability(estimated, g, noRef)).toEqual({ level: 'fair', reason: 'estimated-body', zone: 'chest' });
    expect(reliability(measured, g, noRef)).toEqual({ level: 'good', reason: 'own-measurements' });
    // A sample row is rough: its numbers are invented.
    const sample = findGarment('fieldline-boxy-tee')!;
    expect(reliability(fitAllSizes(estimateBody({ heightCm: 176, weightKg: 80, bodyType: 'mens' }), sample)[0]!, sample, noRef).level).toBe('rough');
  });
});

describe('reliability of the real hoodies (only the optional hem band estimated)', () => {
  const hoodie = findGarment('gildan-18500')!;
  it('reads Gildan 18500 as fair or good, never rough', () => {
    expect(hoodie.grade).toBe('estimated');
    const bodies = [
      { heightCm: 176, weightKg: 80, bodyType: 'mens' },
      { heightCm: 176, weightKg: 80, bodyType: 'mens', overrides: { chestCm: 104 } },
      { heightCm: 165, weightKg: 62, bodyType: 'womens' },
    ] as const;
    for (const body of bodies) {
      for (const fit of fitAllSizes(estimateBody(body), hoodie)) {
        // The hem band is the only estimated number, and it is optional.
        const estimated = fit.zones.filter((z) => z.garmentOrigin === 'estimated');
        expect(estimated.map((z) => [z.zone, z.optional])).toEqual(estimated.length ? [['hemBand', true]] : []);
        const r = reliability(fit, hoodie, noRef);
        expect(['fair', 'good'], `${fit.sizeLabel}: ${r.reason}`).toContain(r.level);
      }
    }
    const m = fitAllSizes(estimateBody(bodies[0]), hoodie).find((f) => f.sizeLabel === 'M')!;
    expect(reliability(m, hoodie, noRef)).toEqual({ level: 'fair', reason: 'estimated-body', zone: 'chest' });
    const measured = fitAllSizes(estimateBody(bodies[1]), hoodie).find((f) => f.sizeLabel === 'L')!;
    expect(reliability(measured, hoodie, noRef)).toEqual({ level: 'fair', reason: 'estimated-extras' });
  });
});

describe('reliabilityText', () => {
  it('words each level and cause', () => {
    expect(reliabilityText({ level: 'good', reason: 'own-measurements' })).toBe('Good confidence: real size chart and your own measurements.');
    expect(reliabilityText({ level: 'good', reason: 'fit-reference' })).toBe('Good confidence: real size chart and a tee you know fits.');
    expect(reliabilityText({ level: 'fair', reason: 'estimated-body', zone: 'chest' })).toBe(
      'Fair confidence: your chest is estimated from height and weight.',
    );
    expect(reliabilityText({ level: 'fair', reason: 'estimated-extras' })).toBe('Fair confidence: a few of this garment’s numbers are estimated.');
    expect(reliabilityText({ level: 'fair', reason: 'unchecked-girth', zone: 'hips' })).toBe('Fair confidence: this chart doesn’t let us check the hips.');
    expect(reliabilityText({ level: 'rough', reason: 'incomplete-chart' })).toBe('Rough guess: this brand’s chart is incomplete.');
    expect(reliabilityText({ level: 'rough', reason: 'estimated-sizes' })).toBe('Rough guess: this garment’s sizes are estimated.');
  });

  it('calls the chest the bust for a women’s body, says where a bust came from, and gets the plural right', () => {
    const chest = { level: 'fair', reason: 'estimated-body', zone: 'chest' } as const;
    expect(reliabilityText(chest, 'womens')).toBe('Fair confidence: your bust is estimated from height and weight.');
    expect(reliabilityText(chest, 'womens', { bustFromBra: true })).toBe('Fair confidence: your bust is estimated from your bra size.');
    expect(reliabilityText({ ...chest, zone: 'hips' }, 'womens')).toBe('Fair confidence: your hips are estimated from height and weight.');
  });

  it('offers to add a measurement only when an estimated body number is the cause', () => {
    expect(reliabilityAction({ level: 'fair', reason: 'estimated-body', zone: 'chest' })).toBe('Add your measurement');
    expect(reliabilityAction({ level: 'fair', reason: 'unchecked-girth', zone: 'hips' })).toBeNull();
    expect(reliabilityAction({ level: 'good', reason: 'own-measurements' })).toBeNull();
    expect(reliabilityAction({ level: 'rough', reason: 'estimated-sizes' })).toBeNull();
  });

  it('never shows a percentage', () => {
    const all = [
      reliabilityText({ level: 'good', reason: 'own-measurements' }),
      reliabilityText({ level: 'fair', reason: 'estimated-body', zone: 'waist' }),
      reliabilityText({ level: 'rough', reason: 'incomplete-chart' }),
    ];
    expect(all.join(' ')).not.toMatch(/%/);
  });
});
