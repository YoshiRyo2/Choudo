import { describe, expect, it } from 'vitest';
import { EMPTY_FORM, type BodyForm } from './bodyForm';
import { ALL_FIELDS, fieldErrors, forgetIfFixed, reveal, shownErrors, type FormField } from './bodyFieldErrors';

const form = (patch: Partial<BodyForm>): BodyForm => ({ ...EMPTY_FORM, ...patch });

describe('fieldErrors', () => {
  it('checks a field on its own, even when the others are still empty', () => {
    expect(fieldErrors(form({ heightCm: '20' }))).toEqual({ height: 'Height should be 120–230 cm.' });
    expect(fieldErrors(form({ weight: '5' }))).toEqual({ weight: 'Weight should be 30–250 kg.' });
  });

  it('says nothing about blank or in-range fields', () => {
    expect(fieldErrors(EMPTY_FORM)).toEqual({});
    expect(fieldErrors(form({ heightCm: '176', weight: '85' }))).toEqual({});
  });

  it('gives the range in the units being typed', () => {
    expect(fieldErrors(form({ units: 'imperial', heightFt: '1', weight: '20' }))).toEqual({
      height: 'Height should be 47–91 in total.',
      weight: 'Weight should be 66–551 lb.',
    });
    expect(fieldErrors(form({ units: 'imperial', overrides: { chest: '5', waist: '', hips: '', inseam: '' } }))).toEqual({
      chest: 'Chest should be 24–71 in.',
    });
  });

  it('checks tape-measure numbers, calling the chest the bust for a women’s body', () => {
    const overrides = { chest: '20', waist: '80', hips: '', inseam: '200' };
    expect(fieldErrors(form({ overrides }))).toEqual({
      chest: 'Chest should be 60–180 cm.',
      inseam: 'Inseam should be 50–110 cm.',
    });
    expect(fieldErrors(form({ overrides, bodyType: 'womens' })).chest).toBe('Bust should be 60–180 cm.');
  });

  it('includes a bra size it can’t read, for a women’s body only', () => {
    expect(fieldErrors(form({ bodyType: 'womens', braSize: '34Z' })).braSize).toBeTruthy();
    expect(fieldErrors(form({ bodyType: 'mens', braSize: '34Z' })).braSize).toBeUndefined();
  });
});

describe('which errors show', () => {
  const errors = { height: 'Height should be 120–230 cm.', weight: 'Weight should be 30–250 kg.' };
  const none: ReadonlySet<FormField> = new Set();

  it('shows nothing while the user is still typing', () => {
    expect(shownErrors(errors, none)).toEqual({});
  });

  it('shows a field’s error once it loses focus, and only that field’s', () => {
    expect(shownErrors(errors, reveal(none, ['height']))).toEqual({ height: errors.height });
  });

  it('shows every error after a submit', () => {
    expect(shownErrors(errors, reveal(none, ALL_FIELDS))).toEqual(errors);
  });

  it('hides a shown error as soon as the field is fixed, and waits for the next blur after that', () => {
    const shown = reveal(none, ['height']);
    const fixed = forgetIfFixed(shown, 'height', {});
    expect(fixed.has('height')).toBe(false);
    // Typing "1" on the way to "180" isn't an error yet.
    expect(shownErrors({ height: errors.height }, fixed)).toEqual({});
  });

  it('keeps a shown error while the field is still wrong', () => {
    const shown = reveal(none, ['height']);
    expect(forgetIfFixed(shown, 'height', errors).has('height')).toBe(true);
  });
});
