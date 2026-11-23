/**
 * How the user likes tops to fit, and how a size compares with that.
 *
 * Zone labels (tight / fitted / relaxed / loose, short / good / long) stay
 * objective — see fitEngine.ts. This file adds the personal layer on top: a
 * preferred chest ease (and, with an anchor tee, a preferred length), and a
 * verdict per size such as "a bit snugger than you like".
 *
 * Pure functions only. Thresholds are in rules.ts, spreads in uncertainty.ts.
 */

import type { BodyMeasurements } from '../body';
import { findGarment, type FitIntent, type Garment } from '../garments';
import type { GarmentFit, ZoneFit, ZoneId } from './fitEngine';
import { templateZones } from './zones';
import {
  ANCHOR_CHEST_BAND_CM,
  ANCHOR_LENGTH_BAND_CM,
  INTENT_EASE,
  LOOSE_INTENTS,
  MUCH_ROOMIER_CM,
} from './rules';
import { GARMENT_SD_CM, MEASURED_ANCHOR_SD_CM } from './uncertainty';

/** The answer to "How do you like tees to fit?". Same words as a garment's fitIntent. */
export type FitStyle = FitIntent;
export const FIT_STYLES: readonly FitStyle[] = ['slim', 'regular', 'relaxed', 'oversized'];

/**
 * A tee the user already owns and likes the fit of. Stored as entered, so the
 * preference is worked out again whenever the body changes.
 */
export type Anchor =
  | { kind: 'catalogue'; garmentId: string; size: string }
  /** Laid flat: chest straight across, armpit to armpit; length from the high point of the shoulder. */
  | { kind: 'measured'; chestFlatCm: number; lengthCm: number };

/** Plausible "Measure it" numbers, cm. Outside these it's a typo or the wrong unit. */
export const ANCHOR_LIMITS = {
  chestFlatCm: { min: 35, max: 85 },
  lengthCm: { min: 50, max: 95 },
} as const;

/** The anchor's own numbers, cm (chest full circumference), and how far to trust them. */
export interface AnchorNumbers {
  chestCm: number;
  /** null when the chart doesn't measure length from the high point of the shoulder. */
  lengthCm: number | null;
  /** How the anchor tee is cut. A measured tee is assumed regular. */
  intent: FitIntent;
  /** 1 SD on the anchor's numbers (chart tolerance, or a tape on a tee). */
  sdCm: { girth: number; length: number };
  /** The catalogue garment, so sampling can reuse that chart's draw. null when measured. */
  garmentId: string | null;
}

export interface PreferenceSpec {
  /** anchor: from a tee they own · style: they answered the question · default: neither (Regular). */
  source: 'anchor' | 'style' | 'default';
  /** The stated style, or "regular" when there isn't one. Ignored when source is anchor. */
  style: FitStyle;
  anchor: AnchorNumbers | null;
}

/** A preference worked out against one body. Chest ease is for a regular-cut tee. */
export interface ResolvedPreference {
  chestEaseCm: number;
  chestBandCm: number;
  /** Preferred top length − body torso length. null = no preference (use the objective label). */
  lengthDiffCm: number | null;
  lengthBandCm: number;
}

/** Extra noise the sampler adds; all zero for a plain point estimate. */
export interface PreferenceNoise {
  anchorChestCm?: number;
  anchorLengthCm?: number;
  chestEaseCm?: number;
  lengthDiffCm?: number;
}

/** Catalogue garments that can serve as an anchor: real tops whose chest (and grade) we can trust. */
export function canAnchor(g: Garment): boolean {
  const personal = templateZones(g).personal;
  return (
    // A garment whose template carries a personal fit (a top): its chest is what we learn from.
    // Only tee-cut tops: the question is "a tee you like", and a knit's chest carries the knit offset.
    personal !== null &&
    (personal.easeOffsetCm ?? 0) === 0 &&
    !g.source.placeholder &&
    g.girthVerified &&
    g.grade !== 'unscored' &&
    g.sizes.some((s) => s.measurements.chest !== undefined)
  );
}

export function validateMeasuredAnchor(a: { chestFlatCm: number; lengthCm: number }): string[] {
  const errors: string[] = [];
  for (const key of ['chestFlatCm', 'lengthCm'] as const) {
    const { min, max } = ANCHOR_LIMITS[key];
    const v = a[key];
    if (!Number.isFinite(v) || v < min || v > max) errors.push(key);
  }
  return errors;
}

