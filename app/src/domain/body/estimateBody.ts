/**
 * Body estimation: height + weight (+ optional overrides) -> body measurements.
 *
 * Deliberately simple and transparent so it can be replaced later (e.g. an SMPL
 * fit). Keep the public surface — `estimateBody` and `validateBodyInput` — stable.
 * The user's own tape-measure numbers always win over every estimate here.
 *
 * Men's girths scale from a reference adult by BMI and height:
 *
 *   girth = refGirth × (BMI / refBMI)^bmiExp × (height / refHeight)^heightExp
 *
 * The height term (≈0.5) comes from treating the torso as a cylinder: at a fixed
 * BMI, weight grows with height², so cross-section grows with height and
 * circumference with √height. Waist gets a larger BMI exponent than chest or hips
 * because extra weight shows up there first. The men's reference body is rounded
 * from the ANSUR II survey means (US Army, 2012); the exponents are reasoned, not fitted.
 *
 * Women's bust, waist, hips and inseam are linear regressions on height and weight,
 * fitted to the ANSUR II female public dataset (see WOMENS_REGRESSION).
 *
 * Other lengths (arm, torso, shoulder width) are fixed fractions of height.
 *
 * Leg keys for pants (thigh, knee, calf, heel–ankle, front rise, and the navel,
 * hip-line and knee heights): women's are regressions on the same ANSUR II file
 * (WOMENS_LEG_REGRESSION); men's are ASSUMED ratios (MENS_LEG_RATIO) until the
 * men's ANSUR II re-fit, which is a later change.
 * ANSUR II is a military population, so treat every estimate as a starting point.
 */

import { braInches, braSizeProblem, bustFromBraCm } from './braSize';
import type {
  BodyInput,
  BodyModel,
  BodyOverrides,
  BodyType,
  LegKey,
  MeasurementSource,
} from './types';

interface ReferenceBody {
  heightCm: number;
  weightKg: number;
  chestCm: number;
  waistCm: number;
  hipsCm: number;
}

/** Length measurements as a fraction of height. */
interface LengthRatios {
  inseam: number;
  armLength: number;
  torsoLength: number;
  shoulderWidth: number;
}

/** The men's power-law model (unchanged since v1). */
export const MENS_MODEL = {
  ref: { heightCm: 176, weightKg: 85, chestCm: 104, waistCm: 94, hipsCm: 103 } satisfies ReferenceBody,
  bmiExponent: { chest: 0.55, waist: 0.75, hips: 0.5 },
  heightExponent: 0.5,
  ratio: { inseam: 0.45, armLength: 0.35, torsoLength: 0.41, shoulderWidth: 0.26 } satisfies LengthRatios,
};

/** value (cm) = intercept + perCm × height (cm) + perKg × weight (kg). */
export interface LinearFit {
  intercept: number;
  perCm: number;
  perKg: number;
  /** Residual SD in the survey, cm: how far a real woman typically sits from the line. */
  residualSdCm: number;
}

/**
 * Women's regressions, ordinary least squares on height (stature) and weight over
 * all 1,986 women in the ANSUR II female public dataset (Gordon et al. 2014,
 * "2012 Anthropometric Survey of U.S. Army Personnel", NATICK/TR-15/007; public
 * file ANSUR_II_FEMALE_Public.csv from Penn State's OPEN Design Lab). Survey means:
 * 162.8 cm, 67.8 kg, BMI 25.5 (range 16–41). Fitted 2026-11-19.
 *  - bust: "chestcircumference", taken around the bust points.  R² 0.73, SD 4.3 cm
 *  - waist: "waistcircumference", taken at the navel — lower and a little larger
 *    than the narrowest natural waist, but where a mid-rise waistband sits. R² 0.77, SD 4.9 cm
 *  - hips: "buttockcircumference", at the fullest part of the seat.  R² 0.85, SD 3.0 cm
 *  - inseam: "crotchheight", floor to crotch, barefoot.  R² 0.73, SD 2.3 cm
 * Negative height terms are real: at the same weight, a taller woman is slimmer.
 */
export const WOMENS_REGRESSION: Record<'chestCm' | 'waistCm' | 'hipsCm' | 'inseamCm', LinearFit> = {
  chestCm: { intercept: 99.03, perCm: -0.3292, perKg: 0.7269, residualSdCm: 4.26 },
  waistCm: { intercept: 101.41, perCm: -0.4717, perKg: 0.9076, residualSdCm: 4.85 },
  hipsCm: { intercept: 84.69, perCm: -0.1784, perKg: 0.6861, residualSdCm: 2.95 },
  inseamCm: { intercept: -20.53, perCm: 0.6199, perKg: -0.0324, residualSdCm: 2.34 },
};

