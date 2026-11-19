import { describe, expect, it } from 'vitest';
import { estimateBody, type BodyModel } from '../body';
import { findGarment, normalizeGarment, type FitIntent, type Garment, type SeedGarment } from '../garments';
import { fitGarment } from './fitEngine';
import {
  anchorNumbers,
  canAnchor,
  chestTarget,
  personalFit,
  preferenceSpec,
  resolvePreference,
  validateMeasuredAnchor,
  type ResolvedPreference,
} from './preference';
import { INTENT_EASE } from './rules';
import { GARMENT_SD_CM, MEASURED_ANCHOR_SD_CM } from './uncertainty';
import { UNKNOWN_CHEST_TEE } from '../garments/testFixtures';

function bodyWith(m: Partial<BodyModel['measurements']>): BodyModel {
  const model = estimateBody({ heightCm: 176, weightKg: 85, sizing: 'mens' });
  return { ...model, measurements: { ...model.measurements, ...m } };
}

/** A tee in cm, full circumference, one size per [label, chest, length]. */
function tee(intent: FitIntent, sizes: [string, number, number][], extra: Partial<SeedGarment> = {}): Garment {
  return normalizeGarment({
    id: `tee-${intent}`,
    brand: 'Test',
    name: 'Tee',
    category: 'top',
    type: 'tee',
    sizing: 'mens',
    color: '#000000',
    sleeve: 'short',
    stretch: 'none',
    fitIntent: intent,
    chart: { unit: 'cm', girth: 'circumference', lengthDefinition: 'hps' },
    source: { placeholder: false, tier: 'B', url: 'https://example.com', capturedOn: '2026-11-18' },
    sizes: sizes.map(([label, chest, length]) => ({ label, measurements: { chest, length } })),
    ...extra,
  });
}

const regular: ResolvedPreference = { chestEaseCm: 5, chestBandCm: 4, lengthDiffCm: null, lengthBandCm: 4 };

describe('anchors', () => {
  it('a measured tee doubles its flat chest and keeps its length', () => {
    expect(anchorNumbers({ kind: 'measured', chestFlatCm: 53, lengthCm: 74 })).toEqual({
      chestCm: 106,
      lengthCm: 74,
      intent: 'regular',
      sdCm: MEASURED_ANCHOR_SD_CM,
      garmentId: null,
    });
  });

  it('rejects measured numbers outside the plausible range', () => {
    expect(validateMeasuredAnchor({ chestFlatCm: 106, lengthCm: 74 })).toEqual(['chestFlatCm']);
    expect(validateMeasuredAnchor({ chestFlatCm: 53, lengthCm: 30 })).toEqual(['lengthCm']);
    expect(anchorNumbers({ kind: 'measured', chestFlatCm: 20, lengthCm: 74 })).toBeNull();
  });

  it('a catalogue anchor reads the size from the chart, with its grade’s tolerance', () => {
    const a = anchorNumbers({ kind: 'catalogue', garmentId: 'gildan-5000', size: 'M' })!;
    expect(a.chestCm).toBeCloseTo(101.6, 1); // 20 in flat
    expect(a.lengthCm).toBeCloseTo(73.66, 1); // 29 in
    expect(a.intent).toBe('regular');
    expect(a.sdCm).toEqual(GARMENT_SD_CM.charted);
    expect(a.garmentId).toBe('gildan-5000');
  });

  it('a stale catalogue anchor (gone garment or size) is null', () => {
    expect(anchorNumbers({ kind: 'catalogue', garmentId: 'nope', size: 'M' })).toBeNull();
    expect(anchorNumbers({ kind: 'catalogue', garmentId: 'gildan-5000', size: 'XS' })).toBeNull();
  });

  it('only real tops with a trusted chest can be anchors', () => {
    expect(canAnchor(findGarment('gildan-5000')!)).toBe(true);
    expect(canAnchor(UNKNOWN_CHEST_TEE)).toBe(false); // chest method unknown
    expect(canAnchor(findGarment('fieldline-boxy-tee')!)).toBe(false); // placeholder
    expect(canAnchor(findGarment('corvo-slim-jean')!)).toBe(false); // not a top
  });
});

describe('preferenceSpec', () => {
  it('anchor beats style beats default', () => {
    const anchor = { kind: 'measured', chestFlatCm: 53, lengthCm: 74 } as const;
    expect(preferenceSpec(anchor, 'slim').source).toBe('anchor');
    expect(preferenceSpec(null, 'slim')).toEqual({ source: 'style', style: 'slim', anchor: null });
    expect(preferenceSpec(null, null)).toEqual({ source: 'default', style: 'regular', anchor: null });
  });

  it('falls back to the style when the anchor is stale', () => {
    expect(preferenceSpec({ kind: 'catalogue', garmentId: 'nope', size: 'M' }, 'relaxed').source).toBe('style');
  });
});

