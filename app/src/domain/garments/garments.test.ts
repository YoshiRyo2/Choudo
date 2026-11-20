import { describe, expect, it } from 'vitest';
import {
  GARMENTS,
  findGarment,
  garmentsByCategory,
  normalizeGarment,
  SEED_GARMENTS,
  seedGarmentsForTesting,
  validateSeed,
} from './garments';
import type { SeedGarment } from './types';
import { checkGarment } from './verify';
import { UNKNOWN_CHEST_TEE } from './testFixtures';

const base: SeedGarment = {
  id: 'test-tee',
  brand: 'Test',
  name: 'Tee',
  category: 'top',
  type: 'tee',
  sizing: 'mens',
  color: '#000000',
  sleeve: 'short',
  stretch: 'none',
  fitIntent: 'regular',
  chart: { unit: 'in', girth: 'flat', lengthDefinition: 'hps' },
  source: { placeholder: true },
  sizes: [{ label: 'M', measurements: { chest: 19, length: 28 } }],
};

describe('seed.json', () => {
  it('passes validation', () => {
    expect(validateSeed(seedGarmentsForTesting)).toEqual([]);
  });

  it('has about six tops and six bottoms from 2+ brands', () => {
    expect(garmentsByCategory('top').length).toBeGreaterThanOrEqual(6);
    expect(garmentsByCategory('bottom').length).toBeGreaterThanOrEqual(6);
    expect(new Set(GARMENTS.map((g) => g.brand)).size).toBeGreaterThanOrEqual(2);
  });

  it('keeps the real Knightweave row identical to data/tees.csv (M: 20 in flat chest)', () => {
    const kw = findGarment('knightweave-tee');
    const m = kw?.sizes.find((s) => s.label === 'M');
    expect(kw?.source.placeholder).toBe(false);
    expect(m?.measurements.chest).toBeCloseTo(40 * 2.54); // 20 flat -> 40 in -> 101.6 cm
    expect(m?.measurements.length).toBeCloseTo(29 * 2.54);
  });

  it('records where each Knightweave number came from', () => {
    const m = findGarment('knightweave-tee')?.sizes.find((s) => s.label === 'M');
    expect(m?.provenance.chest).toMatchObject({ origin: 'chart', printed: 20, unit: 'in' });
    expect(m?.provenance.chest?.conversions).toHaveLength(2);
  });

  it('cites a tier and date for every real row', () => {
    for (const g of GARMENTS.filter((g) => !g.source.placeholder)) {
      expect(g.source.tier, g.id).toBeDefined();
      expect(g.source.capturedOn, g.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('reads the Lands’ End chest as a full circumference (M: 44 in, not doubled)', () => {
    const le = findGarment('landsend-super-t')!;
    expect(le.girthVerified).toBe(true);
    expect(le.sizes.find((s) => s.label === 'M')?.measurements.chest).toBeCloseTo(111.76);
  });
});

describe('normalizeGarment', () => {
  it('doubles flat girths and converts inches to cm', () => {
    const g = normalizeGarment(base);
    expect(g.sizes[0]?.measurements.chest).toBeCloseTo(96.52); // 19 flat = 38 in
    expect(g.sizes[0]?.measurements.length).toBeCloseTo(71.12);
    expect(g.girthVerified).toBe(true);
    expect(UNKNOWN_CHEST_TEE.girthVerified).toBe(false); // chart didn't say flat or full
  });

  it('passes circumference cm values through', () => {
    const g = normalizeGarment({
      ...base,
      chart: { unit: 'cm', girth: 'circumference', lengthDefinition: 'hps' },
      sizes: [{ label: 'M', measurements: { chest: 100, length: 70 } }],
    });
    expect(g.sizes[0]?.measurements).toEqual({ chest: 100, length: 70 });
  });

  it('does not double an unknown-method girth and marks it unverified', () => {
    const g = normalizeGarment({ ...base, chart: { unit: 'in', girth: 'unknown', lengthDefinition: 'hps' } });
    expect(g.sizes[0]?.measurements.chest).toBeCloseTo(19 * 2.54);
    expect(g.girthVerified).toBe(false);
  });
});

describe('validateSeed', () => {
  it('flags missing required measurements', () => {
    const bad = { ...base, sizes: [{ label: 'M', measurements: { chest: 19 } }] };
    expect(validateSeed([bad])).toEqual(['garment "test-tee": size M: missing length']);
  });

  it('flags real data without a source url', () => {
    const bad = { ...base, source: { placeholder: false } };
    expect(validateSeed([bad])).toContain(
      'garment "test-tee": real (non-placeholder) data must cite a source url',
    );
  });

  it('flags duplicate ids and size labels', () => {
    const dupSizes = { ...base, sizes: [...base.sizes, ...base.sizes] };
    const problems = validateSeed([dupSizes, base]);
    expect(problems).toContain('garment "test-tee": size M: duplicate size label');
    expect(problems).toContain('garment "test-tee": duplicate id');
  });

  it('flags real data without a tier or date', () => {
    const problems = validateSeed([{ ...base, source: { placeholder: false, url: 'https://example.com' } }]);
    expect(problems).toContain('garment "test-tee": real (non-placeholder) data needs a source tier, A to G');
    expect(problems).toContain('garment "test-tee": real (non-placeholder) data needs capturedOn');
  });

  it('accepts a user-measured garment (tier E) without a url', () => {
    expect(validateSeed([{ ...base, source: { placeholder: false, tier: 'E', capturedOn: '2026-11-18' } }])).toEqual([]);
  });

  it('rejects a tier on placeholder data, a bad date and a snapshot outside chart-snapshots/', () => {
    const problems = validateSeed([
      { ...base, source: { placeholder: true, tier: 'B', capturedOn: '18/11/2026', snapshot: '/tmp/chart.pdf' } },
    ]).join('\n');
    expect(problems).toMatch(/placeholder data has no source tier/);
    expect(problems).toMatch(/capturedOn must be YYYY-MM-DD/);
    expect(problems).toMatch(/snapshot must be/);
  });

  it('needs a length definition on tops and none on bottoms', () => {
    const { lengthDefinition: _l, ...noLength } = base.chart;
    expect(validateSeed([{ ...base, chart: noLength }])).toEqual([
      'garment "test-tee": tops need chart.lengthDefinition (hps, center_back, unknown)',
    ]);
    const bottom: SeedGarment = {
      ...base,
      category: 'bottom',
      type: 'chinos',
      sleeve: undefined,
      sizes: [{ label: '32', measurements: { waist: 82, inseam: 81 } }],
      chart: { unit: 'cm', girth: 'circumference', lengthDefinition: 'hps' },
    };
    expect(validateSeed([bottom])).toEqual([
      'garment "test-tee": bottoms have no top length: leave out chart.lengthDefinition',
    ]);
  });

  it('accepts an origin object and checks it', () => {
    const ok = { ...base, sizes: [{ label: 'M', measurements: { chest: { value: 19, origin: 'audited' as const }, length: 28 } }] };
    expect(validateSeed([ok])).toEqual([]);
    const bad = {
      ...base,
      sizes: [{ label: 'M', measurements: { chest: { value: 19, origin: 'estimated' as const }, length: { value: 0, origin: 'guess' } } }],
    } as unknown as SeedGarment;
    expect(validateSeed([bad])).toEqual([
      'garment "test-tee": size M: chest is estimated: say how in "how"',
      'garment "test-tee": size M: length must be a positive number',
      'garment "test-tee": size M: length origin must be one of chart, estimated, audited',
    ]);
  });

  it('checks the audit record', () => {
    const problems = validateSeed([
      {
        ...base,
        audit: { measuredSize: 'XL', measuredOn: '2026-11-18', afterWash: true, unit: 'in', measurements: { chest: -2 } },
      },
    ]).join('\n');
    expect(problems).toMatch(/audit measuredSize "XL"/);
    expect(problems).toMatch(/audit chest must be a positive number/);
  });

  it('flags non-positive numbers', () => {
    const bad = { ...base, sizes: [{ label: 'M', measurements: { chest: -1, length: 28 } }] };
    expect(validateSeed([bad])).toContain('garment "test-tee": size M: chest must be a positive number');
  });
});

describe('garment photos', () => {
  const photo = {
    file: 'garments/test-front.png',
    photographedSize: 'M',
    landmarks: {
      collarLeft: { x: 380, y: 60 },
      collarRight: { x: 620, y: 60 },
      neckFront: { x: 500, y: 120 },
      shoulderLeft: { x: 230, y: 110 },
      shoulderRight: { x: 770, y: 110 },
      armpitLeft: { x: 260, y: 360 },
      armpitRight: { x: 740, y: 360 },
      hemLeft: { x: 265, y: 980 },
      hemRight: { x: 735, y: 980 },
      sleeveOuterLeft: { x: 120, y: 420 },
      sleeveInnerLeft: { x: 220, y: 470 },
      sleeveOuterRight: { x: 880, y: 420 },
      sleeveInnerRight: { x: 780, y: 470 },
    },
  };

  it('accepts a complete photo entry', () => {
    expect(validateSeed([{ ...base, image: photo }])).toEqual([]);
  });

  it('is optional', () => {
    expect(validateSeed([base])).toEqual([]);
  });

  it('allows an unknown photographed size', () => {
    expect(validateSeed([{ ...base, image: { ...photo, photographedSize: null } }])).toEqual([]);
  });

  it('rejects remote files, unknown sizes and missing landmarks', () => {
    const { hemRight: _dropped, ...partial } = photo.landmarks;
    const problems = validateSeed([
      {
        ...base,
        image: {
          file: 'https://example.com/tee.png',
          photographedSize: 'XXL',
          landmarks: partial as typeof photo.landmarks,
        },
      },
    ]);
    expect(problems.join('\n')).toMatch(/file must be/);
    expect(problems.join('\n')).toMatch(/photographedSize "XXL"/);
    expect(problems.join('\n')).toMatch(/hemRight/);
  });

  it('rejects landmarks that are swapped or out of order', () => {
    const swapped = {
      ...photo.landmarks,
      collarLeft: photo.landmarks.collarRight,
      collarRight: photo.landmarks.collarLeft,
      hemLeft: { x: 265, y: 100 },
      neckFront: { x: 500, y: 40 },
      sleeveOuterRight: { x: 700, y: 420 },
    };
    const problems = validateSeed([{ ...base, image: { ...photo, landmarks: swapped } }]).join('\n');
    expect(problems).toMatch(/collarLeft must be left of collarRight/);
    expect(problems).toMatch(/left side must run/);
    expect(problems).toMatch(/right sleeve opening/);
    expect(problems).toMatch(/neckFront must sit between/);
  });
});

describe('seed bottoms', () => {
  it('have no errors under the pants checks', () => {
    for (const g of SEED_GARMENTS.filter((s) => s.category === 'bottom')) expect(checkGarment(g).errors).toEqual([]);
  });

  it('give both Corvo jeans a thigh, knee, leg opening and front rise', () => {
    for (const id of ['corvo-slim-jean', 'corvo-relaxed-jean']) {
      const g = SEED_GARMENTS.find((s) => s.id === id)!;
      expect(g.chart.definitions).toEqual({ rise: 'front', thigh: 'below_crotch_2_5cm' });
      for (const s of g.sizes) expect(Object.keys(s.measurements)).toEqual(expect.arrayContaining(['thigh', 'knee', 'legOpening', 'rise']));
    }
  });
});

describe('a pants photo', () => {
  const jeanSeed = SEED_GARMENTS.find((s) => s.id === 'corvo-slim-jean')!;
  const landmarks = {
    waistLeft: { x: 250, y: 100 },
    waistMid: { x: 450, y: 110 },
    waistRight: { x: 650, y: 100 },
    hipLeft: { x: 220, y: 300 },
    hipRight: { x: 680, y: 300 },
    crotch: { x: 450, y: 420 },
    kneeOuterLeft: { x: 250, y: 850 },
    kneeInnerLeft: { x: 420, y: 850 },
    kneeOuterRight: { x: 650, y: 850 },
    kneeInnerRight: { x: 480, y: 850 },
    hemOuterLeft: { x: 260, y: 1320 },
    hemInnerLeft: { x: 410, y: 1320 },
    hemOuterRight: { x: 640, y: 1320 },
    hemInnerRight: { x: 490, y: 1320 },
  };
  const image = { file: 'garments/test-jeans.png', photographedSize: null, landmarks };

  it('validateImage accepts a pants photo with all 14 landmarks in order', () => {
    expect(validateSeed([{ ...jeanSeed, image }])).toEqual([]);
  });

  it('rejects a hem whose outer corner is inside its inner one, and a missing knee', () => {
    const swapped = { ...landmarks, hemOuterRight: { x: 480, y: 1320 }, hemInnerRight: { x: 640, y: 1320 } };
    expect(validateSeed([{ ...jeanSeed, image: { ...image, landmarks: swapped } }]).join('\n')).toMatch(/right hem/);
    const { kneeOuterLeft: _gone, ...partial } = landmarks;
    expect(validateSeed([{ ...jeanSeed, image: { ...image, landmarks: partial } }]).join('\n')).toMatch(/kneeOuterLeft/);
  });

  it('rejects a crotch above the hips or a knee below the hem', () => {
    const high = { ...landmarks, crotch: { x: 450, y: 200 } };
    expect(validateSeed([{ ...jeanSeed, image: { ...image, landmarks: high } }]).join('\n')).toMatch(/crotch/);
    const low = { ...landmarks, kneeInnerLeft: { x: 420, y: 1350 } };
    expect(validateSeed([{ ...jeanSeed, image: { ...image, landmarks: low } }]).join('\n')).toMatch(/left leg/);
  });

  it('pants landmarks on a top are a problem', () => {
    expect(validateSeed([{ ...base, image }]).join('\n')).toMatch(/collarLeft/);
  });
});
