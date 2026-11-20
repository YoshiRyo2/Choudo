import { describe, expect, it } from 'vitest';
import { estimateBody } from '../body';
import { normalizeGarment, type SeedGarment } from '../garments';
import { fitGarment, labelGirth, landingMark, overallTone, type ZoneFit } from './fitEngine';
import { BOTTOM_HIPS, girthRuleInCm, STRETCH_ALLOWANCE, stretchAllowance, type GirthRule, type LandingRule } from './rules';

/** A leggings-like rule: meant to sit 8 % under the body. Illustration only. */
const UNDER_BODY: GirthRule = { kind: 'girth', scale: 'fraction', tightBelow: -0.18, fittedMax: -0.02, relaxedMax: 0.02, ideal: -0.08 };

describe('girth rules as a fraction of the body', () => {
  it('leaves cm rules exactly as they are', () => {
    expect(girthRuleInCm(BOTTOM_HIPS, 100)).toBe(BOTTOM_HIPS);
  });

  it('turns fraction bounds into cm for one body', () => {
    const r = girthRuleInCm(UNDER_BODY, 100);
    expect(r.scale).toBe('cm');
    expect(r.tightBelow).toBeCloseTo(-18);
    expect(r.fittedMax).toBeCloseTo(-2);
    expect(r.relaxedMax).toBeCloseTo(2);
    expect(r.ideal).toBeCloseTo(-8);
  });

  it('labels negative ease as fitted when the rule wants it', () => {
    const r = girthRuleInCm(UNDER_BODY, 100);
    expect(labelGirth(-8, r)).toBe('fitted');
    expect(labelGirth(-20, r)).toBe('tight');
    expect(labelGirth(1, r)).toBe('relaxed');
    expect(labelGirth(5, r)).toBe('loose');
  });
});

describe('stretch allowance', () => {
  it('uses the shared table unless the rule has its own', () => {
    expect(stretchAllowance(BOTTOM_HIPS, 'high')).toBe(STRETCH_ALLOWANCE.high);
    expect(stretchAllowance({ ...UNDER_BODY, stretch: { compression: 0.1 } }, 'compression')).toBe(0.1);
    expect(stretchAllowance({ ...UNDER_BODY, stretch: { compression: 0.1 } }, 'some')).toBe(STRETCH_ALLOWANCE.some);
  });

  it('moves "tight" only on the measurement that stretches', () => {
    const seed: SeedGarment = {
      id: 'test-jogger',
      brand: 'Test',
      name: 'Jogger',
      category: 'bottom',
      type: 'joggers',
      sizing: 'unisex',
      color: '#222222',
      stretch: { default: 'none', waist: 'high' },
      fitIntent: 'regular',
      chart: { unit: 'cm', girth: 'circumference' },
      source: { placeholder: false, tier: 'B', url: 'https://example.com', capturedOn: '2026-11-20' },
      sizes: [{ label: 'M', measurements: { waist: 70, hips: 98, inseam: 80 } }],
    };
    const body = estimateBody({ heightCm: 176, weightKg: 75, bodyType: 'mens' });
    const zones = fitGarment(body, normalizeGarment(seed), 'M').zones;
    const tightEdge = (zone: string) => zones.find((z) => z.zone === zone)!.bands[0]!.to;
    expect(tightEdge('waist')).toBeCloseTo(-2 - STRETCH_ALLOWANCE.high * body.measurements.waistCm);
    expect(tightEdge('hips')).toBe(BOTTOM_HIPS.tightBelow);
  });
});

describe('girth method per measurement in the engine', () => {
  it('scores the girths the chart explains and leaves the other unknown', () => {
    const seed: SeedGarment = {
      id: 'test-chino',
      brand: 'Test',
      name: 'Chino',
      category: 'bottom',
      type: 'chinos',
      sizing: 'mens',
      color: '#222222',
      stretch: 'none',
      fitIntent: 'regular',
      chart: { unit: 'cm', girth: { default: 'circumference', hips: 'unknown' } },
      source: { placeholder: false, tier: 'B', url: 'https://example.com', capturedOn: '2026-11-20' },
      sizes: [{ label: '32', measurements: { waist: 84, hips: 104, inseam: 81 } }],
    };
    const body = estimateBody({ heightCm: 176, weightKg: 80, bodyType: 'mens' });
    const fit = fitGarment(body, normalizeGarment(seed), '32');
    expect(fit.zones.map((z) => [z.zone, z.label === 'unknown'])).toEqual([
      ['waist', false],
      ['hips', true],
      ['inseam', false],
    ]);
    expect(fit.overall).not.toBe('good'); // never good with a girth unchecked
  });
});

describe('landing zones', () => {
  const HEM: LandingRule = {
    kind: 'landing',
    marks: [
      { label: 'above knee', atCm: -Infinity },
      { label: 'knee', atCm: -3 },
      { label: 'below knee', atCm: 3 },
    ],
  };

  it('finds the mark an edge lands at', () => {
    expect(landingMark(-10, HEM)).toBe('above knee');
    expect(landingMark(-3, HEM)).toBe('knee');
    expect(landingMark(0, HEM)).toBe('knee');
    expect(landingMark(8, HEM)).toBe('below knee');
  });

  it('never moves the overall result', () => {
    const zone = (kind: ZoneFit['kind'], tone: ZoneFit['tone'], label: ZoneFit['label']): ZoneFit => ({
      zone: 'length',
      kind,
      label,
      tone,
      diffCm: 0,
      garmentCm: 0,
      bodyCm: 0,
      bodySource: 'estimated',
      bands: [],
    });
    expect(overallTone([zone('girth', 'good', 'fitted'), zone('landing', 'good', 'noted')])).toBe('good');
    expect(overallTone([zone('girth', 'warn', 'loose'), zone('landing', 'good', 'noted')])).toBe('warn');
    expect(overallTone([zone('landing', 'good', 'noted')])).toBe('unknown');
  });
});
