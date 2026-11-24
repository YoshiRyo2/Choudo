/**
 * The "Measure it" form for an anchor tee: text in the user's units to and from
 * a measured Anchor (cm).
 */

import { ANCHOR_LIMITS, type Anchor } from '@choudo/core/domain/fit';
import { cmToIn, inToCm, round } from '@choudo/core/domain/units';
import type { UnitSystem } from '../state/stored';
import { parseNumber } from './bodyForm';

export interface MeasuredTeeForm {
  /** Flat width, armpit to armpit. */
  chest: string;
  /** High point of the shoulder to the hem. */
  length: string;
}

export const EMPTY_TEE_FORM: MeasuredTeeForm = { chest: '', length: '' };

export type TeeField = keyof MeasuredTeeForm;

export interface TeeFormResult {
  anchor: Extract<Anchor, { kind: 'measured' }> | null;
  /** A message per field that's out of range. Blank fields aren't errors until submit. */
  errors: Partial<Record<TeeField, string>>;
  missing: boolean;
}

const LIMIT_KEY: Record<TeeField, keyof typeof ANCHOR_LIMITS> = { chest: 'chestFlatCm', length: 'lengthCm' };
const FIELD_NAME: Record<TeeField, string> = { chest: 'Chest width', length: 'Length' };

function rangeText(field: TeeField, units: UnitSystem): string {
  const { min, max } = ANCHOR_LIMITS[LIMIT_KEY[field]];
  return units === 'metric' ? `${min}–${max} cm` : `${Math.round(cmToIn(min))}–${Math.round(cmToIn(max))} in`;
}

export function teeFormToAnchor(form: MeasuredTeeForm, units: UnitSystem): TeeFormResult {
  const toCm = (text: string) => {
    const v = parseNumber(text);
    return v === undefined ? undefined : units === 'metric' ? v : inToCm(v);
  };
  const cm: Record<TeeField, number | undefined> = { chest: toCm(form.chest), length: toCm(form.length) };
  const errors: TeeFormResult['errors'] = {};
  for (const field of ['chest', 'length'] as const) {
    const v = cm[field];
    const { min, max } = ANCHOR_LIMITS[LIMIT_KEY[field]];
    if (v !== undefined && (v < min || v > max)) {
      errors[field] = `${FIELD_NAME[field]} should be ${rangeText(field, units)}.`;
    }
  }
  const missing = cm.chest === undefined || cm.length === undefined;
  const ok = !missing && Object.keys(errors).length === 0;
  return {
    anchor: ok ? { kind: 'measured', chestFlatCm: cm.chest!, lengthCm: cm.length! } : null,
    errors,
    missing,
  };
}

export function anchorToTeeForm(anchor: Anchor | null, units: UnitSystem): MeasuredTeeForm {
  if (!anchor || anchor.kind !== 'measured') return EMPTY_TEE_FORM;
  const show = (cm: number) => String(round(units === 'metric' ? cm : cmToIn(cm), 1));
  return { chest: show(anchor.chestFlatCm), length: show(anchor.lengthCm) };
}