/** The anchor's numbers, or null if it no longer points at a usable garment and size. */
export function anchorNumbers(
  anchor: Anchor,
  find: (id: string) => Garment | undefined = findGarment,
): AnchorNumbers | null {
  if (anchor.kind === 'measured') {
    if (validateMeasuredAnchor(anchor).length > 0) return null;
    return {
      chestCm: anchor.chestFlatCm * 2,
      lengthCm: anchor.lengthCm,
      intent: 'regular',
      sdCm: MEASURED_ANCHOR_SD_CM,
      garmentId: null,
    };
  }
  const g = find(anchor.garmentId);
  if (!g || !canAnchor(g)) return null;
  const size = g.sizes.find((s) => s.label === anchor.size);
  const chestCm = size?.measurements.chest;
  if (!size || chestCm === undefined) return null;
  const length = size.measurements.length;
  return {
    chestCm,
    lengthCm: g.lengthDefinition === 'hps' && length !== undefined ? length : null,
    intent: g.fitIntent,
    sdCm: GARMENT_SD_CM[g.grade === 'unscored' ? 'charted' : g.grade],
    garmentId: g.id,
  };
}

/** Anchor beats stated style beats the Regular default. A stale anchor is ignored. */
export function preferenceSpec(
  anchor: Anchor | null,
  style: FitStyle | null,
  find: (id: string) => Garment | undefined = findGarment,
): PreferenceSpec {
  const numbers = anchor ? anchorNumbers(anchor, find) : null;
  if (numbers) return { source: 'anchor', style: style ?? 'regular', anchor: numbers };
  if (style) return { source: 'style', style, anchor: null };
  return { source: 'default', style: 'regular', anchor: null };
}

/**
 * The preference against this body. An anchor's ease is turned into its
 * regular-cut equivalent: liking an oversized tee at +20 cm means liking a
 * regular one at +20 − (18 − 5) = +7.
 */
export function resolvePreference(
  spec: PreferenceSpec,
  body: Pick<BodyMeasurements, 'chestCm' | 'torsoLengthCm'>,
  noise: PreferenceNoise = {},
): ResolvedPreference {
  const n = (v: number | undefined) => v ?? 0;
  if (spec.anchor) {
    const a = spec.anchor;
    const cutOffset = INTENT_EASE[a.intent].easeCm - INTENT_EASE.regular.easeCm;
    return {
      chestEaseCm: a.chestCm + n(noise.anchorChestCm) - body.chestCm - cutOffset + n(noise.chestEaseCm),
      chestBandCm: ANCHOR_CHEST_BAND_CM,
      lengthDiffCm:
        a.lengthCm === null
          ? null
          : a.lengthCm + n(noise.anchorLengthCm) - body.torsoLengthCm + n(noise.lengthDiffCm),
      lengthBandCm: ANCHOR_LENGTH_BAND_CM,
    };
  }
  const style = INTENT_EASE[spec.style];
  return {
    chestEaseCm: style.easeCm + n(noise.chestEaseCm),
    chestBandCm: style.bandCm,
    lengthDiffCm: null,
    lengthBandCm: ANCHOR_LENGTH_BAND_CM,
  };
}

export interface ChestTarget {
  easeCm: number;
  bandCm: number;
  /** True when the garment's own (looser) design sets the target, not the user. */
  asDesigned: boolean;
}

/**
 * The chest ease to aim for in a garment cut a given way. Relaxed and oversized
 * designs are meant to be roomy: when their ease is above the user's, we aim for
 * the design ("Oversized, as designed") rather than sizing down to undo it.
 * Slim and regular cuts are sized to the user's preference.
 */
export function chestTarget(pref: ResolvedPreference, intent: FitIntent, offsetCm = 0): ChestTarget {
  const design = INTENT_EASE[intent];
  // A template cut roomier than a tee (knits) moves both targets out by the same offset.
  if (LOOSE_INTENTS.includes(intent) && design.easeCm > pref.chestEaseCm) {
    return { easeCm: design.easeCm + offsetCm, bandCm: design.bandCm, asDesigned: true };
  }
  return { easeCm: pref.chestEaseCm + offsetCm, bandCm: pref.chestBandCm, asDesigned: false };
}

/** chestTarget for a garment: its own cut, and its template's offset from a tee. */
export function garmentChestTarget(pref: ResolvedPreference, garment: Pick<Garment, 'type' | 'fitIntent'>): ChestTarget {
  return chestTarget(pref, garment.fitIntent, templateZones(garment).personal?.easeOffsetCm ?? 0);
}

