/**
 * Turning seed rows into app-ready garments, and checking the seed is sane.
 */

import seed from './seed.json';
import { normalizeSize } from './normalize';
import {
  MEASUREMENT_ORIGINS,
  SOURCE_TIERS,
  TOP_LANDMARKS,
  type FitIntent,
  type Garment,
  type GarmentCategory,
  type GarmentImage,
  type LengthDefinition,
  type MeasuredValue,
  type SeedGarment,
  type SizeMeasurements,
} from './types';

export function normalizeGarment(seedGarment: SeedGarment): Garment {
  const { chart, sizes, ...rest } = seedGarment;
  const garment: Garment = {
    ...rest,
    girthVerified: chart.girth !== 'unknown',
    sizes: sizes.map((s) => normalizeSize(s, chart)),
  };
  if (chart.lengthDefinition !== undefined) garment.lengthDefinition = chart.lengthDefinition;
  if (chart.sleeveDefinition !== undefined) garment.sleeveDefinition = chart.sleeveDefinition;
  return garment;
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
    problems.push(...validateProvenance(g).map((p) => `${where}: ${p}`));
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
      for (const [key, raw] of Object.entries(size.measurements)) {
        problems.push(...validateValue(raw).map((p) => `${at}: ${key} ${p}`));
      }
    }
  }
  return problems;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SNAPSHOT_FILE = /^chart-snapshots\/[\w.-]+\.(pdf|png|jpe?g|webp|html?)$/i;
const FIT_INTENTS: readonly FitIntent[] = ['slim', 'regular', 'relaxed', 'oversized'];
const LENGTH_DEFINITIONS: readonly LengthDefinition[] = ['hps', 'center_back', 'unknown'];

/** Problems with where a garment's numbers came from (empty = OK). */
export function validateProvenance(g: SeedGarment): string[] {
  const problems: string[] = [];
  const { source, chart, audit } = g;
  if (!FIT_INTENTS.includes(g.fitIntent)) problems.push(`fitIntent must be one of ${FIT_INTENTS.join(', ')}`);

  if (source.placeholder) {
    if (source.tier !== undefined) problems.push('placeholder data has no source tier');
  } else {
    if (source.tier === undefined || !SOURCE_TIERS.includes(source.tier)) {
      problems.push('real (non-placeholder) data needs a source tier, A to G');
    }
    // A user-measured garment (E) has no page to cite; every other tier does.
    if (source.tier !== 'E' && !source.url) problems.push('real (non-placeholder) data must cite a source url');
    if (!source.capturedOn) problems.push('real (non-placeholder) data needs capturedOn');
  }
  if (source.capturedOn !== undefined && !ISO_DATE.test(source.capturedOn)) {
    problems.push(`capturedOn must be YYYY-MM-DD, got "${source.capturedOn}"`);
  }
  if (source.snapshot !== undefined && !SNAPSHOT_FILE.test(source.snapshot)) {
    problems.push(`snapshot must be a pdf/image/html file under chart-snapshots/, got "${source.snapshot}"`);
  }

  if (g.category === 'top') {
    if (chart.lengthDefinition === undefined || !LENGTH_DEFINITIONS.includes(chart.lengthDefinition)) {
      problems.push(`tops need chart.lengthDefinition (${LENGTH_DEFINITIONS.join(', ')})`);
    }
  } else if (chart.lengthDefinition !== undefined) {
    problems.push('bottoms have no top length: leave out chart.lengthDefinition');
  }

  if (audit !== undefined) {
    if (!g.sizes.some((s) => s.label === audit.measuredSize)) {
      problems.push(`audit measuredSize "${audit.measuredSize}" is not one of the garment's sizes`);
    }
    if (!ISO_DATE.test(audit.measuredOn)) problems.push(`audit measuredOn must be YYYY-MM-DD, got "${audit.measuredOn}"`);
    if (typeof audit.afterWash !== 'boolean') problems.push('audit afterWash must be true or false');
    if (audit.unit !== 'cm' && audit.unit !== 'in') problems.push('audit unit must be cm or in');
    const entries = Object.entries(audit.measurements);
    if (entries.length === 0) problems.push('audit has no measurements');
    for (const [key, v] of entries) {
      if (typeof v !== 'number' || !(v > 0)) problems.push(`audit ${key} must be a positive number`);
    }
  }
  return problems;
}

/** Problems with one seed value: a positive number, or `{ value, origin, how? }`. */
export function validateValue(raw: unknown): string[] {
  if (typeof raw === 'number') return raw > 0 ? [] : ['must be a positive number'];
  if (typeof raw !== 'object' || raw === null) return ['must be a positive number'];
  const { value, origin, how } = raw as Partial<MeasuredValue>;
  const problems: string[] = [];
  if (typeof value !== 'number' || !(value > 0)) problems.push('must be a positive number');
  if (origin === undefined || !MEASUREMENT_ORIGINS.includes(origin)) {
    problems.push(`origin must be one of ${MEASUREMENT_ORIGINS.join(', ')}`);
  }
  if (origin === 'estimated' && !how) problems.push('is estimated: say how in "how"');
  if (how !== undefined && typeof how !== 'string') problems.push('"how" must be text');
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
  const n = l.neckFront;
  if (!(n.x > l.collarLeft.x && n.x < l.collarRight.x && n.y > Math.max(l.collarLeft.y, l.collarRight.y))) {
    problems.push('neckFront must sit between the collar points and below them');
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

const seedGarments = seed.garments as unknown as SeedGarment[];

/** Every garment in the catalogue, normalized. */
export const GARMENTS: readonly Garment[] = seedGarments.map(normalizeGarment);

export const seedGarmentsForTesting = seedGarments;

export const garmentsByCategory = (category: GarmentCategory): Garment[] =>
  GARMENTS.filter((g) => g.category === category);

export const findGarment = (id: string): Garment | undefined =>
  GARMENTS.find((g) => g.id === id);