describe('resolvePreference', () => {
  const body = { chestCm: 96, torsoLengthCm: 73 };

  it('a stated style uses its row of the intent table and has no length preference', () => {
    expect(resolvePreference(preferenceSpec(null, 'relaxed'), body)).toEqual({
      chestEaseCm: INTENT_EASE.relaxed.easeCm,
      chestBandCm: INTENT_EASE.relaxed.bandCm,
      lengthDiffCm: null,
      lengthBandCm: 4,
    });
  });

  it('a measured anchor gives its ease and length relative to the body', () => {
    const r = resolvePreference(preferenceSpec({ kind: 'measured', chestFlatCm: 53, lengthCm: 74 }, null), body);
    expect(r.chestEaseCm).toBeCloseTo(10); // 106 − 96
    expect(r.lengthDiffCm).toBeCloseTo(1); // 74 − 73
    expect(r.chestBandCm).toBe(4);
  });

  it('an oversized anchor is turned into its regular-cut equivalent', () => {
    const boxy = tee('oversized', [['M', 116, 70]], { id: 'boxy' });
    const spec = preferenceSpec({ kind: 'catalogue', garmentId: 'boxy', size: 'M' }, null, (id) =>
      id === 'boxy' ? boxy : undefined,
    );
    // +20 cm on an oversized cut = +20 − (18 − 5) = +7 on a regular one.
    expect(resolvePreference(spec, body).chestEaseCm).toBeCloseTo(7);
  });

  it('adds sampler noise where given', () => {
    const spec = preferenceSpec({ kind: 'measured', chestFlatCm: 53, lengthCm: 74 }, null);
    const r = resolvePreference(spec, body, { anchorChestCm: 2, chestEaseCm: -1, anchorLengthCm: 1, lengthDiffCm: 0.5 });
    expect(r.chestEaseCm).toBeCloseTo(11);
    expect(r.lengthDiffCm).toBeCloseTo(2.5);
  });
});

describe('chestTarget', () => {
  it('slim and regular cuts are sized to the user', () => {
    expect(chestTarget(regular, 'slim')).toEqual({ easeCm: 5, bandCm: 4, asDesigned: false });
    expect(chestTarget({ ...regular, chestEaseCm: 2.5 }, 'regular').easeCm).toBe(2.5);
  });

  it('a looser design wins over a snugger preference', () => {
    expect(chestTarget(regular, 'oversized')).toEqual({ easeCm: 18, bandCm: 8, asDesigned: true });
    expect(chestTarget(regular, 'relaxed')).toEqual({ easeCm: 8, bandCm: 5, asDesigned: true });
  });

  it('someone who likes it roomier than the design keeps their own target', () => {
    expect(chestTarget({ ...regular, chestEaseCm: 20, chestBandCm: 8 }, 'oversized')).toEqual({
      easeCm: 20,
      bandCm: 8,
      asDesigned: false,
    });
  });
});

describe('personalFit', () => {
  const body = bodyWith({ chestCm: 100, torsoLengthCm: 72 });
  const g = tee('regular', [
    ['S', 98, 70], // ease −2: fitted, but 7 under a +5 target
    ['M', 106, 73], // ease +6: fits
    ['L', 112, 76], // ease +12: roomier
    ['XL', 118, 79], // ease +18: much roomier
    ['XS', 90, 70], // ease −10: tight
  ]);
  const verdict = (size: string, pref = regular) => personalFit(fitGarment(body, g, size), g, pref);

  it('labels each size against the preference, not just the objective bands', () => {
    expect(verdict('XS').verdict).toBe('too-tight');
    expect(verdict('S').verdict).toBe('snugger');
    expect(verdict('M').verdict).toBe('fits');
    expect(verdict('L').verdict).toBe('roomier');
    expect(verdict('XL').verdict).toBe('much-roomier');
  });

  it('reports the chest miss and per-zone results', () => {
    const m = verdict('M');
    expect(m.chestMissCm).toBeCloseTo(1);
    expect(m.zones).toEqual({ chest: 'right', length: 'right' });
  });

  it('uses the anchor’s length when there is one', () => {
    const withLength = { ...regular, lengthDiffCm: 7 }; // likes tees 7 cm longer than the hip line
    expect(verdict('M', withLength).verdict).toBe('shorter'); // M is +1, 6 short of +7
    expect(verdict('M', { ...regular, lengthDiffCm: -5 }).verdict).toBe('longer');
  });

  it('an oversized tee at its design ease reads “as designed”, though its zone label is loose', () => {
    const boxy = tee('oversized', [['M', 125, 74]]); // +25 cm
    const fit = fitGarment(body, boxy, 'M');
    expect(fit.zones.find((z) => z.zone === 'chest')!.label).toBe('loose');
    expect(personalFit(fit, boxy, regular).verdict).toBe('as-designed');
  });

  it('is unknown when the chest method is unknown', () => {
    const unverified = tee('regular', [['M', 106, 73]], { chart: { unit: 'cm', girth: 'unknown', lengthDefinition: 'hps' } });
    const p = personalFit(fitGarment(body, unverified, 'M'), unverified, regular);
    expect(p.verdict).toBe('unknown');
    expect(p.chestMissCm).toBeNull();
  });

  it('bottoms use their objective labels', () => {
    const jean = findGarment('corvo-slim-jean')!;
    const b = estimateBody({ heightCm: 178, weightKg: 75, sizing: 'mens' });
    for (const s of jean.sizes) {
      const fit = fitGarment(b, jean, s.label);
      const p = personalFit(fit, jean, regular);
      expect(p.target).toBeNull();
      if (fit.zones.some((z) => z.label === 'tight')) expect(p.verdict).toBe('too-tight');
      if (fit.overall === 'good') expect(p.verdict).toBe('fits');
    }
  });
});
