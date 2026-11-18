/**
 * Turning seed rows into app-ready garments, and checking the seed is sane.
 */

import { inToCm } from '../units';
import seed from './seed.json';
import { TOP_LANDMARKS, type Garment, type GarmentCategory, type GarmentImage, type SeedGarment, type SizeMeasurements } from './types';

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
    if (g.image !== undefined) {
      problems.push(...validateImage(g.image, g).map((p) => `${where} image: ${p}`));
    }

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

/** Problems with a garment's photo entry (empty = OK). */
export function validateImage(image: GarmentImage, g: Pick<SeedGarment, 'category' | 'sizes'>): string[] {
  const problems: string[] = [];
  // Photos ship with the app; we never hot-link a retailer's image.
  if (!/^garments\/[\w.-]+\.(png|jpe?g|webp)$/i.test(image.file)) {
    problems.push(`file must be a png/jpg/webp under garments/, got "${image.file}"`);
  }
  if (image.photographedSize !== null && !g.sizes.some((s) => s.label === image.photographedSize)) {
    problems.push(`photographedSize "${image.photographedSize}" is not one of the garment's sizes`);
  }
  if (g.category !== 'top') problems.push('photo textures are only supported for tops');

  const lm = image.landmarks as Partial<GarmentImage['landmarks']> | undefined;
  const missing = TOP_LANDMARKS.filter((k) => {
    const p = lm?.[k];
    return !p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.y < 0;
  });
  if (missing.length > 0) {
    problems.push(`landmarks need non-negative pixel x/y for ${missing.join(', ')}`);
    return problems;
  }
  const l = image.landmarks;
  for (const part of ['collar', 'shoulder', 'armpit', 'hem', 'sleeveOuter', 'sleeveInner'] as const) {
    if (!(l[`${part}Left`].x < l[`${part}Right`].x)) problems.push(`${part}Left must be left of ${part}Right`);
  }
  for (const side of ['Left', 'Right'] as const) {
    const [c, s, a, h] = [l[`collar${side}`], l[`shoulder${side}`], l[`armpit${side}`], l[`hem${side}`]];
    if (!(c.y < a.y && s.y < a.y && a.y < h.y)) {
      problems.push(`${side.toLowerCase()} side must run collar/shoulder above armpit above hem`);
    }
    const [out, inn] = [l[`sleeveOuter${side}`], l[`sleeveInner${side}`]];
    const outward = side === 'Left' ? -1 : 1;
    if (!(out.y > s.y && (out.x - inn.x) * outward > 0)) {
      problems.push(`${side.toLowerCase()} sleeve opening must sit below the shoulder, outer corner outside the inner`);
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
