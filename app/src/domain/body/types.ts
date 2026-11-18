/**
 * Body model types. All lengths are cm, all weights kg.
 */

/** Which size-chart population to estimate from. Men's is the v1 default. */
export type SizingProfile = 'mens' | 'womens';

/** Measurements a user may type in to replace an estimate. */
export interface BodyOverrides {
  chestCm?: number;
  waistCm?: number;
  hipsCm?: number;
  inseamCm?: number;
}

/** What the user gives us. Height and weight are required; nothing else is. */
export interface BodyInput {
  heightCm: number;
  weightKg: number;
  sizing: SizingProfile;
  overrides?: BodyOverrides;
}

/** Every measurement the fit engine and mannequin can use. */
export interface BodyMeasurements {
  heightCm: number;
  weightKg: number;
  sizing: SizingProfile;
  /** Chest circumference at the fullest point. */
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

/** Keys of BodyMeasurements that are measurements (not height/weight/sizing). */
export type MeasurementKey =
  | 'chestCm'
  | 'waistCm'
  | 'hipsCm'
  | 'inseamCm'
  | 'shoulderWidthCm'
  | 'armLengthCm'
  | 'torsoLengthCm';

/** Where each value came from: our estimate, or the user's own tape measure. */
export type MeasurementSource = 'estimated' | 'entered';

export interface BodyModel {
  measurements: BodyMeasurements;
  sources: Record<MeasurementKey, MeasurementSource>;
}
