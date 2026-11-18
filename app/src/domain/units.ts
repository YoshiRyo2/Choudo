/**
 * Unit conversion. Everything inside the domain is stored in centimetres and
 * kilograms; convert only at the edges (user input, display, imported charts).
 */

export const CM_PER_INCH = 2.54;
export const KG_PER_LB = 0.45359237;

export type LengthUnit = 'cm' | 'in';
export type WeightUnit = 'kg' | 'lb';

export const inToCm = (inches: number): number => inches * CM_PER_INCH;
export const cmToIn = (cm: number): number => cm / CM_PER_INCH;
export const lbToKg = (lb: number): number => lb * KG_PER_LB;
export const kgToLb = (kg: number): number => kg / KG_PER_LB;

/** 5 ft 10 in -> 177.8 cm */
export const feetInchesToCm = (feet: number, inches: number): number =>
  inToCm(feet * 12 + inches);

/** 177.8 cm -> { feet: 5, inches: 10 } (inches rounded to the nearest 0.5) */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalIn = Math.round(cmToIn(cm) * 2) / 2;
  const feet = Math.floor(totalIn / 12);
  return { feet, inches: totalIn - feet * 12 };
}

/** Convert a length in `unit` to cm. */
export const toCm = (value: number, unit: LengthUnit): number =>
  unit === 'cm' ? value : inToCm(value);

/** Convert a cm length to `unit`. */
export const fromCm = (cm: number, unit: LengthUnit): number =>
  unit === 'cm' ? cm : cmToIn(cm);

/** Round to `decimals` places (default 1) — for display, never for storage. */
export const round = (value: number, decimals = 1): number => {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
};
