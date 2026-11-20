/**
 * The fit engine: body + garment + size -> how each zone fits, in cm.
 *
 * Pure functions only. No React, no storage, no randomness. Which size to
 * suggest is decided from sampled odds — see sampleFit.ts.
 */

import type { BodyModel, BodyType, MeasurementSource } from '../body';
import {
  definitionOf,
  girthKnown,
  isGirthKey,
  stretchOf,
  type Garment,
  type GarmentSize,
  type MeasurementOrigin,
} from '../garments';
import {
  girthRuleInCm,
  LENGTH_FAR_MULTIPLIER,
  stretchAllowance,
  type GirthRule,
  type LandingRule,
  type LengthRule,
} from './rules';
import { ruleFor, zoneSpecsFor, type Rule, type ZoneId, type ZoneSpec } from './zones';

export type { ZoneId } from './zones';
export type GirthLabel = 'tight' | 'fitted' | 'relaxed' | 'loose';
export type LengthLabel = 'short' | 'good' | 'long';
/** A landing zone's only label: it says where something ends (see `landing`), never good or bad. */
export type LandingLabel = 'noted';
export type FitLabel = GirthLabel | LengthLabel | LandingLabel | 'unknown';

/** girth: garment − body · length: garment − target length · landing: where an edge ends, descriptive only. */
export type ZoneKind = 'girth' | 'length' | 'landing';

/** How the UI should colour a result. */
export type FitTone = 'good' | 'warn' | 'bad' | 'unknown';

export interface ZoneFit {
  zone: ZoneId;
  kind: ZoneKind;
  label: FitLabel;
  tone: FitTone;
  /** garment − body (girth) or garment − target length. null when unknown. */
  diffCm: number | null;
  garmentCm: number | null;
  bodyCm: number;
  /** Whether the body number was estimated or typed in — affects confidence. */
  bodySource: MeasurementSource;
  /** Where the garment number came from (chart, estimated, audited). Absent when the chart lacks it. */
  garmentOrigin?: MeasurementOrigin;
  /** Plain-language reason, set when label is "unknown". */
  note?: string;
  /** Landing zones only: the mark the edge lands at (a LandingRule mark label). */
  landing?: string;
  /** Set (true) only when the size's overall result doesn't need this zone. */
  optional?: true;
  /**
   * Set only when bodyCm isn't the body measurement itself but worked out from it:
   * "band" = the body's girth where the waistband sits (pants waist below the navel).
   */
  bodyAt?: 'band';
  /**
   * The label ranges for this zone, in cm of difference, lowest first. Lets the UI
   * draw a scale without knowing the rules. Ends are ±Infinity.
   */
  bands: FitBand[];
}

export interface FitBand {
  from: number;
  to: number;
  label: Exclude<FitLabel, 'unknown'>;
  tone: Exclude<FitTone, 'unknown'>;
}

export interface GarmentFit {
  garmentId: string;
  sizeLabel: string;
  /** Whose body this was worked out for: the UI calls the chest "Bust" for a women's body. */
  bodyType: BodyType;
  zones: ZoneFit[];
  /** Worst tone across zones; "unknown" if a girth couldn't be checked. See overallTone. */
  overall: FitTone;
}

// ---------- labelling (exported so the thresholds can be tested directly) ----------

export function labelGirth(easeCm: number, rule: GirthRule, tightAllowanceCm = 0): GirthLabel {
  if (easeCm < rule.tightBelow - tightAllowanceCm) return 'tight';
  if (easeCm <= rule.fittedMax) return 'fitted';
  if (easeCm <= rule.relaxedMax) return 'relaxed';
  return 'loose';
}

export function labelLength(diffCm: number, rule: LengthRule): LengthLabel {
  if (diffCm < rule.shortBelow) return 'short';
  if (diffCm > rule.longAbove) return 'long';
  return 'good';
}

