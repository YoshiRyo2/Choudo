/**
 * The body form's error messages, one per field, and when to show them.
 *
 * Each field is checked on its own (a height of 20 cm is wrong whether or not a
 * weight has been typed yet), against the domain's INPUT_LIMITS, with the range in
 * the units the user is typing in. A field's message shows once the field loses
 * focus (or after a submit), never while the user is still typing; once fixed, it
 * hides at once and waits for the next blur.
 */

import { INPUT_LIMITS, type BodyType } from '@choudo/core/domain/body';
import { cmToIn, feetInchesToCm, inToCm, kgToLb, lbToKg } from '@choudo/core/domain/units';
import type { UnitSystem } from '../state/stored';
import { braSizeProblemText, OVERRIDE_FIELDS, parseNumber, type BodyForm, type OverrideField } from './bodyForm';

export type FormField = 'height' | 'weight' | OverrideField | 'braSize';
export type FieldErrors = Partial<Record<FormField, string>>;

export const ALL_FIELDS: readonly FormField[] = ['height', 'weight', ...OVERRIDE_FIELDS, 'braSize'];

type LimitKey = keyof typeof INPUT_LIMITS;

const LIMIT_OF: Record<Exclude<FormField, 'braSize'>, LimitKey> = {
  height: 'heightCm',
  weight: 'weightKg',
  chest: 'chestCm',
  waist: 'waistCm',
  hips: 'hipsCm',
  inseam: 'inseamCm',
};

const FIELD_NAME: Record<LimitKey, string> = {
  heightCm: 'Height',
  weightKg: 'Weight',
  chestCm: 'Chest',
  waistCm: 'Waist',
  hipsCm: 'Hips',
  inseamCm: 'Inseam',
};

/** A field's value in cm or kg, or undefined when it's blank (or not a number). */
function valueOf(form: BodyForm, field: Exclude<FormField, 'braSize'>): number | undefined {
  const metric = form.units === 'metric';
  if (field === 'height') {
    if (metric) return parseNumber(form.heightCm);
    const ft = parseNumber(form.heightFt);
    return ft === undefined ? undefined : feetInchesToCm(ft, parseNumber(form.heightIn) ?? 0);
  }
  if (field === 'weight') {
    const w = parseNumber(form.weight);
    return w === undefined || metric ? w : lbToKg(w);
  }
  const v = parseNumber(form.overrides[field]);
  return v === undefined || metric ? v : inToCm(v);
}

/** "Height should be 120–230 cm." in the user's units ("Bust" for a women's chest). */
function rangeMessage(key: LimitKey, units: UnitSystem, bodyType: BodyType): string {
  const { min, max } = INPUT_LIMITS[key];
  let range: string;
  if (units === 'metric') {
    range = `${min}–${max} ${key === 'weightKg' ? 'kg' : 'cm'}`;
  } else if (key === 'weightKg') {
    range = `${Math.round(kgToLb(min))}–${Math.round(kgToLb(max))} lb`;
  } else if (key === 'heightCm') {
    range = `${Math.round(cmToIn(min))}–${Math.round(cmToIn(max))} in total`;
  } else {
    range = `${Math.round(cmToIn(min))}–${Math.round(cmToIn(max))} in`;
  }
  const name = key === 'chestCm' && bodyType === 'womens' ? 'Bust' : FIELD_NAME[key];
  return `${name} should be ${range}.`;
}

/** Every field that's filled in and wrong, each checked on its own. */
export function fieldErrors(form: BodyForm): FieldErrors {
  const out: FieldErrors = {};
  for (const field of Object.keys(LIMIT_OF) as (keyof typeof LIMIT_OF)[]) {
    const value = valueOf(form, field);
    if (value === undefined) continue;
    const key = LIMIT_OF[field];
    const { min, max } = INPUT_LIMITS[key];
    if (value < min || value > max) out[field] = rangeMessage(key, form.units, form.bodyType);
  }
  const bra = braSizeProblemText(form);
  if (bra) out.braSize = bra;
  return out;
}

/** Fields whose message may show: after a blur (that field) or a submit (all of them). */
export function reveal(revealed: ReadonlySet<FormField>, fields: readonly FormField[]): ReadonlySet<FormField> {
  const next = new Set(revealed);
  for (const f of fields) next.add(f);
  return next;
}

/** After a change: a field that's now right stops showing, until it next loses focus. */
export function forgetIfFixed(revealed: ReadonlySet<FormField>, field: FormField, errors: FieldErrors): ReadonlySet<FormField> {
  if (!revealed.has(field) || errors[field]) return revealed;
  const next = new Set(revealed);
  next.delete(field);
  return next;
}

/** The messages to show now. */
export function shownErrors(errors: FieldErrors, revealed: ReadonlySet<FormField>): FieldErrors {
  const out: FieldErrors = {};
  for (const [field, message] of Object.entries(errors) as [FormField, string][]) {
    if (revealed.has(field)) out[field] = message;
  }
  return out;
}
