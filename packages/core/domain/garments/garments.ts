/**
 * Turning seed rows into app-ready garments, and checking the seed is sane.
 */

import seed from './seed.json';
import { chartDefinition, defaultStretch, girthMethodOf, stretchOverrides } from './chart';
import { gradeGarment } from './grade';
import { inToCm } from '../units';
import { GIRTH_KEYS, normalizeSize } from './normalize';
import type { Garment, GarmentCategory, GirthKey, SeedGarment } from './types';
import { checkGarment } from './verify';

/**
 * A seed row ready for the app: cm, full circumferences, provenance and grade.
 * A row with errors grades as "unscored" (GARMENTS leaves those out anyway).
 */
export function normalizeGarment(seedGarment: SeedGarment): Garment {
  const { chart, sizes, ...rest } = seedGarment;
  // A per-girth method: the girths this garment lists whose method the chart doesn't give.
  const girthUnknown: GirthKey[] | undefined =
    typeof chart.girth === 'string'
      ? undefined
      : GIRTH_KEYS.filter((k) => girthMethodOf(chart, k) === 'unknown' && sizes.some((s) => s.measurements[k] !== undefined));
  const garment: Garment = {
    ...rest,
    // Same key position as the seed's; a per-measurement stretch keeps its default here.
    stretch: defaultStretch(rest.stretch),
    girthVerified: girthUnknown ? girthUnknown.length === 0 : chart.girth !== 'unknown',
    sizes: sizes.map((s) => normalizeSize(s, chart)),
    grade: gradeGarment(seedGarment, checkGarment(seedGarment)) ?? 'unscored',
  };
  const length = chartDefinition(chart, 'length');
  const sleeve = chartDefinition(chart, 'sleeve');
  if (length !== undefined) garment.lengthDefinition = length;
  if (sleeve !== undefined) garment.sleeveDefinition = sleeve;
  const { length: _l, sleeve: _s, ...others } = chart.definitions ?? {};
  if (Object.keys(others).length > 0) garment.definitions = others;
  if (chart.hipsBelowWaist !== undefined) {
    garment.hipsBelowWaistCm = chart.unit === 'in' ? inToCm(chart.hipsBelowWaist) : chart.hipsBelowWaist;
  }
  if (girthUnknown) garment.girthUnknown = girthUnknown;
  const overrides = stretchOverrides(rest.stretch);
  if (overrides) garment.stretchByKey = overrides;
  return garment;
}

/**
 * Problems that block garments from the catalogue (empty = OK), each prefixed
 * with the garment id. Warnings that only need review come from checkGarment.
 */
export function validateSeed(garments: SeedGarment[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const g of garments) {
    if (ids.has(g.id)) problems.push(`garment "${g.id}": duplicate id`);
    ids.add(g.id);
    problems.push(...checkGarment(g).errors.map((e) => `garment "${g.id}": ${e.message}`));
  }
  return problems;
}

const seedGarments = seed.garments as unknown as SeedGarment[];

/**
 * Every garment in the catalogue, normalized. A garment with errors is left out
 * (npm run data:check says why); one with only warnings stays in.
 */
export const GARMENTS: readonly Garment[] = seedGarments
  .filter((g) => checkGarment(g).errors.length === 0)
  .map(normalizeGarment);

/** The raw seed rows, as written in seed.json (for checks and tests). */
export const SEED_GARMENTS: readonly SeedGarment[] = seedGarments;
export const seedGarmentsForTesting = seedGarments;

export const garmentsByCategory = (category: GarmentCategory): Garment[] =>
  GARMENTS.filter((g) => g.category === category);

export const findGarment = (id: string): Garment | undefined =>
  GARMENTS.find((g) => g.id === id);
