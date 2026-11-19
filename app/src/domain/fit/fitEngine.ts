/**
 * The fit engine: body + garment + size -> how each zone fits, in cm.
 *
 * Pure functions only. No React, no storage, no randomness. Which size to
 * suggest is decided from sampled odds — see sampleFit.ts.
 */

import type { BodyModel, MeasurementKey, MeasurementSource } from '../body';
import type { Garment, GarmentSize, MeasurementOrigin, SizeMeasurements } from '../garments';
import {
  BOTTOM_HIPS,
  BOTTOM_WAIST,
  INSEAM,
  LENGTH_FAR_MULTIPLIER,
  SLEEVE,
  STRETCH_ALLOWANCE,
  TOP_CHEST,
  TOP_LENGTH,
  TOP_WAIST,
  type GirthRule,
  type LengthRule,
} from './rules';

export type ZoneId = 'chest' | 'waist' | 'hips' | 'length' | 'sleeve' | 'inseam';
export type GirthLabel = 'tight' | 'fitted' | 'relaxed' | 'loose';
export type LengthLabel = 'short' | 'good' | 'long';
export type FitLabel = GirthLabel | LengthLabel | 'unknown';

/** How the UI should colour a result. */
export type FitTone = 'good' | 'warn' | 'bad' | 'unknown';

export interface ZoneFit {
  zone: ZoneId;
  kind: 'girth' | 'length';
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
  zones: ZoneFit[];
  /** Worst tone across zones; "unknown" if a girth couldn't be checked. See overallTone. */
  overall: FitTone;
}

interface ZoneSpec {
  zone: ZoneId;
  garmentKey: keyof SizeMeasurements;
  bodyKey: MeasurementKey;
  rule: GirthRule | LengthRule;
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

function toneFor(label: FitLabel, diffCm: number | null, rule: GirthRule | LengthRule): FitTone {
  switch (label) {
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

// ---------- which zones apply to which garment ----------

function zonesFor(garment: Garment, size: SizeMeasurements): ZoneSpec[] {
  if (garment.category === 'top') {
    const specs: ZoneSpec[] = [
      { zone: 'chest', garmentKey: 'chest', bodyKey: 'chestCm', rule: TOP_CHEST },
    ];
    if (size.waist !== undefined) {
      specs.push({ zone: 'waist', garmentKey: 'waist', bodyKey: 'waistCm', rule: TOP_WAIST });
    }
    specs.push({ zone: 'length', garmentKey: 'length', bodyKey: 'torsoLengthCm', rule: TOP_LENGTH });
    // Short sleeves are a style choice, not a fit issue, so we only score long sleeves.
    if (garment.sleeve === 'long') {
      specs.push({ zone: 'sleeve', garmentKey: 'sleeve', bodyKey: 'armLengthCm', rule: SLEEVE });
    }
    return specs;
  }
  return [
    { zone: 'waist', garmentKey: 'waist', bodyKey: 'waistCm', rule: BOTTOM_WAIST },
    { zone: 'hips', garmentKey: 'hips', bodyKey: 'hipsCm', rule: BOTTOM_HIPS },
    { zone: 'inseam', garmentKey: 'inseam', bodyKey: 'inseamCm', rule: INSEAM },
  ];
}

function unknownReason(spec: ZoneSpec, garment: Garment, garmentCm: number | undefined): string | null {
  if (garmentCm === undefined) return `${garment.brand} doesn't list this measurement.`;
  if (spec.rule.kind === 'girth' && !garment.girthVerified) {
    return `${garment.brand}'s chart doesn't say whether this is measured flat or all the way round.`;
  }
  // Body length targets run from the high point of the shoulder; any other start point can't be compared.
  if (spec.zone === 'length' && garment.lengthDefinition !== 'hps') {
    return garment.lengthDefinition === 'center_back'
      ? `${garment.brand} measures length from the back of the neck, so we can't compare it to your body.`
      : `${garment.brand}'s chart doesn't say where length is measured from.`;
  }
  if (spec.zone === 'sleeve' && garment.sleeveDefinition !== 'shoulder_to_cuff') {
    return `${garment.brand} measures sleeves differently, so we can't compare it to your arm.`;
  }
  return null;
}

function bandsFor(rule: GirthRule | LengthRule, tightAllowanceCm: number): FitBand[] {
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

function fitZone(spec: ZoneSpec, body: BodyModel, garment: Garment, gs: GarmentSize): ZoneFit {
  const size = gs.measurements;
  const bodyCm = body.measurements[spec.bodyKey];
  const bodySource = body.sources[spec.bodyKey];
  const garmentCm = size[spec.garmentKey];
  const garmentOrigin = gs.provenance[spec.garmentKey]?.origin;
  const tightAllowanceCm = STRETCH_ALLOWANCE[garment.stretch] * bodyCm;
  const base = {
    zone: spec.zone,
    kind: spec.rule.kind,
    bodyCm,
    bodySource,
    bands: bandsFor(spec.rule, tightAllowanceCm),
    ...(garmentOrigin !== undefined ? { garmentOrigin } : {}),
  } as const;

  const reason = unknownReason(spec, garment, garmentCm);
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
  const label =
    spec.rule.kind === 'girth'
      ? labelGirth(diffCm, spec.rule, tightAllowanceCm)
      : labelLength(diffCm, spec.rule);
  return { ...base, label, tone: toneFor(label, diffCm, spec.rule), diffCm, garmentCm };
}

// ---------- public API ----------

/** How one size of a garment fits this body, zone by zone. */
export function fitGarment(body: BodyModel, garment: Garment, sizeLabel: string): GarmentFit {
  const size = garment.sizes.find((s) => s.label === sizeLabel);
  if (!size) {
    throw new Error(`${garment.id} has no size "${sizeLabel}"`);
  }
  const zones = zonesFor(garment, size.measurements).map((spec) =>
    fitZone(spec, body, garment, size),
  );
  return { garmentId: garment.id, sizeLabel, zones, overall: overallTone(zones) };
}

/**
 * Worst tone across the zones — except that we never call a size "good" or
 * "warn" when a girth couldn't be checked, since girth is what decides whether a
 * size fits at all. A definite "bad" (say, far too short) is still reported.
 */
export function overallTone(zones: ZoneFit[]): FitTone {
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