/**
 * Women's other lengths, as fractions of height.
 *  - armLength 0.339: ANSUR II female acromion–radiale + radiale–stylion length / stature (mean).
 *  - torsoLength 0.395 and shoulderWidth 0.245: estimated, not sourced (our torso line
 *    and across-the-back shoulder have no direct ANSUR II equivalent), so their
 *    spreads in fit/uncertainty.ts are wider.
 */
export const WOMENS_RATIO: Omit<LengthRatios, 'inseam'> = { armLength: 0.339, torsoLength: 0.395, shoulderWidth: 0.245 };

/**
 * Women's leg keys: least squares on height and weight over the same 1,986 women
 * as WOMENS_REGRESSION (ANSUR II female public file), fitted 2026-11-19. ANSUR II
 * column, R², residual SD:
 *  - thighCm: "thighcircumference", just below the gluteal fold.          R² 0.83, SD 2.28 cm
 *  - kneeCm: "lowerthighcircumference", just above the knee.               R² 0.71, SD 1.91 cm
 *  - calfCm: "calfcircumference".                                          R² 0.65, SD 1.70 cm
 *  - heelAnkleCm: "heelanklecircumference".                                R² 0.59, SD 0.98 cm
 *  - frontRiseCm: "crotchlengthomphalion" − "crotchlengthposterioromphalion"
 *    (navel to crotch, front half). Weak: R² 0.30, SD 2.47 cm
 *  - waistHeightCm: "waistheightomphalion", floor to navel.               R² 0.84, SD 2.01 cm
 *  - hipHeightCm: "buttockheight", floor to the fullest seat.             R² 0.71, SD 2.47 cm
 *  - kneeHeightCm: "kneeheightmidpatella".                                R² 0.71, SD 1.40 cm
 */
export const WOMENS_LEG_REGRESSION: Record<LegKey, LinearFit> = {
  thighCm: { intercept: 58.4, perCm: -0.1942, perKg: 0.5142, residualSdCm: 2.28 },
  kneeCm: { intercept: 35.02, perCm: -0.0911, perKg: 0.2936, residualSdCm: 1.91 },
  calfCm: { intercept: 30.59, perCm: -0.0514, perKg: 0.223, residualSdCm: 1.7 },
  heelAnkleCm: { intercept: 11.1, perCm: 0.0946, perKg: 0.0667, residualSdCm: 0.98 },
  frontRiseCm: { intercept: 19.82, perCm: -0.0136, perKg: 0.152, residualSdCm: 2.47 },
  waistHeightCm: { intercept: -22.36, perCm: 0.7652, perKg: -0.0624, residualSdCm: 2.01 },
  hipHeightCm: { intercept: -11.94, perCm: 0.5743, perKg: 0.0266, residualSdCm: 2.47 },
  kneeHeightCm: { intercept: -10.1, perCm: 0.3347, perKg: 0.0073, residualSdCm: 1.4 },
};

/**
 * Men's leg keys, ASSUMED until the men's ANSUR II re-fit: each is the ratio of
 * the ANSUR II male means (4,082 men; mean key / mean seat circumference for the
 * girths, / mean stature for the rest). Girths ride on the men's hips estimate so
 * they grow with weight; heights and the front rise are fractions of height.
 */
export const MENS_LEG_RATIO = {
  // × hipsCm
  thigh: 0.61,
  knee: 0.4,
  calf: 0.385,
  // × heightCm
  heelAnkle: 0.196,
  frontRise: 0.152,
  waistHeight: 0.601,
  hipHeight: 0.505,
  kneeHeight: 0.278,
};

/**
 * Navel-to-crotch height ÷ front rise (along the body): how far a waistband drops
 * for each cm of rise it's short of the body's own. Women's 0.71 from ANSUR II
 * female means (19.8 cm vertical over 27.9 cm). Men's 0.79 from the male means,
 * ASSUMED until the men's re-fit. Used by fit/pants.ts bandHeight().
 */
export const RISE_VERTICAL_RATIO: Record<BodyType, number> = { womens: 0.71, mens: 0.79 };

/** Clamps for the estimated leg keys (cm): a regression far outside the survey can run off. */
export const LEG_ESTIMATE_LIMITS: Record<LegKey, { min: number; max: number }> = {
  thighCm: { min: 35, max: 110 },
  kneeCm: { min: 25, max: 75 },
  calfCm: { min: 22, max: 65 },
  heelAnkleCm: { min: 22, max: 45 },
  frontRiseCm: { min: 15, max: 50 },
  waistHeightCm: { min: 70, max: 145 },
  hipHeightCm: { min: 55, max: 125 },
  kneeHeightCm: { min: 30, max: 75 },
};

