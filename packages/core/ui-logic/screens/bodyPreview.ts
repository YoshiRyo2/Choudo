/**
 * What the body screen's preview draws: the user's body once height and weight
 * are valid, a typical body for the chosen body type until then. Either way the
 * body comes from estimateBody (skin rule: the drawing never makes up a body).
 */

import { estimateBody, type BodyInput, type BodyMeasurements, type BodyModel, type BodyType } from '../../domain/body';

/**
 * ANSUR II survey means, rounded: the men's reference body in estimateBody
 * (176 cm, 85 kg) and the women's survey means (162.8 cm, 67.8 kg).
 */
export const PREVIEW_BODY: Record<BodyType, BodyInput> = {
  mens: { heightCm: 176, weightKg: 85, bodyType: 'mens' },
  womens: { heightCm: 163, weightKg: 68, bodyType: 'womens' },
};

const DEFAULT_MEASUREMENTS: Record<BodyType, BodyMeasurements> = {
  mens: estimateBody(PREVIEW_BODY.mens).measurements,
  womens: estimateBody(PREVIEW_BODY.womens).measurements,
};

export interface PreviewBody {
  body: BodyMeasurements;
  /** True while it's the typical body, not the user's. */
  isDefault: boolean;
}

export function previewBody(model: BodyModel | null, bodyType: BodyType): PreviewBody {
  return model ? { body: model.measurements, isDefault: false } : { body: DEFAULT_MEASUREMENTS[bodyType], isDefault: true };
}
