/**
 * Body model types. All lengths are cm, all weights kg.
 */

/** "Size me in women's / men's clothes": which body survey to estimate from. Men's is the default. */
export type BodyType = 'womens' | 'mens';

/** Bra cup letters differ between the US and UK past D (a UK E is a US DDD). */
export type BraSystem = 'us' | 'uk';

/** A bra size as the user gave it: band in inches (e.g. 34) and cup letters (e.g. "DD"). */
export interface BraSize {
  band: number;
  cup: string;
  system: BraSystem;
}

/** Measurements a user may type in to replace an estimate. */
export interface BodyOverrides {
  /** Chest, or full bust for a women's body. */
  chestCm?: number;
  waistCm?: number;
  hipsCm?: number;
  inseamCm?: number;
  /** Optional bra size: estimates the bust when no bust is measured. */
  braSize?: BraSize;
}

/** What the user gives us. Height and weight are required; nothing else is. */
export interface BodyInput {
  heightCm: number;
  weightKg: number;
  bodyType: BodyType;
  overrides?: BodyOverrides;
}

/** Every measurement the fit engine and mannequin can use. */
export interface BodyMeasurements {
  heightCm: number;
  weightKg: number;
  bodyType: BodyType;
  /** Chest circumference at the fullest point (full bust for a women's body). */
  chestCm: number;
  /** Natural waist circumference. */
  waistCm: number;
  /** Hip / seat circumference at the fullest point. */
  hipsCm: number;
  /** Crotch to floor (no shoes) — what a pants inseam should match. */
  inseamCm: number;
  /** Shoulder point to shoulder point across the back. */
  shoulderWidthCm: number;
  /** Shoulder point to wrist bone, arm relaxed. Long sleeves are compared to this. */
  armLengthCm: number;
  /**
   * High point of the shoulder (next to the neck) down to the hip line — where the
   * hem of a regular-length top should sit. Top "length" in size charts is measured
   * from the same high shoulder point, so the two compare directly.
   */
  torsoLengthCm: number;
}

/** Keys of BodyMeasurements that are measurements (not height/weight/bodyType). */
export type MeasurementKey =
  | 'chestCm'
  | 'waistCm'
  | 'hipsCm'
  | 'inseamCm'
  | 'shoulderWidthCm'
  | 'armLengthCm'
  | 'torsoLengthCm';

/**
 * Every body measurement key, in a fixed order. The sampler draws them in this
 * order, so add new keys at the end or a seed stops meaning the same draws.
 */
export const BODY_MEASUREMENT_KEYS: readonly MeasurementKey[] = [
  'chestCm',
  'waistCm',
  'hipsCm',
  'inseamCm',
  'shoulderWidthCm',
  'armLengthCm',
  'torsoLengthCm',
];

/** Where each value came from: our estimate, or the user's own tape measure. */
export type MeasurementSource = 'estimated' | 'entered';

export interface BodyModel {
  measurements: BodyMeasurements;
  sources: Record<MeasurementKey, MeasurementSource>;
  /**
   * The bra size, when one was given, in inches. `setsBust` is true when it set the
   * bust (no measured bust): the bust is then still "estimated", but with its own spread.
   */
  bra?: { bandIn: number; cupIn: number; setsBust: boolean };
}
