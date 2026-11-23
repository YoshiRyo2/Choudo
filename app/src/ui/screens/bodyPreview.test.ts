import { describe, expect, it } from 'vitest';
import { estimateBody } from '../../domain/body';
import { PREVIEW_BODY, previewBody } from './bodyPreview';

describe('previewBody', () => {
  it('draws a typical body for the chosen body type until height and weight are valid', () => {
    const mens = previewBody(null, 'mens');
    expect(mens.isDefault).toBe(true);
    expect(mens.body).toEqual(estimateBody(PREVIEW_BODY.mens).measurements);
    const womens = previewBody(null, 'womens');
    expect(womens.body.bodyType).toBe('womens');
    expect(womens.body.heightCm).toBe(PREVIEW_BODY.womens.heightCm);
  });

  it('draws the user’s body once there is one', () => {
    const model = estimateBody({ heightCm: 190, weightKg: 95, bodyType: 'mens' });
    expect(previewBody(model, 'mens')).toEqual({ body: model.measurements, isDefault: false });
  });

  it('uses survey-mean bodies, valid for the form', () => {
    expect(PREVIEW_BODY.mens).toMatchObject({ heightCm: 176, weightKg: 85, bodyType: 'mens' });
    expect(PREVIEW_BODY.womens).toMatchObject({ heightCm: 163, weightKg: 68, bodyType: 'womens' });
  });
});
