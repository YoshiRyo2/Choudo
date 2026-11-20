/**
 * Golden test: everything the fit pipeline says about every seed garment, on a
 * handful of bodies and preferences, written to a file and compared byte for byte.
 *
 * It guards refactors that must not change behaviour (the category registry,
 * PR 1a). If a change is *meant* to move results, regenerate it on purpose with
 * `npx vitest run src/domain/fit/golden.test.ts -u` and review the JSON diff.
 */

import { describe, expect, it } from 'vitest';
import { estimateBody, type BodyInput } from '../body';
import { checkGarment, GARMENTS, normalizeGarment } from '../garments';
import { SEED_GARMENTS } from '../garments/garments';
import { UNKNOWN_CHEST_SEED, UNKNOWN_CHEST_TEE } from '../garments/testFixtures';
import { fitAllSizes } from './fitEngine';
import { personalFit, preferenceSpec, resolvePreference, type PreferenceSpec } from './preference';
import { measurementHint, sampleFit } from './sampleFit';

const BODIES: Record<string, BodyInput> = {
  'mens-176-85-estimated': { heightCm: 176, weightKg: 85, bodyType: 'mens' },
  'mens-190-80-measured': {
    heightCm: 190,
    weightKg: 80,
    bodyType: 'mens',
    overrides: { chestCm: 98, waistCm: 82, inseamCm: 88 },
  },
  'mens-165-60-estimated': { heightCm: 165, weightKg: 60, bodyType: 'mens' },
  'womens-163-68-estimated': { heightCm: 163, weightKg: 68, bodyType: 'womens' },
  'womens-170-75-bra-34DD': {
    heightCm: 170,
    weightKg: 75,
    bodyType: 'womens',
    overrides: { braSize: { band: 34, cup: 'DD', system: 'us' } },
  },
  'womens-158-90-measured': {
    heightCm: 158,
    weightKg: 90,
    bodyType: 'womens',
    overrides: { waistCm: 98, hipsCm: 118 },
  },
};

const PREFERENCES: Record<string, () => PreferenceSpec> = {
  default: () => preferenceSpec(null, null),
  slim: () => preferenceSpec(null, 'slim'),
  'anchor-gildan-M': () => preferenceSpec({ kind: 'catalogue', garmentId: 'gildan-5000', size: 'M' }, null),
  'anchor-measured': () => preferenceSpec({ kind: 'measured', chestFlatCm: 54, lengthCm: 72 }, 'relaxed'),
};

const GOLDEN_GARMENTS = [...GARMENTS, UNKNOWN_CHEST_TEE];

/** Compact JSON with ±Infinity kept (fit bands end in them). */
const json = (v: unknown) =>
  JSON.stringify(v, (_k, x) => (x === Infinity ? 'Infinity' : x === -Infinity ? '-Infinity' : x));
/** One line per item, so a diff points at the garment that moved. */
const lines = (items: unknown[]) => `${items.map(json).join('\n')}\n`;

describe('golden: garment data', () => {
  it('normalizes and checks every seed garment exactly as before', async () => {
    const rows = [...SEED_GARMENTS, UNKNOWN_CHEST_SEED].map((seed) => ({
      id: seed.id,
      check: checkGarment(seed),
      garment: checkGarment(seed).errors.length === 0 ? normalizeGarment(seed) : null,
    }));
    await expect(lines(rows)).toMatchFileSnapshot('./__golden__/garments.json');
  });
});

describe('golden: fit, personal fit, odds and hints', () => {
  for (const [bodyName, input] of Object.entries(BODIES)) {
    it(`gives the same results for ${bodyName}`, { timeout: 60_000 }, async () => {
      const body = estimateBody(input);
      const rows = [
        { body },
        ...GOLDEN_GARMENTS.map((garment) => {
          const fits = fitAllSizes(body, garment);
          return {
            id: garment.id,
            fits,
            preferences: Object.fromEntries(
              Object.entries(PREFERENCES).map(([prefName, make]) => {
                const spec = make();
                const pref = resolvePreference(spec, body.measurements);
                const odds = sampleFit(body, garment, spec);
                return [
                  prefName,
                  {
                    personal: fits.map((f) => personalFit(f, garment, pref)),
                    odds,
                    hint: prefName === 'default' ? measurementHint(body, garment, spec, { current: odds.recommended }) : undefined,
                  },
                ];
              }),
            ),
          };
        }),
      ];
      await expect(lines(rows)).toMatchFileSnapshot(`./__golden__/fit-${bodyName}.json`);
    });
  }
});