/** The mark an edge lands at: the last one at or below the difference, or the first when it's below them all. */
export function landingMark(diffCm: number, rule: LandingRule): string {
  let mark = rule.marks[0]?.label ?? '';
  for (const m of rule.marks) if (diffCm >= m.atCm) mark = m.label;
  return mark;
}

function toneFor(label: FitLabel, diffCm: number | null, rule: Rule): FitTone {
  switch (label) {
    case 'noted':
    case 'fitted':
    case 'relaxed':
    case 'good':
      return 'good';
    case 'loose':
      return 'warn';
    case 'tight':
      return 'bad';
    case 'short':
    case 'long': {
      const r = rule as LengthRule;
      const bound = label === 'short' ? r.shortBelow : r.longAbove;
      return Math.abs(diffCm ?? 0) > Math.abs(bound) * LENGTH_FAR_MULTIPLIER ? 'bad' : 'warn';
    }
    default:
      return 'unknown';
  }
}

const TONE_RANK: Record<FitTone, number> = { unknown: 0, good: 1, warn: 2, bad: 3 };

// ---------- which zones apply to which garment: see zones.ts ----------

function unknownReason(spec: ZoneSpec, rule: Rule, garment: Garment, garmentCm: number | undefined): string | null {
  if (garmentCm === undefined) return `${garment.brand} doesn't list this measurement.`;
  const key = spec.garmentKey;
  // A girth zone, or any zone on a girth measurement (a leg opening's landing), needs its method.
  if ((rule.kind === 'girth' || isGirthKey(key)) && !(isGirthKey(key) ? girthKnown(garment, key) : garment.girthVerified)) {
    return `${garment.brand}'s chart doesn't say whether this is measured flat or all the way round.`;
  }
  if (spec.needs) {
    const value = definitionOf(garment, spec.needs.definition);
    if (value === undefined || !spec.needs.accepts.includes(value)) return spec.needs.reason(garment.brand, value);
  }
  return null;
}

function bandsFor(rule: Rule, tightAllowanceCm: number): FitBand[] {
  // A landing zone has no scale of good and bad, so no bands.
  if (rule.kind === 'landing') return [];
  if (rule.kind === 'girth') {
    const tight = rule.tightBelow - tightAllowanceCm;
    return [
      { from: -Infinity, to: tight, label: 'tight', tone: 'bad' },
      { from: tight, to: rule.fittedMax, label: 'fitted', tone: 'good' },
      { from: rule.fittedMax, to: rule.relaxedMax, label: 'relaxed', tone: 'good' },
      { from: rule.relaxedMax, to: Infinity, label: 'loose', tone: 'warn' },
    ];
  }
  const far = LENGTH_FAR_MULTIPLIER;
  return [
    { from: -Infinity, to: rule.shortBelow * far, label: 'short', tone: 'bad' },
    { from: rule.shortBelow * far, to: rule.shortBelow, label: 'short', tone: 'warn' },
    { from: rule.shortBelow, to: rule.longAbove, label: 'good', tone: 'good' },
    { from: rule.longAbove, to: rule.longAbove * far, label: 'long', tone: 'warn' },
    { from: rule.longAbove * far, to: Infinity, label: 'long', tone: 'bad' },
  ];
}

