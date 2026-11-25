/**
 * How far to trust one garment + size's answer, in one of three plain levels. Pure:
 * reads the fit (which body numbers were typed in, which zones could be checked)
 * and the garment's confidence grade. The wording is fitText's `reliabilityText`.
 */

import { templateZones, type GarmentFit, type ZoneFit, type ZoneId } from '../domain/fit';
import type { Garment } from '../domain/garments';

export type ReliabilityLevel = 'good' | 'fair' | 'rough';

/**
 * Why the level is what it is:
 * good  — `own-measurements` (every girth typed in) or `fit-reference` (a tee you know fits covers the chest);
 * fair  — `estimated-body` (a girth estimated from height and weight, `zone` names the first) or
 *         `unchecked-girth` (the chart can't check a girth the size needs, `zone` names it);
 * rough — `estimated-sizes` (the garment's own numbers are estimated) or `incomplete-chart`.
 */
export type ReliabilityReason =
  | 'own-measurements'
  | 'fit-reference'
  | 'estimated-body'
  | 'unchecked-girth'
  | 'estimated-sizes'
  | 'incomplete-chart';

export interface Reliability {
  level: ReliabilityLevel;
  reason: ReliabilityReason;
  /** The zone the reason is about (fair only). */
  zone?: ZoneId;
}

export interface ReliabilityOptions {
  /** The user has a fit reference: a tee they own and like (an anchor), not just a stated style. */
  hasFitReference: boolean;
}

/**
 * The rules, in one place. A first guess until the fit test says otherwise: tune these
 * against data/fit_tests.csv once there are enough results.
 * - rough when the garment's grade is in ROUGH_GRADES, or at least ROUGH_UNKNOWN_SHARE of
 *   the size's non-optional zones can't be checked;
 * - good when the grade is in GOOD_GRADES and every non-optional girth is checked against
 *   a body number the user typed in (or, for the girth a fit reference speaks to, one
 *   the anchor tee already pins down);
 * - fair otherwise (typically a real size chart with a body estimated from height and weight).
 */
export const RELIABILITY_RULES = {
  roughGrades: ['estimated', 'unscored'] as readonly Garment['grade'][],
  roughUnknownShare: 0.5,
  goodGrades: ['verified', 'charted'] as readonly Garment['grade'][],
} as const;

const required = (z: ZoneFit) => !z.optional;

/** How much to trust this size's answer, and why. */
export function reliability(
  fit: GarmentFit,
  garment: Pick<Garment, 'grade' | 'type'>,
  { hasFitReference }: ReliabilityOptions,
): Reliability {
  const zones = fit.zones.filter(required);

  if (RELIABILITY_RULES.roughGrades.includes(garment.grade)) {
    return { level: 'rough', reason: garment.grade === 'estimated' ? 'estimated-sizes' : 'incomplete-chart' };
  }
  const unknown = zones.filter((z) => z.label === 'unknown').length;
  if (zones.length > 0 && unknown / zones.length >= RELIABILITY_RULES.roughUnknownShare) {
    return { level: 'rough', reason: 'incomplete-chart' };
  }

  const girths = zones.filter((z) => z.kind === 'girth');
  // An anchor tee is compared with the same body draw, so it cancels the estimate of the girth it speaks to (a top's chest).
  const referenced = hasFitReference ? templateZones(garment).personal?.girth : undefined;
  const estimated = girths.find((z) => z.bodySource === 'estimated' && z.zone !== referenced);
  const unchecked = girths.find((z) => z.label === 'unknown');

  if (RELIABILITY_RULES.goodGrades.includes(garment.grade) && !estimated && !unchecked) {
    const leansOnReference = girths.some((z) => z.bodySource === 'estimated');
    return { level: 'good', reason: leansOnReference ? 'fit-reference' : 'own-measurements' };
  }
  if (estimated) return { level: 'fair', reason: 'estimated-body', zone: estimated.zone };
  if (unchecked) return { level: 'fair', reason: 'unchecked-girth', zone: unchecked.zone };
  // A grade outside both lists (none today) with nothing else against it.
  return { level: 'fair', reason: 'estimated-body' };
}