/**
 * Smallest gaps kept between heights (cm), ASSUMED: the hip line sits above the
 * crotch, the navel above the hip line, the knee below the crotch. When an entered
 * inseam is far from the estimate, the leg heights give way; the inseam never does.
 */
export const HEIGHT_GAPS_CM = { hipAboveCrotch: 2, navelAboveHip: 5, kneeBelowCrotch: 10 };

/**
 * A regression's value, kept inside the plausible range for that measurement: far
 * outside the survey (say 200 cm and 40 kg) a straight line can run below zero.
 */
const linear = (fit: LinearFit, heightCm: number, weightKg: number, limits: { min: number; max: number }) =>
  Math.min(limits.max, Math.max(limits.min, fit.intercept + fit.perCm * heightCm + fit.perKg * weightKg));

/** Plausible ranges. Anything outside is almost certainly a typo or wrong unit. */
export const INPUT_LIMITS = {
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 30, max: 250 },
  chestCm: { min: 60, max: 180 },
  waistCm: { min: 50, max: 180 },
  hipsCm: { min: 60, max: 180 },
  inseamCm: { min: 50, max: 110 },
} as const;

const FIELD_NAMES: Record<keyof typeof INPUT_LIMITS, string> = {
  heightCm: 'Height',
  weightKg: 'Weight',
  chestCm: 'Chest',
  waistCm: 'Waist',
  hipsCm: 'Hips',
  inseamCm: 'Inseam',
};

export interface ValidationError {
  field: keyof typeof INPUT_LIMITS | 'braSize';
  message: string;
}

/** Returns every problem with the input (empty array = valid). */
export function validateBodyInput(input: BodyInput): ValidationError[] {
  const errors: ValidationError[] = [];
  const check = (field: keyof typeof INPUT_LIMITS, value: number | undefined) => {
    if (value === undefined) return;
    const { min, max } = INPUT_LIMITS[field];
    if (!Number.isFinite(value) || value < min || value > max) {
      const name = field === 'chestCm' && input.bodyType === 'womens' ? 'Bust' : FIELD_NAMES[field];
      errors.push({ field, message: `${name} should be between ${min} and ${max}.` });
    }
  };
  check('heightCm', input.heightCm);
  check('weightKg', input.weightKg);
  const o = input.overrides ?? {};
  check('chestCm', o.chestCm);
  check('waistCm', o.waistCm);
  check('hipsCm', o.hipsCm);
  check('inseamCm', o.inseamCm);
  if (o.braSize !== undefined) {
    const problem = braSizeProblem(o.braSize);
    if (problem) errors.push({ field: 'braSize', message: problem });
  }
  return errors;
}

const bmi = (heightCm: number, weightKg: number) => weightKg / (heightCm / 100) ** 2;

/** Estimates from height and weight alone, for one body type. */
function estimateFromSize(bodyType: BodyType, heightCm: number, weightKg: number) {
  if (bodyType === 'womens') {
    const r = WOMENS_REGRESSION;
    return {
      chestCm: linear(r.chestCm, heightCm, weightKg, INPUT_LIMITS.chestCm),
      waistCm: linear(r.waistCm, heightCm, weightKg, INPUT_LIMITS.waistCm),
      hipsCm: linear(r.hipsCm, heightCm, weightKg, INPUT_LIMITS.hipsCm),
      inseamCm: linear(r.inseamCm, heightCm, weightKg, INPUT_LIMITS.inseamCm),
      shoulderWidthCm: heightCm * WOMENS_RATIO.shoulderWidth,
      armLengthCm: heightCm * WOMENS_RATIO.armLength,
      torsoLengthCm: heightCm * WOMENS_RATIO.torsoLength,
      ...womensLegs(heightCm, weightKg),
    };
  }
  const { ref, bmiExponent, heightExponent, ratio } = MENS_MODEL;
  const bmiRatio = bmi(heightCm, weightKg) / bmi(ref.heightCm, ref.weightKg);
  const heightFactor = (heightCm / ref.heightCm) ** heightExponent;
  const girth = (refCm: number, exp: number) => refCm * bmiRatio ** exp * heightFactor;
  const hipsCm = girth(ref.hipsCm, bmiExponent.hips);
  return {
    chestCm: girth(ref.chestCm, bmiExponent.chest),
    waistCm: girth(ref.waistCm, bmiExponent.waist),
    hipsCm,
    inseamCm: heightCm * ratio.inseam,
    shoulderWidthCm: heightCm * ratio.shoulderWidth,
    armLengthCm: heightCm * ratio.armLength,
    torsoLengthCm: heightCm * ratio.torsoLength,
    ...mensLegs(heightCm, hipsCm),
  };
}