/** How one zone of one size fits. Exported for tests; use fitGarment. */
export function fitZone(spec: ZoneSpec, body: BodyModel, garment: Garment, gs: GarmentSize): ZoneFit {
  const size = gs.measurements;
  const bodyCm = spec.bodyTarget ? spec.bodyTarget(body.measurements, garment, size) : body.measurements[spec.bodyKey];
  // A worked-out body number rests on estimated heights, so it's estimated even when the user typed the measurement.
  const workedOut = bodyCm !== body.measurements[spec.bodyKey];
  const zoneRule = ruleFor(spec, garment);
  // Fraction-scale girth bounds become cm for this body, so labels, bands and ease all read in cm.
  const rule = zoneRule.kind === 'girth' ? girthRuleInCm(zoneRule, bodyCm) : zoneRule;
  const bodySource = workedOut ? 'estimated' : body.sources[spec.bodyKey];
  const garmentCm = size[spec.garmentKey];
  const garmentOrigin = gs.provenance[spec.garmentKey]?.origin;
  const tightAllowanceCm = stretchAllowance(rule, stretchOf(garment, spec.garmentKey)) * bodyCm;
  const base = {
    zone: spec.zone,
    kind: rule.kind,
    bodyCm,
    bodySource,
    bands: bandsFor(rule, tightAllowanceCm),
    ...(garmentOrigin !== undefined ? { garmentOrigin } : {}),
    ...(spec.optional ? { optional: true as const } : {}),
    ...(workedOut ? { bodyAt: 'band' as const } : {}),
  } as const;

  const reason = unknownReason(spec, rule, garment, garmentCm);
  if (reason !== null || garmentCm === undefined) {
    return {
      ...base,
      label: 'unknown',
      tone: 'unknown',
      diffCm: null,
      garmentCm: garmentCm ?? null,
      note: reason ?? undefined,
    };
  }

  const diffCm = garmentCm - bodyCm;
  if (rule.kind === 'landing') {
    const landing = landingMark(diffCm, rule);
    const blocked = rule.blocks?.({ body: body.measurements, garment, size, garmentCm }) ?? null;
    if (blocked) return { ...base, label: blocked.label, tone: 'bad', diffCm, garmentCm, landing, note: blocked.note };
    return { ...base, label: 'noted', tone: toneFor('noted', diffCm, rule), diffCm, garmentCm, landing };
  }
  const label = rule.kind === 'girth' ? labelGirth(diffCm, rule, tightAllowanceCm) : labelLength(diffCm, rule);
  return { ...base, label, tone: toneFor(label, diffCm, rule), diffCm, garmentCm };
}

// ---------- public API ----------

/** How one size of a garment fits this body, zone by zone. */
export function fitGarment(body: BodyModel, garment: Garment, sizeLabel: string): GarmentFit {
  const size = garment.sizes.find((s) => s.label === sizeLabel);
  if (!size) {
    throw new Error(`${garment.id} has no size "${sizeLabel}"`);
  }
  const zones = zoneSpecsFor(garment, size.measurements).map((spec) =>
    fitZone(spec, body, garment, size),
  );
  return { garmentId: garment.id, sizeLabel, bodyType: body.measurements.bodyType, zones, overall: overallTone(zones) };
}

/**
 * Worst tone across the zones — except that we never call a size "good" or
 * "warn" when a girth couldn't be checked, since girth is what decides whether a
 * size fits at all. A definite "bad" (say, far too short) is still reported.
 * Landing zones only count when they block; optional zones only once scored.
 */
export function overallTone(allZones: ZoneFit[]): FitTone {
  // A landing zone that blocks (the garment won't go on or stay up) is a definite bad.
  if (allZones.some((z) => z.kind === 'landing' && z.tone === 'bad')) return 'bad';
  // Otherwise landing zones describe; they never decide. Nor does an optional zone we couldn't score.
  const zones = allZones.filter((z) => z.kind !== 'landing' && !(z.optional && z.label === 'unknown'));
  const worst = zones.reduce<FitTone>(
    (acc, z) => (TONE_RANK[z.tone] > TONE_RANK[acc] ? z.tone : acc),
    'unknown',
  );
  if (worst === 'bad') return 'bad';
  if (zones.some((z) => z.kind === 'girth' && z.label === 'unknown')) return 'unknown';
  return worst;
}

/** fitGarment for every size, in chart order. */
export function fitAllSizes(body: BodyModel, garment: Garment): GarmentFit[] {
  return garment.sizes.map((s) => fitGarment(body, garment, s.label));
}
