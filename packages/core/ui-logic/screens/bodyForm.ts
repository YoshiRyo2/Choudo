/**
 * The body form as the user types it (strings, in their units) and the
 * conversions to and from the domain's BodyInput (numbers, cm/kg).
 */

import { parseBraSize, type BodyInput, type BodyOverrides, type BodyType, type BraSystem } from '../../domain/body';
import {
  cmToFeetInches,
  cmToIn,
  feetInchesToCm,
  inToCm,
  kgToLb,
  lbToKg,
  round,
} from '../../domain/units';
import type { UnitSystem } from '../state/stored';

export const OVERRIDE_FIELDS = ['chest', 'waist', 'hips', 'inseam'] as const;
export type OverrideField = (typeof OVERRIDE_FIELDS)[number];

export interface BodyForm {
  units: UnitSystem;
  heightCm: string;
  heightFt: string;
  heightIn: string;
  weight: string;
  bodyType: BodyType;
  /** Optional tape-measure numbers, in the form's length unit. */
  overrides: Record<OverrideField, string>;
  /** Women's only: an optional bra size as typed ("34C"), and its letter system. */
  braSize: string;
  braSystem: BraSystem;
}

export const EMPTY_FORM: BodyForm = {
  units: 'metric',
  heightCm: '',
  heightFt: '',
  heightIn: '',
  weight: '',
  bodyType: 'mens',
  overrides: { chest: '', waist: '', hips: '', inseam: '' },
  braSize: '',
  braSystem: 'us',
};

const OVERRIDE_KEY: Record<OverrideField, 'chestCm' | 'waistCm' | 'hipsCm' | 'inseamCm'> = {
  chest: 'chestCm',
  waist: 'waistCm',
  hips: 'hipsCm',
  inseam: 'inseamCm',
};

/** "" or junk -> undefined; accepts a comma as the decimal separator. */
export function parseNumber(text: string): number | undefined {
  const cleaned = text.trim().replace(',', '.');
  if (cleaned === '') return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Form -> BodyInput, or null if height or weight is missing. (Range checks are
 * the domain's job: run validateBodyInput on the result.)
 */
export function formToInput(form: BodyForm): BodyInput | null {
  const metric = form.units === 'metric';
  let heightCm: number | undefined;
  if (metric) {
    heightCm = parseNumber(form.heightCm);
  } else {
    const ft = parseNumber(form.heightFt);
    const inch = parseNumber(form.heightIn) ?? 0;
    heightCm = ft === undefined ? undefined : feetInchesToCm(ft, inch);
  }
  const weightRaw = parseNumber(form.weight);
  if (heightCm === undefined || weightRaw === undefined) return null;

  const overrides: BodyOverrides = {};
  for (const field of OVERRIDE_FIELDS) {
    const v = parseNumber(form.overrides[field]);
    if (v !== undefined) overrides[OVERRIDE_KEY[field]] = metric ? v : inToCm(v);
  }
  if (form.bodyType === 'womens' && form.braSize.trim() !== '') {
    const bra = parseBraSize(form.braSize, form.braSystem);
    if (bra.ok) overrides.braSize = bra.value;
  }

  return {
    heightCm,
    weightKg: metric ? weightRaw : lbToKg(weightRaw),
    bodyType: form.bodyType,
    ...(Object.keys(overrides).length > 0 ? { overrides } : {}),
  };
}

/**
 * What's wrong with the typed bra size, or undefined when it's blank, usable, or
 * ignored (a men's body). formToInput leaves out a bra size that has a problem.
 */
export function braSizeProblemText(form: BodyForm): string | undefined {
  if (form.bodyType !== 'womens' || form.braSize.trim() === '') return undefined;
  const bra = parseBraSize(form.braSize, form.braSystem);
  return bra.ok ? undefined : bra.message;
}

/** BodyInput -> form text in the given units (used to pre-fill when editing). */
export function inputToForm(input: BodyInput, units: UnitSystem): BodyForm {
  const metric = units === 'metric';
  const length = (cm: number | undefined) =>
    cm === undefined ? '' : String(round(metric ? cm : cmToIn(cm), 1));
  const { feet, inches } = cmToFeetInches(input.heightCm);
  const o = input.overrides ?? {};
  return {
    units,
    heightCm: String(round(input.heightCm, 1)),
    heightFt: String(feet),
    heightIn: String(inches),
    weight: String(round(metric ? input.weightKg : kgToLb(input.weightKg), 1)),
    bodyType: input.bodyType,
    overrides: {
      chest: length(o.chestCm),
      waist: length(o.waistCm),
      hips: length(o.hipsCm),
      inseam: length(o.inseamCm),
    },
    braSize: o.braSize ? `${o.braSize.band}${o.braSize.cup}` : '',
    braSystem: o.braSize?.system ?? 'us',
  };
}

/**
 * Switch units without losing what was typed. Each field converts on its own (so a
 * half-filled form keeps its numbers), rounded as inputToForm does; text that isn't a
 * number stays as typed.
 */
export function switchUnits(form: BodyForm, units: UnitSystem): BodyForm {
  if (form.units === units) return form;
  const toMetric = units === 'metric';
  const show = (n: number) => String(round(n, 1));

  let { heightCm, heightFt, heightIn } = form;
  const typedCm = toMetric
    ? (() => {
        const ft = parseNumber(form.heightFt);
        return ft === undefined ? undefined : feetInchesToCm(ft, parseNumber(form.heightIn) ?? 0);
      })()
    : parseNumber(form.heightCm);
  if (typedCm !== undefined) {
    const { feet, inches } = cmToFeetInches(typedCm);
    heightCm = show(typedCm);
    heightFt = String(feet);
    heightIn = String(inches);
  } else if (toMetric) {
    heightCm = form.heightFt;
  } else {
    heightFt = form.heightCm;
    heightIn = '';
  }

  const weightValue = parseNumber(form.weight);
  const weight =
    weightValue === undefined ? form.weight : show(toMetric ? lbToKg(weightValue) : kgToLb(weightValue));

  const length = (text: string) => {
    const v = parseNumber(text);
    return v === undefined ? text : show(toMetric ? inToCm(v) : cmToIn(v));
  };
  const overrides = { ...form.overrides };
  for (const field of OVERRIDE_FIELDS) overrides[field] = length(form.overrides[field]);

  return { ...form, units, heightCm, heightFt, heightIn, weight, overrides };
}
