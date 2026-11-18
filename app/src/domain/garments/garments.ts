/**
 * Turning seed rows into app-ready garments, and checking the seed is sane.
 */

import { inToCm } from '../units';
import seed from './seed.json';
import type { Garment, GarmentCategory, SeedGarment, SizeMeasurements } from './types';

const GIRTH_KEYS = ['chest', 'waist', 'hips'] as const;
const LENGTH_KEYS = ['length', 'sleeve', 'shoulder', 'inseam', 'rise'] as const;

/** Convert one size's numbers to cm, with girths as full circumferences. */
export function normalizeMeasurements(
  raw: SizeMeasurements,
  chart: SeedGarment['chart'],
): SizeMeasurements {
  const toCm = (v: number) => (chart.unit === 'in' ? inToCm(v) : v);
  const out: SizeMeasurements = {};
  for (const key of GIRTH_KEYS) {
    const v = raw[key];
    if (v === undefined) continue;
    // Flat measurements are half the circumference (same rule as src/fit.py).
    // For "unknown" we keep the printed value but mark the garment unverified.
    out[key] = toCm(chart.girth === 'flat' ? v * 2 : v);
  }
  for (const key of LENGTH_KEYS) {
    const v = raw[key];
    if (v !== undefined) out[key] = toCm(v);
  }
  return out;
}

export function normalizeGarment(seedGarment: SeedGarment): Garment {
  const { chart, ...rest } = seedGarment;
  return {
    ...rest,
    girthVerified: chart.girth !== 'unknown',
    sleeveDefinition: chart.sleeveDefinition,
    sizes: seedGarment.sizes.map((s) => ({
      label: s.label,
      measurements: normalizeMeasurements(s.measurements, chart),
    })),
  };
}

/** Required measurements per category — without these we can't say anything useful. */
const REQUIRED: Record<GarmentCategory, (keyof SizeMeasurements)[]> = {
  top: ['chest', 'length'],
  bottom: ['waist', 'inseam'],
};

/** Returns a list of human-readable problems with the seed (empty = OK). */
export function validateSeed(garments: SeedGarment[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();

  for (const g of garments) {
    const where = `garment "${g.id}"`;
    if (ids.has(g.id)) problems.push(`${where}: duplicate id`);
    ids.add(g.id);

    if (!g.brand || !g.name) problems.push(`${where}: missing brand or name`);
    if (!/^#[0-9a-f]{6}$/i.test(g.color)) problems.push(`${where}: color must be #rrggbb`);
    if (g.category === 'top' && !g.sleeve) problems.push(`${where}: tops need a sleeve type`);
    if (g.category === 'bottom' && g.sleeve) problems.push(`${where}: bottoms can't have a sleeve`);
    if (!g.source.placeholder && !g.source.url) {
      problems.push(`${where}: real (non-placeholder) data must cite a source url`);
    }
    if (g.sizes.length === 0) problems.push(`${where}: no sizes`);

    const labels = new Set<string>();
    for (const size of g.sizes) {
      const at = `${where} size ${size.label}`;
      if (labels.has(size.label)) problems.push(`${at}: duplicate size label`);
      labels.add(size.label);

      for (const key of REQUIRED[g.category]) {
        if (size.measurements[key] === undefined) problems.push(`${at}: missing ${key}`);
      }
      for (const [key, value] of Object.entries(size.measurements)) {
        if (typeof value !== 'number' || !(value > 0)) {
          problems.push(`${at}: ${key} must be a positive number`);
        }
      }
    }
  }
  return problems;
}

const seedGarments = seed.garments as SeedGarment[];

/** Every garment in the catalogue, normalized. */
export const GARMENTS: readonly Garment[] = seedGarments.map(normalizeGarment);

export const seedGarmentsForTesting = seedGarments;

export const garmentsByCategory = (category: GarmentCategory): Garment[] =>
  GARMENTS.filter((g) => g.category === category);

export const findGarment = (id: string): Garment | undefined =>
  GARMENTS.find((g) => g.id === id);