function womensLegs(heightCm: number, weightKg: number): Record<LegKey, number> {
  const r = WOMENS_LEG_REGRESSION;
  const fit = (key: LegKey) => linear(r[key], heightCm, weightKg, LEG_ESTIMATE_LIMITS[key]);
  return {
    thighCm: fit('thighCm'),
    kneeCm: fit('kneeCm'),
    calfCm: fit('calfCm'),
    heelAnkleCm: fit('heelAnkleCm'),
    frontRiseCm: fit('frontRiseCm'),
    waistHeightCm: fit('waistHeightCm'),
    hipHeightCm: fit('hipHeightCm'),
    kneeHeightCm: fit('kneeHeightCm'),
  };
}

function mensLegs(heightCm: number, hipsCm: number): Record<LegKey, number> {
  const r = MENS_LEG_RATIO;
  const clamp = (key: LegKey, v: number) => Math.min(LEG_ESTIMATE_LIMITS[key].max, Math.max(LEG_ESTIMATE_LIMITS[key].min, v));
  return {
    thighCm: clamp('thighCm', r.thigh * hipsCm),
    kneeCm: clamp('kneeCm', r.knee * hipsCm),
    calfCm: clamp('calfCm', r.calf * hipsCm),
    heelAnkleCm: clamp('heelAnkleCm', r.heelAnkle * heightCm),
    frontRiseCm: clamp('frontRiseCm', r.frontRise * heightCm),
    waistHeightCm: clamp('waistHeightCm', r.waistHeight * heightCm),
    hipHeightCm: clamp('hipHeightCm', r.hipHeight * heightCm),
    kneeHeightCm: clamp('kneeHeightCm', r.kneeHeight * heightCm),
  };
}

/** Keep knee < crotch (inseam) < hip line < navel, moving only the leg heights. */
function orderHeights(m: { inseamCm: number; kneeHeightCm: number; hipHeightCm: number; waistHeightCm: number }) {
  const g = HEIGHT_GAPS_CM;
  m.hipHeightCm = Math.max(m.hipHeightCm, m.inseamCm + g.hipAboveCrotch);
  m.waistHeightCm = Math.max(m.waistHeightCm, m.hipHeightCm + g.navelAboveHip);
  m.kneeHeightCm = Math.min(m.kneeHeightCm, m.inseamCm - g.kneeBelowCrotch);
}

/**
 * Estimate a full set of body measurements. Throws a RangeError if the input is
 * implausible — call `validateBodyInput` first to show friendly messages.
 *
 * The bust (chestCm) comes from, best first: a measured bust, a bra size, height
 * and weight. A bra-size bust is still "estimated" (see BodyModel.bra).
 */
export function estimateBody(input: BodyInput): BodyModel {
  const errors = validateBodyInput(input);
  if (errors.length > 0) {
    throw new RangeError(errors.map((e) => e.message).join(' '));
  }

  const { heightCm, weightKg, bodyType } = input;
  const estimated = estimateFromSize(bodyType, heightCm, weightKg);

  const overrides: BodyOverrides = input.overrides ?? {};
  const bra = overrides.braSize;
  const braSetsBust = bra !== undefined && overrides.chestCm === undefined;
  if (braSetsBust) estimated.chestCm = bustFromBraCm(bra);

  type TapeKey = 'chestCm' | 'waistCm' | 'hipsCm' | 'inseamCm';
  const pick = (key: TapeKey) => overrides[key] ?? estimated[key];
  const sourceOf = (key: TapeKey): MeasurementSource =>
    overrides[key] !== undefined ? 'entered' : 'estimated';

  const model: BodyModel = {
    measurements: {
      heightCm,
      weightKg,
      bodyType,
      ...estimated,
      chestCm: pick('chestCm'),
      waistCm: pick('waistCm'),
      hipsCm: pick('hipsCm'),
      inseamCm: pick('inseamCm'),
    },
    sources: {
      chestCm: sourceOf('chestCm'),
      waistCm: sourceOf('waistCm'),
      hipsCm: sourceOf('hipsCm'),
      inseamCm: sourceOf('inseamCm'),
      shoulderWidthCm: 'estimated',
      armLengthCm: 'estimated',
      torsoLengthCm: 'estimated',
      thighCm: 'estimated',
      kneeCm: 'estimated',
      calfCm: 'estimated',
      heelAnkleCm: 'estimated',
      frontRiseCm: 'estimated',
      waistHeightCm: 'estimated',
      hipHeightCm: 'estimated',
      kneeHeightCm: 'estimated',
    },
  };
  orderHeights(model.measurements);
  if (bra !== undefined) model.bra = { ...braInches(bra), setsBust: braSetsBust };
  return model;
}
