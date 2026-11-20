/**
 * Structural checks on seed rows: required fields, well-formed values,
 * provenance and photo entries. Pure; no seed import.
 */

import { categorySpec, GARMENT_TYPES, isGarmentType } from './categories';
import { chartDefinition } from './chart';
import { GIRTH_KEYS, MEASUREMENT_KEYS } from './normalize';
import {
  DEFINITION_VALUES,
  GARMENT_SIZINGS,
  GIRTH_METHODS,
  MEASUREMENT_ORIGINS,
  SOURCE_TIERS,
  STRETCHES,
  type DefinitionName,
  type FitIntent,
  type GarmentImage,
  type LengthDefinition,
  type MeasuredValue,
  type SeedGarment,
} from './types';

/**
 * Structural problems with one seed garment (empty = OK): missing or malformed
 * fields. Each one blocks the garment. Messages don't name the garment.
 */
export function validateGarment(g: SeedGarment): string[] {
  const problems: string[] = [];
  // Everything below reads the type's template, so an unknown type stops here.
  if (!isGarmentType(g.type)) return [`type must be one of ${GARMENT_TYPES.join(', ')}`];
  const spec = categorySpec(g);
  if (g.category !== spec.category) problems.push(`a ${g.type} is a ${spec.category}, not a ${g.category}`);
  if (!g.brand || !g.name) problems.push('missing brand or name');
  if (!/^#[0-9a-f]{6}$/i.test(g.color)) problems.push('color must be #rrggbb');
  if (!GARMENT_SIZINGS.includes(g.sizing)) problems.push('sizing must be "mens", "womens" or "unisex"');
  if (spec.sleeve === 'required' && !g.sleeve) problems.push('tops need a sleeve type');
  if (spec.sleeve === 'forbidden' && g.sleeve) problems.push("bottoms can't have a sleeve");
  problems.push(...validateStretch(g.stretch));
  problems.push(...validateProvenance(g));
  if (g.sizes.length === 0) problems.push('no sizes');
  if (g.image !== undefined) {
    problems.push(...validateImage(g.image, g).map((p) => `image: ${p}`));
  }

  const labels = new Set<string>();
  for (const size of g.sizes) {
    const at = `size ${size.label}`;
    if (labels.has(size.label)) problems.push(`${at}: duplicate size label`);
    labels.add(size.label);

    for (const key of spec.checks.required) {
      if (size.measurements[key] === undefined) problems.push(`${at}: missing ${key}`);
    }
    for (const [key, raw] of Object.entries(size.measurements)) {
      problems.push(...validateValue(raw).map((p) => `${at}: ${key} ${p}`));
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

  problems.push(...validateChart(chart));
  const length = chartDefinition(chart, 'length');
  if (categorySpec(g).lengthDefinition === 'required') {
    if (length === undefined || !LENGTH_DEFINITIONS.includes(length)) {
      problems.push(`tops need chart.lengthDefinition (${LENGTH_DEFINITIONS.join(', ')})`);
    }
  } else if (length !== undefined) {
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

/** Problems with a garment's stretch: one level, or `{ default, <measurement>: level }`. */
export function validateStretch(stretch: unknown): string[] {
  const levels = STRETCHES.join(', ');
  if (typeof stretch === 'string') return STRETCHES.includes(stretch as never) ? [] : [`stretch must be one of ${levels}`];
  if (typeof stretch !== 'object' || stretch === null) return [`stretch must be one of ${levels}`];
  const problems: string[] = [];
  for (const [key, level] of Object.entries(stretch)) {
    if (key !== 'default' && !MEASUREMENT_KEYS.includes(key as never)) problems.push(`stretch: "${key}" isn't a measurement`);
    else if (!STRETCHES.includes(level as never)) problems.push(`stretch ${key} must be one of ${levels}`);
  }
  if (!('default' in stretch)) problems.push('a per-measurement stretch needs a "default"');
  return problems;
}

/** Problems with a chart's girth method and definitions. */
export function validateChart(chart: SeedGarment['chart']): string[] {
  const problems: string[] = [];
  const methods = GIRTH_METHODS.join(', ');
  const girth: unknown = chart.girth;
  if (typeof girth === 'string') {
    if (!GIRTH_METHODS.includes(girth as never)) problems.push(`chart.girth must be one of ${methods}`);
  } else if (typeof girth === 'object' && girth !== null) {
    for (const [key, method] of Object.entries(girth)) {
      if (key !== 'default' && !GIRTH_KEYS.includes(key as never)) problems.push(`chart.girth: "${key}" isn't a girth`);
      else if (!GIRTH_METHODS.includes(method as never)) problems.push(`chart.girth ${key} must be one of ${methods}`);
    }
    if (!('default' in girth)) problems.push('a per-girth chart.girth needs a "default"');
  } else {
    problems.push(`chart.girth must be one of ${methods}`);
  }

  for (const [name, value] of Object.entries(chart.definitions ?? {})) {
    const allowed = DEFINITION_VALUES[name as DefinitionName] as readonly string[] | undefined;
    if (!allowed) problems.push(`chart.definitions: "${name}" isn't a definition`);
    else if (!allowed.includes(value as string)) problems.push(`chart.definitions.${name} must be one of ${allowed.join(', ')}`);
  }
  // One place per definition, so the two can't disagree.
  if (chart.definitions?.length !== undefined && chart.lengthDefinition !== undefined) {
    problems.push('give length in chart.definitions or chart.lengthDefinition, not both');
  }
  if (chart.definitions?.sleeve !== undefined && chart.sleeveDefinition !== undefined) {
    problems.push('give sleeve in chart.definitions or chart.sleeveDefinition, not both');
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
export function validateImage(image: GarmentImage, g: Pick<SeedGarment, 'type' | 'sizes'>): string[] {
  const problems: string[] = [];
  // Photos ship with the app; we never hot-link a retailer's image.
  if (!/^garments\/[\w.-]+\.(png|jpe?g|webp)$/i.test(image.file)) {
    problems.push(`file must be a png/jpg/webp under garments/, got "${image.file}"`);
  }
  if (image.photographedSize !== null && !g.sizes.some((s) => s.label === image.photographedSize)) {
    problems.push(`photographedSize "${image.photographedSize}" is not one of the garment's sizes`);
  }
  const landmarks = categorySpec(g).landmarks;
  if (landmarks === null) {
    problems.push('photo textures are only supported for tops');
    return problems;
  }

  const lm = image.landmarks as Partial<GarmentImage['landmarks']> | undefined;
  const missing = landmarks.filter((k) => {
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

