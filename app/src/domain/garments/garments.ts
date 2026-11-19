/**
 * Turning seed rows into app-ready garments, and checking the seed is sane.
 */

import seed from './seed.json';
import { gradeGarment } from './grade';
import { normalizeSize } from './normalize';
import type { Garment, GarmentCategory, SeedGarment } from './types';
import { checkGarment } from './verify';

/**
 * A seed row ready for the app: cm, full circumferences, provenance and grade.
 * A row with errors grades as "unscored" (GARMENTS leaves those out anyway).
 */
export function normalizeGarment(seedGarment: SeedGarment): Garment {
  const { chart, sizes, ...rest } = seedGarment;
  const garment: Garment = {
    ...rest,
    girthVerified: chart.girth !== 'unknown',
    sizes: sizes.map((s) => normalizeSize(s, chart)),
    grade: gradeGarment(seedGarment, checkGarment(seedGarment)) ?? 'unscored',
  };
  if (chart.lengthDefinition !== undefined) garment.lengthDefinition = chart.lengthDefinition;
  if (chart.sleeveDefinition !== undefined) garment.sleeveDefinition = chart.sleeveDefinition;
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

export const seedGarmentsForTesting = seedGarments;

export const garmentsByCategory = (category: GarmentCategory): Garment[] =>
  GARMENTS.filter((g) => g.category === category);

export const findGarment = (id: string): Garment | undefined =>
  GARMENTS.find((g) => g.id === id);
