/**
 * Every spread the fit sampler assumes, in one place. Each is one standard
 * deviation in cm unless it says otherwise. These are reasoned guesses, approved
 * for phase 3 — replace them with numbers from the 10-person fit test
 * (`npm run fit:report`) as soon as there are any.
 */

import type { MeasurementKey } from '../body';
import type { ConfidenceGrade } from '../garments';

/** Draws per sampleFit call. At 500 a 50% chance is good to about ±2.2 points. */
export const SAMPLE_COUNT = 500;

/** Fixed seed, so the same inputs always give the same percentages (and tests are stable). */
export const SAMPLER_SEED = 20261118;

/**
 * Body measurements estimated from height and weight (estimateBody).
 *  - chest 5: predicting chest from height + weight in ANSUR-style survey data is
 *    off by about 4 cm (1 SD); our power-law model is cruder, so rounded up. Approximate.
 *  - waist 6: waist moves most with BMI, so it's the hardest girth to guess.
 *  - hips 4: hips track weight more closely than waist does.
 *  - torso length 3, inseam 3: body proportions (sitting-height ratio) vary by
 *    about 1.5% of height, ≈ 2.7 cm on a 178 cm adult.
 *  - arm 2.5, shoulder width 2: same reasoning, shorter segments.
 */
export const ESTIMATED_BODY_SD_CM: Record<MeasurementKey, number> = {
  chestCm: 5,
  waistCm: 6,
  hipsCm: 4,
  inseamCm: 3,
  torsoLengthCm: 3,
  armLengthCm: 2.5,
  shoulderWidthCm: 2,
};

/**
 * A measurement the user typed in. Measuring yourself with a tape is repeatable
 * to about 1–2 cm (survey measurers allow ~1–2 cm between each other; doing it
 * on yourself is a little worse).
 */
export const ENTERED_BODY_SD_CM = 1.5;

/**
 * How far one real garment can differ from its chart, by confidence grade.
 *  - verified: a usual factory tolerance of ±½ in on a flat width (±2.5 cm round)
 *    and ±½ in on length, read as ±2 SD.
 *  - charted: adds the chance the chart itself is off (copying, reproductions, old charts).
 *  - estimated: some numbers are ours — about half a size step.
 * "unscored" garments use the charted spread for whatever can still be scored.
 * A value whose own origin is "estimated" uses the estimated spread; "audited" the verified one.
 */
export const GARMENT_SD_CM: Record<Exclude<ConfidenceGrade, 'unscored'>, { girth: number; length: number }> = {
  verified: { girth: 1.3, length: 0.7 },
  charted: { girth: 2.5, length: 1.5 },
  estimated: { girth: 5, length: 3 },
};

/**
 * A tee the user measured laid flat: about 1 cm on the flat width (so 2 cm round)
 * and 1 cm on length — a soft tape on a rumpled tee.
 */
export const MEASURED_ANCHOR_SD_CM = { girth: 2, length: 1 };

/**
 * How sure we are of what the user likes, on top of the numbers above.
 *  - style 3: "Regular" means different things to different people.
 *  - anchor 1.5 (chest and length): they own the tee, but a favourite tee is still
 *    a range ("this one, or a touch roomier"), not a point.
 */
export const PREFERENCE_SD_CM = { style: 3, anchorChest: 1.5, anchorLength: 1.5 };

/** For the "measure your X" hint: we re-run the answer at these percentiles (z = ±1.2816). */
export const HINT_Z = 1.2816;
