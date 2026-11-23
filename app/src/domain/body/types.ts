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
  // ---- legs (pants). Estimated only; none can be typed in yet. ----
  /** Thigh circumference at its fullest, just below the seat. */
  thighCm: number;
  /** Circumference just above the knee (ANSUR II "lower thigh"). */
  kneeCm: number;
  /** Calf circumference at its fullest. */
  calfCm: number;
  /** Round the heel and the top of the instep: what a leg opening has to pass over. */
  heelAnkleCm: number;
  /** Front rise of the body: navel to crotch at the front, along the body. */
  frontRiseCm: number;
  /** Floor to navel (where ANSUR II measures the waist). */
  waistHeightCm: number;
  /** Floor to the fullest part of the seat (the hip line, where hipsCm is measured). */
  hipHeightCm: number;
  /** Floor to the middle of the kneecap. */
  kneeHeightCm: number;
  /** Floor to the ankle bone (lateral malleolus): where a full-length legging ends. */
  ankleHeightCm: number;
}

/** Keys of BodyMeasurements that are measurements (not height/weight/bodyType). */
export type MeasurementKey =
  | 'chestCm'
  | 'waistCm'
  | 'hipsCm'
  | 'inseamCm'
  | 'shoulderWidthCm'
  | 'armLengthCm'
  | 'torsoLengthCm'
  | LegKey;

/** The leg keys pants are fitted and drawn with. */
export type LegKey =
  | 'thighCm'
  | 'kneeCm'
  | 'calfCm'
  | 'heelAnkleCm'
  | 'frontRiseCm'
  | 'waistHeightCm'
  | 'hipHeightCm'
  | 'kneeHeightCm'
  | 'ankleHeightCm';

export const LEG_KEYS: readonly LegKey[] = [
  'thighCm',
  'kneeCm',
  'calfCm',
  'heelAnkleCm',
  'frontRiseCm',
  'waistHeightCm',
  'hipHeightCm',
  'kneeHeightCm',
  'ankleHeightCm',
];

/**
 * Every body measurement key, in a fixed order. New keys go at the end. (The
 * sampler draws the first seven from its main stream and every later key from
 * its own, so adding one never moves a seeded result; see fit/sampleFit.ts.)
 */
export const BODY_MEASUREMENT_KEYS: readonly MeasurementKey[] = [
  'chestCm',
  'waistCm',
  'hipsCm',
  'inseamCm',
  'shoulderWidthCm',
  'armLengthCm',
  'torsoLengthCm',
  ...LEG_KEYS,
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