/** One zone against the preference: under (snug / short), right, or over (roomy / long). */
export type PersonalResult = 'under' | 'right' | 'over' | 'unknown';

/** A size's overall personal verdict. */
export type Verdict =
  | 'too-tight'
  | 'snugger'
  | 'fits'
  | 'as-designed'
  | 'roomier'
  | 'much-roomier'
  | 'shorter'
  | 'longer'
  | 'unknown';

export const VERDICTS: readonly Verdict[] = [
  'too-tight',
  'snugger',
  'fits',
  'as-designed',
  'roomier',
  'much-roomier',
  'shorter',
  'longer',
  'unknown',
];

/** The verdicts that count as "fits how you like". */
export const LIKED_VERDICTS: readonly Verdict[] = ['fits', 'as-designed'];

export interface PersonalFit {
  verdict: Verdict;
  zones: Partial<Record<ZoneId, PersonalResult>>;
  /** Chest ease − target (tops), cm. null when the chest can't be scored or it's a bottom. */
  chestMissCm: number | null;
  target: ChestTarget | null;
}

function objective(z: ZoneFit): PersonalResult {
  switch (z.label) {
    case 'tight':
    case 'short':
      return 'under';
    case 'loose':
    case 'long':
      return 'over';
    case 'unknown':
      return 'unknown';
    default:
      return 'right';
  }
}

function within(missCm: number, bandCm: number): PersonalResult {
  if (missCm < -bandCm) return 'under';
  if (missCm > bandCm) return 'over';
  return 'right';
}

/**
 * How one size compares with what the user likes. Tops: chest against the
 * personal target, length against the anchor's (if any). Every other zone —
 * and every zone of a bottom — falls back to its objective label.
 */
export function personalFit(fit: GarmentFit, garment: Garment, pref: ResolvedPreference): PersonalFit {
  const personal = templateZones(garment).personal;
  const target = personal ? garmentChestTarget(pref, garment) : null;
  const zones: PersonalFit['zones'] = {};
  let chestMissCm: number | null = null;

  for (const z of fit.zones) {
    if (z.label === 'unknown' || z.diffCm === null) {
      zones[z.zone] = 'unknown';
    } else if (personal && z.zone === personal.girth && target) {
      chestMissCm = z.diffCm - target.easeCm;
      zones[z.zone] = z.label === 'tight' ? 'under' : within(chestMissCm, target.bandCm);
    } else if (personal && z.zone === personal.length && pref.lengthDiffCm !== null) {
      zones[z.zone] = within(z.diffCm - pref.lengthDiffCm, pref.lengthBandCm);
    } else {
      zones[z.zone] = objective(z);
    }
  }

  return { verdict: combine(fit, zones, chestMissCm, target, personal?.girth ?? null), zones, chestMissCm, target };
}

function combine(
  fit: GarmentFit,
  zones: PersonalFit['zones'],
  chestMissCm: number | null,
  target: ChestTarget | null,
  personalGirth: ZoneId | null,
): Verdict {
  // Optional zones we couldn't score are left out, as in overallTone.
  const scoredOrNeeded = (z: GarmentFit['zones'][number]) => !(z.optional && z.label === 'unknown');
  const girths = fit.zones.filter((z) => z.kind === 'girth' && scoredOrNeeded(z));
  const lengths = fit.zones.filter((z) => z.kind === 'length' && scoredOrNeeded(z));
  const blocked = fit.zones.filter((z) => z.kind === 'landing' && z.tone === 'bad');
  // Same rule as overallTone: without every girth we can't say a size fits.
  if (girths.some((z) => z.label === 'unknown')) return 'unknown';
  if (girths.some((z) => z.label === 'tight') || blocked.some((z) => z.label === 'tight')) return 'too-tight';
  if (blocked.some((z) => z.label === 'short')) return 'shorter';
  for (const z of girths) {
    const r = zones[z.zone];
    if (r === 'under') return 'snugger';
    if (r === 'over') {
      return z.zone === personalGirth && chestMissCm !== null && chestMissCm > MUCH_ROOMIER_CM ? 'much-roomier' : 'roomier';
    }
  }
  for (const z of lengths) {
    const r = zones[z.zone];
    if (r === 'under') return 'shorter';
    if (r === 'over') return 'longer';
  }
  return target?.asDesigned ? 'as-designed' : 'fits';
}
