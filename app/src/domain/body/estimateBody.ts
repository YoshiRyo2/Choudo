/**
 * Body estimation: height + weight (+ optional overrides) -> body measurements.
 *
 * This is a deliberately simple, transparent model so we can replace it later
 * (e.g. with a regression fitted to anthropometric survey data, or an SMPL fit).
 * Keep the public surface — `estimateBody` and `validateBodyInput` — stable.
 *
 * Girths (chest, waist, hips) scale from a reference adult by BMI and height:
 *
 *   girth = refGirth × (BMI / refBMI)^bmiExp × (height / refHeight)^heightExp
 *
 * The height term (≈0.5) comes from treating the torso as a cylinder: at a fixed
 * BMI, weight grows with height², so cross-section grows with height and
 * circumference with √height. Waist gets a larger BMI exponent than chest or hips
 * because extra weight shows up there first.
 *
 * Lengths (inseam, arm, torso, shoulder width) are fixed fractions of height.
 *
 * Reference bodies are rounded from the ANSUR II survey means (US Army, 2012).
 * They're a military population, so treat every estimate as a starting point —
 * the user's own tape-measure numbers always win.
 */

import type {
  BodyInput,
  BodyModel,
  BodyOverrides,
  MeasurementSource,
  SizingProfile,
} from './types';

interface ReferenceBody {
  heightCm: number;
  weightKg: number;
  chestCm: number;
  waistCm: number;
  hipsCm: number;
}

interface ProfileModel {
  ref: ReferenceBody;
  bmiExponent: { chest: number; waist: number; hips: number };
  heightExponent: number;
  /** Length measurements as a fraction of height. */
  ratio: {
    inseam: number;
    armLength: number;
    torsoLength: number;
    shoulderWidth: number;
  };
}

export const PROFILE_MODELS: Record<SizingProfile, ProfileModel> = {
  mens: {
    ref: { heightCm: 176, weightKg: 85, chestCm: 104, waistCm: 94, hipsCm: 103 },
    bmiExponent: { chest: 0.55, waist: 0.75, hips: 0.5 },
    heightExponent: 0.5,
    ratio: { inseam: 0.45, armLength: 0.335, torsoLength: 0.41, shoulderWidth: 0.26 },
  },
  womens: {
    ref: { heightCm: 163, weightKg: 68, chestCm: 95, waistCm: 83, hipsCm: 102 },
    bmiExponent: { chest: 0.55, waist: 0.75, hips: 0.55 },
    heightExponent: 0.5,
    ratio: { inseam: 0.445, armLength: 0.33, torsoLength: 0.395, shoulderWidth: 0.245 },
  },
};

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
  field: keyof typeof INPUT_LIMITS;
  message: string;
}

/** Returns every problem with the input (empty array = valid). */
export function validateBodyInput(input: BodyInput): ValidationError[] {
  const errors: ValidationError[] = [];
  const check = (field: keyof typeof INPUT_LIMITS, value: number | undefined) => {
    if (value === undefined) return;
    const { min, max } = INPUT_LIMITS[field];
    if (!Number.isFinite(value) || value < min || value > max) {
      errors.push({ field, message: `${FIELD_NAMES[field]} should be between ${min} and ${max}.` });
    }
  };
  check('heightCm', input.heightCm);
  check('weightKg', input.weightKg);
  const o = input.overrides ?? {};
  check('chestCm', o.chestCm);
  check('waistCm', o.waistCm);
  check('hipsCm', o.hipsCm);
  check('inseamCm', o.inseamCm);
  return errors;
}

const bmi = (heightCm: number, weightKg: number) => weightKg / (heightCm / 100) ** 2;

/**
 * Estimate a full set of body measurements. Throws a RangeError if the input is
 * implausible — call `validateBodyInput` first to show friendly messages.
 */
export function estimateBody(input: BodyInput): BodyModel {
  const errors = validateBodyInput(input);
  if (errors.length > 0) {
    throw new RangeError(errors.map((e) => e.message).join(' '));
  }

  const { heightCm, weightKg, sizing } = input;
  const model = PROFILE_MODELS[sizing];
  const { ref } = model;

  const bmiRatio = bmi(heightCm, weightKg) / bmi(ref.heightCm, ref.weightKg);
  const heightFactor = (heightCm / ref.heightCm) ** model.heightExponent;
  const girth = (refCm: number, exp: number) => refCm * bmiRatio ** exp * heightFactor;

  const estimated = {
    chestCm: girth(ref.chestCm, model.bmiExponent.chest),
    waistCm: girth(ref.waistCm, model.bmiExponent.waist),
    hipsCm: girth(ref.hipsCm, model.bmiExponent.hips),
    inseamCm: heightCm * model.ratio.inseam,
    shoulderWidthCm: heightCm * model.ratio.shoulderWidth,
    armLengthCm: heightCm * model.ratio.armLength,
    torsoLengthCm: heightCm * model.ratio.torsoLength,
  };

  const overrides: BodyOverrides = input.overrides ?? {};
  const pick = (key: keyof BodyOverrides) => overrides[key] ?? estimated[key];
  const sourceOf = (key: keyof BodyOverrides): MeasurementSource =>
    overrides[key] !== undefined ? 'entered' : 'estimated';

  return {
    measurements: {
      heightCm,
      weightKg,
      sizing,
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
    },
  };
}
